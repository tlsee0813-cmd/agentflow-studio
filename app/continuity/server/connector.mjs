// The AgentFlow connector's mailbox on this PC (local Node server only, never the Worker or a static build).
//   In:  an AI session that has the AgentFlow MCP connector (connector/agentflow-mcp.mjs) leaves a record of a request and what it
//        did. It is kept here, as a record text in the shape a session import writes, until the browser's automatic connection of
//        a project bound to that working folder takes it (the browser keeps projects; this server never holds one).
//   Out: while a connected project is open, the browser leaves its latest handover document here, so the connector can hand it to
//        a new session that asks for it ("인수인계 받기") without anyone copying it.
// Both live in one small JSON file (STUDIO_CONNECTOR_DIR, else app/continuity/.studio-data/connector-<port>), so a restart keeps them.
// Credential-like parts are hidden before anything is kept. Nothing here calls a provider.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ApiError } from '../../server/errors.mjs';
import { redactSecrets } from '../dist/public/shared/secret.js';
import { within } from '../dist/public/shared/session-parse.js';

export const CONNECTOR_VERSION = 'connector.1';
export const CONNECTOR_LIMITS = Object.freeze({ records: 500, keepDays: 14, title: 120, request: 20000, answer: 40000, files: 60, path: 1024, handovers: 40, handoverChars: 40000, page: 50 });
/** Which tool a record is attributed to, from the name the MCP client gives itself (an unknown client is a web AI session). */
const TOOL_HEAD = { claude: 'Claude Code', codex: 'Codex', web: '웹 AI' };
export function toolOfClient(name) {
  const n = String(name ?? '').toLowerCase();
  return /claude[-_ ]?code/.test(n) ? 'claude' : /codex/.test(n) ? 'codex' : 'web';
}
const oneLine = t => String(t).replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim();
const clean = t => String(t).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
const stampOf = iso => { const d = new Date(iso), p = n => String(n).padStart(2, '0'); return `${p(d.getHours())}:${p(d.getMinutes())}`; };

/** One record as a session import writes it (shared/session-import.ts sessionText), so the page reads, names and attributes it
 * like any other: a header with the title, folder and branch, the request, then the answer with the files it changed. */
export function recordText({ tool, title, folder, branch, request, answer, files, requestId = null, at }) {
  const name = TOOL_HEAD[tool] ?? TOOL_HEAD.web;
  const head = [title ? (/^(작업 폴더|브랜치|세션) /.test(title) || title.startsWith('「') ? `「${title}」` : title) : null, folder ? `작업 폴더 ${folder}` : null, branch ? `브랜치 ${branch}` : null].filter(Boolean).join(' · ');
  const time = at ? ` · ${stampOf(at)}` : '';
  return [`[${name} 세션 기록${head ? ` · ${head}` : ''}]`, '', `── 사용자 요청${time} ──`, request, '', `── ${name} 답변${time} ──`, answer + (requestId ? `\n(맡긴 변경 요청: ${requestId})` : '') + (files.length ? `\n(바꾼 파일: ${files.join(', ')})` : '')].join('\n');
}

function str(v, max, { optional = false, line = false } = {}) {
  if (v === undefined || v === null || v === '') { if (optional) return null; throw new ApiError('INVALID_INPUT', 400); }
  if (typeof v !== 'string') throw new ApiError('INVALID_INPUT', 400);
  const t = line ? oneLine(v) : clean(v).trim();
  if (!t) { if (optional) return null; throw new ApiError('INVALID_INPUT', 400); }
  if (t.length > max) throw new ApiError('INPUT_TOO_LARGE', 413);
  return t;
}
const folderOk = f => typeof f === 'string' && f.length > 0 && f.length <= CONNECTOR_LIMITS.path && /^(?:[A-Za-z]:[\\/]|\\\\|\/)/.test(f);

/** A record the connector sends, checked; its text is made here (the connector cannot shape what the page keeps). */
export function readRecordInput(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new ApiError('INVALID_INPUT', 400);
  const L = CONNECTOR_LIMITS;
  const folder = v.folder === undefined || v.folder === null ? null : folderOk(v.folder) ? oneLine(v.folder) : (() => { throw new ApiError('INVALID_INPUT', 400); })();
  const project = v.project === undefined || v.project === null ? null : typeof v.project === 'string' && /^[A-Z2-9]{6}$/.test(v.project) ? v.project : (() => { throw new ApiError('INVALID_INPUT', 400); })();
  if (!folder && !project) throw new ApiError('INVALID_INPUT', 400);
  const files = v.files === undefined || v.files === null ? [] : Array.isArray(v.files) && v.files.length <= L.files ? v.files.map(f => str(f, L.path, { line: true })) : (() => { throw new ApiError('INVALID_INPUT', 400); })();
  // A change request this work answers (the id its request text carries): named in the record, so the map reads it as that request's report.
  const requestId = v.request_id === undefined || v.request_id === null || v.request_id === '' ? null : typeof v.request_id === 'string' && /^RQ_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.request_id.trim()) ? v.request_id.trim() : (() => { throw new ApiError('INVALID_INPUT', 400); })();
  return {
    folder, project, files, requestId,
    tool: toolOfClient(v.client), title: str(v.title, L.title, { optional: true, line: true }), branch: str(v.branch, 200, { optional: true, line: true })?.replace(/\s+/g, '') ?? null,
    request: str(v.request, L.request), answer: str(v.answer, L.answer)
  };
}

/** The mailbox, kept in `dir` (created when first written). now: for tests. */
export async function openConnector({ dir, now = () => new Date() }) {
  const file = join(dir, 'connector.json');
  let state = { version: CONNECTOR_VERSION, seq: 0, records: [], handovers: [] };
  try {
    const v = JSON.parse(await readFile(file, 'utf8'));
    if (v?.version === CONNECTOR_VERSION && Array.isArray(v.records) && Array.isArray(v.handovers) && Number.isSafeInteger(v.seq)) state = v;
  } catch { /* none yet, or unreadable: start empty */ }
  let writing = Promise.resolve();
  /** Written whole to a file beside it, then moved over it, one write after another. */
  function persist() {
    const text = JSON.stringify(state);
    writing = writing.catch(() => {}).then(async () => { await mkdir(dir, { recursive: true }); await writeFile(`${file}.tmp`, text); await rename(`${file}.tmp`, file); });
    return writing;
  }
  const prune = () => {
    const after = now().getTime() - CONNECTOR_LIMITS.keepDays * 86400000;
    state.records = state.records.filter(r => Date.parse(r.at) >= after).slice(-CONNECTOR_LIMITS.records);
  };

  async function add(input) {
    const at = now().toISOString(), r = readRecordInput(input);
    const made = redactSecrets(recordText({ ...r, at }));
    const record = { seq: ++state.seq, at, folder: r.folder, project: r.project, tool: r.tool, title: r.title, text: made.text };
    state.records.push(record); prune(); await persist();
    return { seq: record.seq, at, redacted: made.count };
  }
  /** Records after `after` (a seq) for any of these folders (a record made in one of them or inside one) or project codes. */
  function since(after, { folders = [], projects = [] } = {}) {
    const mine = state.records.filter(r => r.seq > after && ((r.folder && folders.some(f => within([r.folder], f))) || (r.project && projects.includes(r.project))));
    const page = mine.slice(0, CONNECTOR_LIMITS.page);
    return { version: CONNECTOR_VERSION, records: page.map(({ seq, at, folder, tool, title, text }) => ({ seq, at, folder, tool, title, text })), last: state.seq, more: mine.length > page.length };
  }
  /** The browser's latest handover document of one project, replacing the one it left before. */
  async function publish(v) {
    if (!v || typeof v !== 'object') throw new ApiError('INVALID_INPUT', 400);
    const key = typeof v.key === 'string' && /^[\w.:-]{1,120}$/.test(v.key) ? v.key : null;
    const code = typeof v.code === 'string' && /^[A-Z2-9]{6}$/.test(v.code) ? v.code : null;
    const folders = Array.isArray(v.folders) && v.folders.length <= 20 && v.folders.every(folderOk) ? v.folders : null;
    if (!key || !code || !folders) throw new ApiError('INVALID_INPUT', 400);
    const name = str(v.name, 200, { line: true }), text = redactSecrets(str(v.text, CONNECTOR_LIMITS.handoverChars)).text;
    const at = now().toISOString();
    state.handovers = [{ key, code, name, folders, text, at }, ...state.handovers.filter(h => h.key !== key)].slice(0, CONNECTOR_LIMITS.handovers);
    await persist();
    return { at };
  }
  /** The newest handover of a project bound to this folder (or a folder it lies in), or of this project code. */
  function handover({ folder = null, project = null } = {}) {
    const h = state.handovers.find(x => (project && x.code === project) || (folder && x.folders.some(f => within([folder], f))));
    return h ? { version: CONNECTOR_VERSION, name: h.name, code: h.code, folders: h.folders, at: h.at, text: h.text } : { version: CONNECTOR_VERSION, name: null, text: null };
  }
  return { describe: () => ({ version: CONNECTOR_VERSION }), add, since, publish, handover, flush: () => writing };
}
