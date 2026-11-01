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
import { CONNECTOR_VERSION, CONNECTOR_LIMITS, readRecordInput, recordText, str, folderOk, projectKeyOk } from './connector-record.mjs';
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
  /** A failed write never becomes the state a later call can acknowledge. Mutations, not only writes, are serialized. */
  function mutate(change) {
    writing = writing.catch(() => {}).then(async () => {
      const next = structuredClone(state), result = change(next);
      await mkdir(dir, { recursive: true }); await writeFile(`${file}.tmp`, JSON.stringify(next)); await rename(`${file}.tmp`, file);
      state = next;
      return result;
    });
    return writing;
  }
  const prune = next => {
    const after = now().getTime() - CONNECTOR_LIMITS.keepDays * 86400000;
    // A web record may have waited in the cloud longer than the local retention period. Keep its original at, but retain it
    // from the time this PC received it, rather than ACKing a record immediately discarded by this prune.
    next.records = next.records.filter(r => Date.parse(r.receivedAt ?? r.at) >= after).slice(-CONNECTOR_LIMITS.records);
  };

  async function add(input) {
    const at = now().toISOString(), r = readRecordInput(input);
    const made = redactSecrets(recordText({ ...r, at }));
    if (made.text.length > CONNECTOR_LIMITS.text) throw new ApiError('INPUT_TOO_LARGE', 413);
    return mutate(next => {
      const record = { seq: ++next.seq, at, folder: r.folder, project: r.project, tool: r.tool, title: r.title, text: made.text };
      next.records.push(record); prune(next);
      return { seq: record.seq, at, redacted: made.count };
    });
  }
  /** Records the cloud connector kept for this PC's owner (server/cloud-pull.mjs), each taken once by its cloud id. Their text was
   * made and masked there; it is masked again here. A record placed in no project goes to the first project that looks for one. */
  async function take(list) {
    if (!Array.isArray(list) || list.length > 100) throw new ApiError('INVALID_INPUT', 400);
    return mutate(next => {
      const seen = new Set(next.cloud), ackIds = []; let added = 0;
      for (const c of list) {
        if (!c || typeof c.id !== 'string' || !/^\d{13}-[\w-]{8}$/.test(c.id) || typeof c.text !== 'string' || !c.text.trim() || c.text.length > CONNECTOR_LIMITS.text ||
            typeof c.at !== 'string' || !Number.isFinite(Date.parse(c.at)) || (c.project !== null && c.project !== undefined && !projectKeyOk(c.project)) ||
            (c.title !== null && c.title !== undefined && (typeof c.title !== 'string' || c.title.length > CONNECTOR_LIMITS.title))) continue;
        if (!seen.has(c.id)) {
          const text = redactSecrets(c.text).text; if (text.length > CONNECTOR_LIMITS.text) continue;
          next.records.push({ seq: ++next.seq, at: c.at, receivedAt: now().toISOString(), folder: null, project: c.project ?? null, unplaced: !c.project, tool: 'web', title: c.title ?? null, text, cloud: c.id });
          seen.add(c.id); next.cloud.push(c.id); added++;
        }
        if (!ackIds.includes(c.id)) ackIds.push(c.id);
      }
      next.cloud = next.cloud.slice(-2000); prune(next);
      return { added, ackIds };
    });
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
    await mutate(next => { next.handovers = [{ key, code, name, folders, text, at }, ...next.handovers.filter(h => h.key !== key)].slice(0, CONNECTOR_LIMITS.handovers); });
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
