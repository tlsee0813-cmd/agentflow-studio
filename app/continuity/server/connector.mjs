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
import { CONNECTOR_VERSION, CONNECTOR_LIMITS, readRecordInput, recordText, str, folderOk } from './connector-record.mjs';
import { redactSecrets } from '../dist/public/shared/secret.js';
import { within } from '../dist/public/shared/session-parse.js';

export { CONNECTOR_VERSION, CONNECTOR_LIMITS, toolOfClient, recordText, readRecordInput } from './connector-record.mjs';

/** The mailbox, kept in `dir` (created when first written). now: for tests. */
export async function openConnector({ dir, now = () => new Date(), onPublish = null }) {
  const file = join(dir, 'connector.json');
  let state = { version: CONNECTOR_VERSION, seq: 0, records: [], handovers: [], cloud: [] };
  try {
    const v = JSON.parse(await readFile(file, 'utf8'));
    if (v?.version === CONNECTOR_VERSION && Array.isArray(v.records) && Array.isArray(v.handovers) && Number.isSafeInteger(v.seq)) state = { ...v, cloud: Array.isArray(v.cloud) ? v.cloud : [] };
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
  /** Records the cloud connector kept for this PC's owner (server/cloud-pull.mjs), each taken once by its cloud id. Their text was
   * made and masked there; it is masked again here. A record placed in no project goes to the first project that looks for one. */
  async function take(list) {
    const seen = new Set(state.cloud); let added = 0;
    for (const c of list) {
      if (!c || typeof c.id !== 'string' || seen.has(c.id) || typeof c.text !== 'string' || !c.text.trim() || c.text.length > CONNECTOR_LIMITS.request + CONNECTOR_LIMITS.answer + 2000) continue;
      const at = typeof c.at === 'string' && Number.isFinite(Date.parse(c.at)) ? c.at : now().toISOString();
      state.records.push({ seq: ++state.seq, at, folder: null, project: typeof c.project === 'string' ? c.project : null, unplaced: !c.project, tool: 'web', title: typeof c.title === 'string' ? c.title : null, text: redactSecrets(c.text).text, cloud: c.id });
      seen.add(c.id); state.cloud.push(c.id); added++;
    }
    state.cloud = state.cloud.slice(-2000);
    if (added) { prune(); await persist(); }
    return { added };
  }
  /** Records after `after` (a seq) for any of these folders (a record made in one of them or inside one) or projects (their page
   * keys), and, with unplaced, records the cloud kept for no project. */
  function since(after, { folders = [], projects = [], unplaced = false } = {}) {
    const mine = state.records.filter(r => r.seq > after && ((r.folder && folders.some(f => within([r.folder], f))) || (r.project && projects.includes(r.project)) || (unplaced && r.unplaced)));
    const page = mine.slice(0, CONNECTOR_LIMITS.page);
    return { version: CONNECTOR_VERSION, records: page.map(({ seq, at, folder, project, tool, title, text }) => ({ seq, at, folder, project: project ?? null, tool, title, text })), last: state.seq, more: mine.length > page.length };
  }
  /** The browser's latest handover document of one project, replacing the one it left before. */
  async function publish(v) {
    if (!v || typeof v !== 'object') throw new ApiError('INVALID_INPUT', 400);
    const key = typeof v.key === 'string' && /^[\w.:-]{1,120}$/.test(v.key) ? v.key : null;
    const code = typeof v.code === 'string' && /^[A-Z2-9]{6}$/.test(v.code) ? v.code : null;
    const folders = Array.isArray(v.folders) && v.folders.length <= 20 && v.folders.every(folderOk) ? v.folders : v.folders === undefined ? [] : null;
    if (!key || !code || !folders) throw new ApiError('INVALID_INPUT', 400);
    const name = str(v.name, 200, { line: true }), text = redactSecrets(str(v.text, CONNECTOR_LIMITS.handoverChars)).text;
    const at = now().toISOString();
    state.handovers = [{ key, code, name, folders, text, at }, ...state.handovers.filter(h => h.key !== key)].slice(0, CONNECTOR_LIMITS.handovers);
    await persist();
    // The cloud connector, when this PC is linked to it, gets the same document (for a web AI session of the same owner).
    onPublish?.({ key, name, text, at });
    return { at };
  }
  /** The newest handover of a project bound to this folder (or a folder it lies in), or of this project code. */
  function handover({ folder = null, project = null } = {}) {
    const h = state.handovers.find(x => (project && (x.code === project || x.key === project)) || (folder && x.folders.some(f => within([folder], f))));
    return h ? { version: CONNECTOR_VERSION, name: h.name, code: h.code, folders: h.folders, at: h.at, text: h.text } : { version: CONNECTOR_VERSION, name: null, text: null };
  }
  return { describe: () => ({ version: CONNECTOR_VERSION }), add, take, since, publish, handover, flush: () => writing };
}
