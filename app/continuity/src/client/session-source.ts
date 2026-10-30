/* Where the page gets AI session records from: the local Studio server when it reads this PC's sessions (server/sessions.mjs), or
 * else a folder the person picked in this browser (Chrome/Edge folder access: their .claude or .codex folder), read here with the
 * same reading (shared/session-parse.ts). Nothing is installed and nothing leaves the browser: a folder's files are read only to
 * list and take sessions, and what is kept is what the paste box or the automatic connection then saves as records.
 * The picked folders are remembered in this browser (IndexedDB holds the folder handles); the browser may ask again, with one
 * click, before the page can read them on a later visit. A single file chosen by hand works in every browser. */
import { listSessions, readSession, type AiStatus } from './studio-api.js';
import { readSessionList, readSessionDetail, type SessionDetail, type SessionSummary } from '../shared/session-import.js';
import { SESSION_LIMITS, jsonLines, parseSession, sessionParser, pushLine, withSubagents, tailFolders, hasPrompt, atFolder, sniffTool, sessionSummary, sessionDetail, sessionId, sessionKey, within, type ParsedSession, type SessionTool } from '../shared/session-parse.js';

/** read(id, since): only turns from that time on (a turn with no time is kept), as the server does. */
export interface SessionSource { kind: 'server' | 'folder'; list(folder?: string | null): Promise<SessionSummary[]>; read(id: string, since?: string | null): Promise<SessionDetail> }
export type FolderState = 'unsupported' | 'none' | 'prompt' | 'granted';

/* Minimal shapes of the File System Access handles this file uses (a test may stand in its own). */
interface FileHandle { kind: 'file'; name: string; getFile(): Promise<File> }
interface DirHandle { kind: 'directory'; name: string; values(): AsyncIterable<FileHandle | DirHandle>;
  queryPermission?(o: { mode: 'read' }): Promise<PermissionState>; requestPermission?(o: { mode: 'read' }): Promise<PermissionState>;
  isSameEntry?(other: DirHandle): Promise<boolean>; resolve?(other: DirHandle): Promise<string[] | null> }
type Entry = FileHandle | DirHandle;
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

/** A whole session file read in pieces into the tool's parser: a file of hundreds of MB is never held whole as text. Each piece is
 * looked through once (a line is joined only when its end comes), and a line longer than the server's cap on one line
 * (SESSION_LIMITS.lineBytes, counted here in characters) is skipped, as on the server.
 * With its handle, a file an agent is still writing is read on through a fresh look when the first goes stale (Chrome cannot read
 * a File once the file on disk changed), up to the size it had: a session file only ever has lines added at its end. */
const LINE_CHARS = SESSION_LIMITS.lineBytes, READ_TRIES = 20;
async function readParsed(tool: SessionTool, file: File, handle: FileHandle | null = null): Promise<ParsedSession> {
  const parser = sessionParser(tool), decoder = new TextDecoder(), end = file.size;
  let reader = file.stream().getReader(), at = 0, tries = 0, line: string[] = [], len = 0;
  const take = (s: string) => { len += s.length; if (len > LINE_CHARS) line = []; else line.push(s); };
  const feed = (text: string) => {
    let from = 0;
    for (let nl = text.indexOf('\n'); nl >= 0; from = nl + 1, nl = text.indexOf('\n', from)) { take(text.slice(from, nl)); if (len <= LINE_CHARS) pushLine(parser, line.join('')); line = []; len = 0; }
    take(text.slice(from));
  };
  for (;;) {
    const r = await reader.read().catch(async (e: unknown) => {
      if (!handle || ++tries > READ_TRIES) throw e;
      const now = await handle.getFile(); if (now.size < end) throw e;
      reader = now.slice(at, end).stream().getReader(); return null;
    });
    if (!r) continue; if (r.done) break;
    at += r.value.length; feed(decoder.decode(r.value, { stream: true }));
  }
  feed(decoder.decode()); if (len <= LINE_CHARS) pushLine(parser, line.join(''));
  return parser.done();
}
/** A whole session file, through a fresh look at it. */
async function readFile(h: FileHandle, tool: SessionTool): Promise<ParsedSession> {
  const file = await h.getFile();
  if (file.size > SESSION_LIMITS.fileBytes) throw Object.assign(new Error('SESSION_TOO_LARGE'), { code: 'SESSION_TOO_LARGE' });
  return readParsed(tool, file, h);
}
/** One look at a file through a fresh File (one taken earlier cannot be read once the file changed), tried again if it changed meanwhile. */
async function fresh<T>(h: FileHandle, use: (file: File) => Promise<T>): Promise<T> {
  try { return await use(await h.getFile()); } catch { return use(await h.getFile()); }
}

/** How far a picked folder is walked. The tools' own folders are walked as the server reads them (Codex days newest first), up to
 * WALK_FILES session files; any other folder (one picked by mistake) WALK_DEPTH deep and WALK_ENTRIES entries in all. */
const WALK_DEPTH = 6, WALK_ENTRIES = 20000, WALK_FILES = 20000;
// Never sessions of their own: subagents' transcripts (read with the session that started them).
const SKIP = new Set(['node_modules', 'subagents']);
/** A session file found. path: inside the picked folder, starting with its name (the old id was made of it); key: the same, per
 * picked folder (two may share a name); dir: the folder it lies in (a Claude Code session's subagents are in a folder beside it). */
interface Found { tool: SessionTool | null; path: string; key: string; handle: FileHandle; dir: DirHandle; size: number; at: number }
/** A folder's entries. One that vanished meanwhile (a session folder the tool cleaned up) is skipped; must: it has to be read. */
async function entries(dir: DirHandle, must = false): Promise<Entry[]> {
  const out: Entry[] = [];
  try { for await (const e of dir.values()) out.push(e); } catch (e) { if (must) throw e; }
  return out;
}
const dirs = (list: Entry[]) => list.filter((e): e is DirHandle => e.kind === 'directory');
const named = (list: Entry[], name: string) => dirs(list).find(e => e.name === name);
const newest = (list: Entry[]) => dirs(list).sort((a, b) => (a.name < b.name ? 1 : a.name > b.name ? -1 : 0));
/** The session files of a picked folder (nothing read in them) and whether a bound cut the walk short. The picked folder (or the
 * tools' folders in it) not readable at all rejects. */
async function walk(root: DirHandle, rootKey: string): Promise<{ found: Found[]; cut: boolean }> {
  const found: Found[] = [], top = await entries(root, true); let cut = false, seen = 0;
  const add = async (e: FileHandle, dir: DirHandle, path: string, tool: SessionTool | null) => {
    if (found.length >= WALK_FILES) { cut = true; return; }
    let file: File; try { file = await e.getFile(); } catch { return; }
    if (file.size) found.push({ tool, path: `${root.name}/${path}`, key: `${rootKey}/${path}`, handle: e, dir, size: file.size, at: file.lastModified });
  };
  // Claude Code: projects/<folder>/<session>.jsonl (a session's own subfolder holds its subagents' and tools' files).
  const claude = async (list: Entry[], path: string) => {
    for (const d of dirs(list)) for (const e of await entries(d)) { if (cut) return; if (e.kind === 'file' && e.name.endsWith('.jsonl')) await add(e, d, `${path}${d.name}/${e.name}`, 'claude'); }
  };
  // Codex: sessions/YYYY/MM/DD/rollout-*.jsonl, newest days first, so a bound cuts the oldest. A thread archived in Codex moves to
  // archived_sessions/ with its id: it is read there too (one archived before a look took it is not lost; its id is the same).
  const archived = async (list: Entry[], dir: DirHandle, path: string) => {
    for (const e of list) { if (cut) return; if (e.kind === 'file' && /^rollout-.*\.jsonl$/.test(e.name)) await add(e, dir, `${path}${e.name}`, 'codex'); }
  };
  const codex = async (list: Entry[], path: string) => {
    for (const y of newest(list)) for (const m of newest(await entries(y))) for (const d of newest(await entries(m)))
      for (const e of await entries(d)) { if (cut) return; if (e.kind === 'file' && /^rollout-.*\.jsonl$/.test(e.name)) await add(e, d, `${path}${y.name}/${m.name}/${d.name}/${e.name}`, 'codex'); }
  };
  const tools = async (list: Entry[], path: string) => {
    const p = named(list, 'projects'), s = named(list, 'sessions'), a = named(list, 'archived_sessions');
    if (p) await claude(await entries(p, true), `${path}projects/`); if (s) await codex(await entries(s, true), `${path}sessions/`);
    if (a) await archived(await entries(a), a, `${path}archived_sessions/`);
    return !!(p || s);
  };
  // Any other folder: its .jsonl files, the tool told by where they lie or else by their lines.
  const any = async (dir: DirHandle, list: AsyncIterable<Entry> | Entry[], path: string, depth: number): Promise<void> => {
    try {
      for await (const e of list) {
        if (cut) return; if (++seen > WALK_ENTRIES) { cut = true; return; }
        if (e.kind === 'directory') { if (depth < WALK_DEPTH && !SKIP.has(e.name) && !(depth > 0 && e.name.startsWith('.'))) await any(e, e.values(), `${path}${e.name}/`, depth + 1); continue; }
        if (!e.name.endsWith('.jsonl')) continue;
        const p = `${path}${e.name}`;
        await add(e, dir, p, /(^|\/)projects\//.test(p) ? 'claude' : /(^|\/)sessions\/.*rollout-[^/]*\.jsonl$/.test(p) || /^rollout-/.test(e.name) ? 'codex' : null);
      }
    } catch { /* a folder that vanished meanwhile is skipped */ }
  };
  // The tools' own folder (.claude, .codex, or the projects / sessions folder in them), or a home folder holding them picked instead
  // (looked at first: a home folder may have a projects folder of its own).
  if (root.name === 'projects') await claude(top, '');
  else if (root.name === 'sessions') await codex(top, '');
  else if (root.name === 'archived_sessions') await archived(top, root, '');
  else {
    let home = false;
    for (const n of ['.claude', '.codex']) { const d = named(top, n); if (d && (await tools(await entries(d, true), `${n}/`))) home = true; }
    if (!home && !(await tools(top, ''))) await any(root, top, '', 0);
  }
  return { found, cut };
}
/** Whether a folder just picked is one picked before (folders inside one another are both kept: a walk does not read everything
 * under a folder, and a session found through both is listed once by its id). */
async function same(d: DirHandle, r: DirHandle): Promise<boolean> { try { return !!(await d.isSameEntry?.(r)); } catch { return false; } }

/** What a listing knows of one session file: its row (null when it holds no prompt: not a session, or a Codex subagent's), the
 * folders it worked in, and for a Codex subagent's the session that started it. key: the size and time it was read at. */
interface Head { key: string; tool: SessionTool | null; row: SessionSummary | null; cwds: string[]; parent: string | null }
async function readHead(f: Found, file: File): Promise<Head> {
  const key = `${file.size}:${file.lastModified}`, partial = file.size > SESSION_LIMITS.headBytes, lines = jsonLines(await file.slice(0, SESSION_LIMITS.headBytes).text(), partial);
  const tool = f.tool ?? sniffTool(lines); if (!tool) return { key, tool, row: null, cwds: [], parent: null };
  let parsed = parseSession(tool, lines);
  // Read further while the head holds no prompt yet (a Codex subagent's never does: what it was asked is in the session that started it).
  if (!hasPrompt(parsed) && partial && !parsed.meta.parent) parsed = parseSession(tool, jsonLines(await file.slice(0, SESSION_LIMITS.promptBytes).text(), file.size > SESSION_LIMITS.promptBytes));
  const parent = tool === 'codex' ? parsed.meta.parent : null; if (!hasPrompt(parsed)) return { key, tool, row: null, cwds: [], parent };
  // The end of the file, for a folder the session moved to late.
  if (partial) for (const c of tailFolders(await file.slice(Math.max(0, file.size - SESSION_LIMITS.tailBytes)).text())) atFolder(parsed.meta, c);
  const base = sessionSummary(await sessionId(tool, sessionKey(tool, parsed.meta, f.path)), tool, parsed, new Date(file.lastModified).toISOString(), file.size);
  // The id made from the file's path before ids were made from the session itself.
  return { key, tool, row: base && { ...base, aliases: [await sessionId(tool, f.path)] }, cwds: parsed.meta.cwds, parent };
}
// Files with no session in them (Codex subagents' rollouts, a session left before its first prompt) do not use up the scan of
// SESSION_LIMITS.scan sessions; at most this many of them are opened in one look.
const QUIET_FILES = SESSION_LIMITS.scan * 10;

export function createSessionSources(host: { status(): AiStatus; accessCode(): string }) {
  let roots: DirHandle[] = [], state: FolderState = 'none', loaded: Promise<void> | null = null;
  const picker = (): Picker | null => (typeof window !== 'undefined' && typeof (window as unknown as { showDirectoryPicker?: Picker }).showDirectoryPicker === 'function' ? (window as unknown as { showDirectoryPicker: Picker }).showDirectoryPicker : null);
  // Per file: what its head said, while its size and time stay the same (a look every minute reads only what changed).
  const heads = new Map<string, Head>();
  const known = new Map<string, Found & { tool: SessionTool }>();
  // Per Codex file (and Claude Code agent-*.jsonl): which session started it, when it is a subagent's (from its first lines).
  const parents = new Map<string, { key: string; parent: string | null }>();
  // Each picked folder's own key for those (two picked folders may share a name).
  const rootKeys = new WeakMap<DirHandle, string>(); let rootCount = 0;
  const rootKey = (r: DirHandle) => { let k = rootKeys.get(r); if (!k) rootKeys.set(r, (k = `${++rootCount}`)); return k; };
  // What to say beside the picked folders: why a pick added nothing, and how the last look went (a folder not read, a walk cut short).
  let lastFound: Found[] = [], picked: string | null = null, looked: string | null = null;
  /** The picked folders as named on the page: two of one name (a Windows and a WSL .claude) are told apart by number. */
  const labels = () => roots.map(r => { const same = roots.filter(x => x.name === r.name); return same.length > 1 ? `${r.name} (${same.indexOf(r) + 1})` : r.name; });

  /** The subagent sessions a session started (they begin after it), as the server finds them. Codex: rollouts of the last walk
   * naming it as parent. Claude Code: transcripts kept beside it (<session>/subagents/*.jsonl), or, in earlier versions, agent-*.jsonl
   * in its project folder naming it by its sessionId. Only the files they changed are used. */
  async function subagents(s: Found & { tool: SessionTool }, parsed: ParsedSession): Promise<ParsedSession[]> {
    const out: ParsedSession[] = [], since = Date.parse(parsed.meta.startedAt ?? '') || 0, base = s.handle.name.replace(/\.jsonl$/, '');
    const parent = s.tool === 'codex' ? parsed.meta.thread : base, folder = s.key.slice(0, s.key.lastIndexOf('/') + 1);
    if (!parent) return out;
    // Claude Code's own subagents folder is never walked (its files are not sessions): read here, each file this session's.
    const beside = s.tool === 'claude' ? named(await entries(s.dir), base) : undefined, kept = beside && named(await entries(beside), 'subagents');
    for (const e of kept ? await entries(kept) : []) {
      if (e.kind !== 'file' || !e.name.endsWith('.jsonl')) continue;
      try { if ((await e.getFile()).lastModified >= since) out.push(await readFile(e, 'claude')); } catch { /* too large, changed or gone */ }
    }
    const near = (f: Found) => (s.tool === 'codex' ? f.tool !== 'claude' : f.key.startsWith(folder) && !f.key.includes('/', folder.length) && f.key !== s.key && /^agent-.*\.jsonl$/.test(f.handle.name));
    for (const f of lastFound) {
      if (!near(f) || f.at < since || f.size > SESSION_LIMITS.fileBytes) continue;
      let t = parents.get(f.key);
      // Each file is looked at afresh; one that cannot be read now is left out this time.
      try {
        if (t?.key !== `${f.size}:${f.at}`) t = await fresh(f.handle, async file => {
          const lines = jsonLines(await file.slice(0, SESSION_LIMITS.headBytes).text(), file.size > SESSION_LIMITS.headBytes);
          const sid = s.tool === 'claude' ? lines.map(o => (o as { sessionId?: unknown } | null)?.sessionId).find((x): x is string => typeof x === 'string') ?? null : null;
          return { key: `${file.size}:${file.lastModified}`, parent: s.tool === 'claude' ? sid : (f.tool ?? sniffTool(lines)) === 'codex' ? parseSession('codex', lines).meta.parent : null };
        });
        parents.set(f.key, t);
        if (t.parent === parent) out.push(await readFile(f.handle, s.tool));
      } catch { /* changed or gone meanwhile */ }
    }
    return out;
  }

  async function check(): Promise<FolderState> {
    if (!picker()) return (state = 'unsupported');
    if (!roots.length) return (state = 'none');
    const all = await Promise.all(roots.map(r => r.queryPermission?.({ mode: 'read' }).catch(() => 'prompt' as PermissionState) ?? Promise.resolve('granted' as PermissionState)));
    return (state = all.every(x => x === 'granted') ? 'granted' : 'prompt');
  }
  function load(): Promise<void> { return (loaded ??= (async () => { if (picker()) roots = await loadRoots(); await check(); })()); }

  const server: SessionSource = { kind: 'server', list: (folder = null) => listSessions(host.accessCode(), folder), read: (id, since = null) => readSession(id, host.accessCode(), since) };
  const folderSource: SessionSource = {
    kind: 'folder',
    async list(folder = null) {
      const found: Found[] = [], names = labels(), bad: string[] = []; let cut = false, cause: unknown = null;
      for (const [i, r] of roots.entries()) {
        // A picked folder that cannot be read at all (moved, deleted, a WSL folder while WSL is off) is named on the panel and the
        // others are read; when none can be read the look fails, rather than show folders with no sessions.
        try { const w = await walk(r, rootKey(r)); found.push(...w.found); cut ||= w.cut; } catch (e) { bad.push(names[i]!); cause = e; }
      }
      const unreadable = bad.length ? `${bad.join(', ')} 폴더를 읽지 못했어요.` : null;
      if (roots.length && bad.length === roots.length) { looked = unreadable; throw Object.assign(new Error('SESSION_FOLDER_UNREADABLE'), { code: 'SESSION_FOLDER_UNREADABLE', cause }); }
      found.sort((a, b) => b.at - a.at); lastFound = found;
      const out: SessionSummary[] = [], byId = new Map<string, SessionSummary>(); let sessions = 0, quiet = 0;
      for (const f of found) {
        // At most `scan` session files are opened, so a folder with no session left does not read a whole history.
        if (out.length >= SESSION_LIMITS.list || sessions >= SESSION_LIMITS.scan) break;
        if (quiet >= QUIET_FILES) { cut = true; break; }
        // A changed file is read through a fresh look at it; one that cannot be read now (an agent writing it) keeps what it said
        // before, or waits for the next look.
        let h = heads.get(f.key);
        if (h?.key !== `${f.size}:${f.at}`) h = await fresh(f.handle, file => readHead(f, file)).then(x => { heads.set(f.key, x); return x; }, () => h);
        if (!h) continue;
        if (h.tool === 'codex') parents.set(f.key, { key: h.key, parent: h.parent });
        if (!h.row) { quiet++; continue; }
        sessions++;
        // Two files of one session (picked folders that overlap, a copy left behind): the newest one is the session.
        const had = byId.get(h.row.id);
        if (had) { for (const a of h.row.aliases ?? []) if (!had.aliases?.includes(a)) had.aliases?.push(a); continue; }
        const row: SessionSummary = { ...h.row, aliases: [...(h.row.aliases ?? [])] }; byId.set(row.id, row);
        known.set(row.id, { ...f, tool: row.tool });
        if (folder && !within(h.cwds, folder)) continue;
        out.push(row);
      }
      looked = [unreadable, cut ? '세션 파일이 너무 많아 일부만 읽었어요.' : null].filter(Boolean).join(' ') || null;
      return readSessionList({ version: 'sessions.1', sessions: out });
    },
    async read(id, since = null) {
      if (!known.has(id)) await folderSource.list();
      const f = known.get(id); if (!f) throw Object.assign(new Error('SESSION_NOT_FOUND'), { code: 'SESSION_NOT_FOUND' });
      const parsed = await readFile(f.handle, f.tool);
      const d = readSessionDetail(sessionDetail(id, f.tool, withSubagents(parsed, await subagents(f, parsed)), SESSION_LIMITS, since));
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
    /** The picked folders' names as shown, each one forget() takes. */
    folders: labels,
    /** A short line to show beside the picked folders, or null: why a pick added nothing, a folder that could not be read, or a
     * look that read only part of the folders. */
    notice: (): string | null => [picked, looked].filter(Boolean).join(' ') || null,
    /** Asks the person for a folder (their .claude or .codex). True when one was added. Must run from a click. */
    async pick(): Promise<boolean> {
      const p = picker(); if (!p) return false;
      let d: DirHandle; try { d = await p.call(window, { id: 'af-sessions', mode: 'read' }); } catch { return false; }
      // The same folder picked again adds nothing.
      const at = (await Promise.all(roots.map(r => same(d, r)))).indexOf(true);
      if (at >= 0) { picked = `이미 고른 폴더(${labels()[at]})예요.`; return false; }
      picked = null; roots = [...roots, d];
      heads.clear(); await saveRoots(roots); await check(); return true;
    },
    /** Asks the browser again to let this page read the picked folders. Must run from a click. */
    async grant(): Promise<FolderState> {
      for (const r of roots) { try { await r.requestPermission?.({ mode: 'read' }); } catch { /* still asked */ } }
      return check();
    },
    /** name: one of folders(). */
    async forget(name: string): Promise<void> {
      const i = labels().indexOf(name); if (i < 0) return;
      roots = roots.filter((_, j) => j !== i); picked = null; looked = null; heads.clear(); known.clear(); await saveRoots(roots); await check();
    }
  };
}
export type SessionSources = ReturnType<typeof createSessionSources>;

/** One session file the person chose (any browser): read here, the tool told by its lines. Null when it is not a session file. */
export async function readSessionFile(file: File): Promise<SessionDetail | null> {
  if (file.size > SESSION_LIMITS.fileBytes) throw Object.assign(new Error('SESSION_TOO_LARGE'), { code: 'SESSION_TOO_LARGE' });
  const tool = sniffTool(jsonLines(await file.slice(0, SESSION_LIMITS.headBytes).text(), file.size > SESSION_LIMITS.headBytes)); if (!tool) return null;
  const parsed = await readParsed(tool, file); if (!parsed.turns.some(t => t.role === 'user')) return null;
  return readSessionDetail(sessionDetail(await sessionId(tool, sessionKey(tool, parsed.meta, file.name)), tool, parsed));
}
