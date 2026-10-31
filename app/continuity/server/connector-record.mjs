// What a connector record is, shared by the local mailbox (connector.mjs) and the cloud connector (cloud-connector.mjs): the
// checks on what an AI session sends, and the record text made from it in the shape a session import writes. No node: imports, so
// the Worker can carry it.
import { ApiError } from '../../server/errors.mjs';

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

export function str(v, max, { optional = false, line = false } = {}) {
  if (v === undefined || v === null || v === '') { if (optional) return null; throw new ApiError('INVALID_INPUT', 400); }
  if (typeof v !== 'string') throw new ApiError('INVALID_INPUT', 400);
  const t = line ? oneLine(v) : clean(v).trim();
  if (!t) { if (optional) return null; throw new ApiError('INVALID_INPUT', 400); }
  if (t.length > max) throw new ApiError('INPUT_TOO_LARGE', 413);
  return t;
}
export const projectKeyOk = k => typeof k === 'string' && /^[\w.:-]{1,120}$/.test(k);
export const folderOk = f => typeof f === 'string' && f.length > 0 && f.length <= CONNECTOR_LIMITS.path && /^(?:[A-Za-z]:[\\/]|\\\\|\/)/.test(f);

/** A record the connector sends, checked; its text is made here (the connector cannot shape what the page keeps). */
export function readRecordInput(v, { unplaced = false } = {}) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new ApiError('INVALID_INPUT', 400);
  const L = CONNECTOR_LIMITS;
  const folder = v.folder === undefined || v.folder === null ? null : folderOk(v.folder) ? oneLine(v.folder) : (() => { throw new ApiError('INVALID_INPUT', 400); })();
  // project: the page's key of the project it goes to (a web session has no folder); unplaced: neither is needed (the cloud keeps it
  // for whichever project its owner links next).
  const project = v.project === undefined || v.project === null ? null : projectKeyOk(v.project) ? v.project : (() => { throw new ApiError('INVALID_INPUT', 400); })();
  if (!folder && !project && !unplaced) throw new ApiError('INVALID_INPUT', 400);
  const files = v.files === undefined || v.files === null ? [] : Array.isArray(v.files) && v.files.length <= L.files ? v.files.map(f => str(f, L.path, { line: true })) : (() => { throw new ApiError('INVALID_INPUT', 400); })();
  // A change request this work answers (the id its request text carries): named in the record, so the map reads it as that request's report.
  const requestId = v.request_id === undefined || v.request_id === null || v.request_id === '' ? null : typeof v.request_id === 'string' && /^RQ_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.request_id.trim()) ? v.request_id.trim() : (() => { throw new ApiError('INVALID_INPUT', 400); })();
  return {
    folder, project, files, requestId,
    tool: toolOfClient(v.client), title: str(v.title, L.title, { optional: true, line: true }), branch: str(v.branch, 200, { optional: true, line: true })?.replace(/\s+/g, '') ?? null,
    request: str(v.request, L.request), answer: str(v.answer, L.answer)
  };
}

