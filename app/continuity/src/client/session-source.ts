/* Where the page gets AI session records from: the local Studio server when it reads this PC's sessions (server/sessions.mjs), or
 * else a folder the person picked in this browser (Chrome/Edge folder access: their .claude or .codex folder), read here with the
 * same reading (shared/session-parse.ts). Nothing is installed and nothing leaves the browser: a folder's files are read only to
 * list and take sessions, and what is kept is what the paste box or the automatic connection then saves as records.
 * The picked folders are remembered in this browser (IndexedDB holds the folder handles); the browser may ask again, with one
 * click, before the page can read them on a later visit. A single file chosen by hand works in every browser. */
import { listSessions, readSession, type AiStatus } from './studio-api.js';
import { readSessionList, readSessionDetail, type SessionDetail, type SessionSummary } from '../shared/session-import.js';
import { SESSION_LIMITS, jsonLines, parseSession, sniffTool, sessionSummary, sessionDetail, sessionId, within, type SessionTool } from '../shared/session-parse.js';

export interface SessionSource { kind: 'server' | 'folder'; list(folder?: string | null): Promise<SessionSummary[]>; read(id: string): Promise<SessionDetail> }
export type FolderState = 'unsupported' | 'none' | 'prompt' | 'granted';

/* Minimal shapes of the File System Access handles this file uses (a test may stand in its own). */
interface FileHandle { kind: 'file'; name: string; getFile(): Promise<File> }
interface DirHandle { kind: 'directory'; name: string; values(): AsyncIterable<FileHandle | DirHandle>;
  queryPermission?(o: { mode: 'read' }): Promise<PermissionState>; requestPermission?(o: { mode: 'read' }): Promise<PermissionState> }
type Picker = (o: { id?: string; mode?: 'read' }) => Promise<DirHandle>;

const DB = 'agentflow.studio.session-folders', STORE = 'roots', KEY = 'roots';
function idb(): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    try { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => resolve(r.result); r.onerror = () => resolve(null); }
    catch { resolve(null); }
  });
}
async function loadRoots(): Promise<DirHandle[]> {
  const db = await idb(); if (!db) return [];
  return new Promise(resolve => {
    try { const r = db.transaction(STORE).objectStore(STORE).get(KEY); r.onsuccess = () => resolve(Array.isArray(r.result) ? r.result : []); r.onerror = () => resolve([]); }
    catch { resolve([]); }
  });
}
async function saveRoots(roots: DirHandle[]): Promise<void> {
  const db = await idb(); if (!db) return;
  // A handle that cannot be stored (a stand-in) keeps working for this page only.
  try { db.transaction(STORE, 'readwrite').objectStore(STORE).put(roots, KEY); } catch { /* this page only */ }
}

/** How deep and how wide a picked folder is walked for .jsonl files (a home folder picked by mistake stays bounded). */
const WALK_DEPTH = 6, WALK_ENTRIES = 20000;
interface Found { tool: SessionTool | null; path: string; handle: FileHandle; file: File }
async function walk(root: DirHandle): Promise<Found[]> {
  const out: Found[] = []; let seen = 0;
  async function go(dir: DirHandle, path: string, depth: number) {
    for await (const e of dir.values()) {
      if (++seen > WALK_ENTRIES) return;
      if (e.kind === 'directory') { if (depth < WALK_DEPTH && e.name !== 'node_modules' && !(depth > 0 && e.name.startsWith('.'))) await go(e, `${path}${e.name}/`, depth + 1); continue; }
      if (!e.name.endsWith('.jsonl')) continue;
      let file: File; try { file = await e.getFile(); } catch { continue; }
      if (!file.size) continue;
      // The layout tells the tool when it is the tools' own (projects/… or sessions/…/rollout-…); otherwise the lines do.
      const p = `${path}${e.name}`, tool: SessionTool | null = /(^|\/)projects\//.test(p) ? 'claude' : /(^|\/)sessions\/.*rollout-[^/]*\.jsonl$/.test(p) || /^rollout-/.test(e.name) ? 'codex' : null;
      out.push({ tool, path: `${root.name}/${p}`, handle: e, file });
    }
  }
  await go(root, '', 0);
  return out;
}

export function createSessionSources(host: { status(): AiStatus; accessCode(): string }) {
  let roots: DirHandle[] = [], state: FolderState = 'none', loaded: Promise<void> | null = null;
  const picker = (): Picker | null => (typeof window !== 'undefined' && typeof (window as unknown as { showDirectoryPicker?: Picker }).showDirectoryPicker === 'function' ? (window as unknown as { showDirectoryPicker: Picker }).showDirectoryPicker : null);
  // Per file: what its head said, while its size and time stay the same (a look every minute reads only what changed).
  const heads = new Map<string, { key: string; row: SessionSummary | null; cwd: string | null }>();
  const known = new Map<string, Found & { tool: SessionTool }>();

  async function check(): Promise<FolderState> {
    if (!picker()) return (state = 'unsupported');
    if (!roots.length) return (state = 'none');
    const all = await Promise.all(roots.map(r => r.queryPermission?.({ mode: 'read' }).catch(() => 'prompt' as PermissionState) ?? Promise.resolve('granted' as PermissionState)));
    return (state = all.every(x => x === 'granted') ? 'granted' : 'prompt');
  }
  function load(): Promise<void> { return (loaded ??= (async () => { if (picker()) roots = await loadRoots(); await check(); })()); }

  const server: SessionSource = { kind: 'server', list: (folder = null) => listSessions(host.accessCode(), folder), read: id => readSession(id, host.accessCode()) };
  const folderSource: SessionSource = {
    kind: 'folder',
    async list(folder = null) {
      const found: Found[] = [];
      for (const r of roots) found.push(...await walk(r).catch(() => []));
      found.sort((a, b) => b.file.lastModified - a.file.lastModified);
      const out: SessionSummary[] = [];
      for (const f of found.slice(0, SESSION_LIMITS.scan)) {
        if (out.length >= SESSION_LIMITS.list) break;
        const key = `${f.file.size}:${f.file.lastModified}`, was = heads.get(f.path);
        let row = was?.key === key ? was.row : undefined, cwd = was?.cwd ?? null;
        if (row === undefined) {
          const partial = f.file.size > SESSION_LIMITS.headBytes, lines = jsonLines(await f.file.slice(0, SESSION_LIMITS.headBytes).text(), partial);
          const tool = f.tool ?? sniffTool(lines);
          if (!tool) { heads.set(f.path, { key, row: null, cwd: null }); continue; }
          const parsed = parseSession(tool, lines);
          row = sessionSummary(await sessionId(tool, f.path), tool, parsed, new Date(f.file.lastModified).toISOString(), f.file.size);
          cwd = parsed.meta.cwd; heads.set(f.path, { key, row, cwd });
        }
        if (!row) continue;
        known.set(row.id, { ...f, tool: row.tool });
        if (folder && !within(cwd, folder)) continue;
        out.push(row);
      }
      return readSessionList({ version: 'sessions.1', sessions: out });
    },
    async read(id) {
      if (!known.has(id)) await folderSource.list();
      const f = known.get(id); if (!f) throw Object.assign(new Error('SESSION_NOT_FOUND'), { code: 'SESSION_NOT_FOUND' });
      const file = await f.handle.getFile();
      if (file.size > SESSION_LIMITS.fileBytes) throw Object.assign(new Error('SESSION_TOO_LARGE'), { code: 'SESSION_TOO_LARGE' });
      const d = readSessionDetail(sessionDetail(id, f.tool, parseSession(f.tool, jsonLines(await file.text()))));
      if (!d) throw Object.assign(new Error('SESSION_NOT_FOUND'), { code: 'SESSION_NOT_FOUND' });
      return d;
    }
  };

  return {
    load,
    /** The source to use now: the local server when it reads sessions, else the picked folders once the browser allows them. */
    current(): SessionSource | null { if (host.status().sessions?.tools.length) return server; return state === 'granted' && roots.length ? folderSource : null; },
    /** Whether this page can offer session records at all (the server reads them, or this browser can be given a folder). */
    offered(): boolean { return !!host.status().sessions?.tools.length || (state !== 'unsupported'); },
    usesServer: () => !!host.status().sessions?.tools.length,
    folderState: () => state,
    folders: () => roots.map(r => r.name),
    /** Asks the person for a folder (their .claude or .codex). True when one was added. Must run from a click. */
    async pick(): Promise<boolean> {
      const p = picker(); if (!p) return false;
      let d: DirHandle; try { d = await p.call(window, { id: 'af-sessions', mode: 'read' }); } catch { return false; }
      if (!roots.some(r => r.name === d.name)) roots = [...roots, d];
      heads.clear(); await saveRoots(roots); await check(); return true;
    },
    /** Asks the browser again to let this page read the picked folders. Must run from a click. */
    async grant(): Promise<FolderState> {
      for (const r of roots) { try { await r.requestPermission?.({ mode: 'read' }); } catch { /* still asked */ } }
      return check();
    },
    async forget(name: string): Promise<void> { roots = roots.filter(r => r.name !== name); heads.clear(); known.clear(); await saveRoots(roots); await check(); }
  };
}
export type SessionSources = ReturnType<typeof createSessionSources>;

/** One session file the person chose (any browser): read here, the tool told by its lines. Null when it is not a session file. */
export async function readSessionFile(file: File): Promise<SessionDetail | null> {
  if (file.size > SESSION_LIMITS.fileBytes) throw Object.assign(new Error('SESSION_TOO_LARGE'), { code: 'SESSION_TOO_LARGE' });
  const lines = jsonLines(await file.text()), tool = sniffTool(lines); if (!tool) return null;
  const parsed = parseSession(tool, lines); if (!parsed.turns.some(t => t.role === 'user')) return null;
  return readSessionDetail(sessionDetail(await sessionId(tool, `file/${file.name}/${file.size}/${file.lastModified}`), tool, parsed));
}
