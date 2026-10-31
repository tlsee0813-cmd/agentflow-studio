/* Automatic connection: a saved project bound to a working folder takes the new turns of that folder's Claude Code / Codex sessions
 * as pasted records and reads them into the map, without a click. The person connects once (a working folder found in the sessions
 * the local server reads, or, with no such server, in the .claude / .codex folder they picked in this browser: session-source.ts);
 * from then on, while the project is open in this tab, each settled session's new turns are kept as they
 * were written (credential-like parts hidden) and an automatic map reading follows, at most AUTO_RUNS_PER_DAY a day and
 * AUTO_RUN_GAP_MS apart. Nothing is done for a project that is not open: what came meanwhile is taken when it is opened again.
 * Each session is saved on its own and marked only once kept; a project that can take no more stops with one lasting message.
 * The binding and how far each session was taken are kept in this browser beside the project (never in the project data). */
import type { StorageLike } from '../shared/storage.js';
import type { Project } from '../shared/types.js';
import { ERROR_TEXT } from './studio-api.js';
import type { SessionSources } from './session-source.js';
import { newTurns, markAfter, leftSince, sessionText, sessionChunks, stamp, TOOL_NAME, SETTLE_MS, AUTO_RUN_GAP_MS, AUTO_RUNS_PER_DAY, BACKFILL_MS, BACKFILL_SESSIONS, type SessionDetail, type SessionMark, type SessionSummary } from '../shared/session-import.js';
import { h, put } from './plan-dom.js';

export const AUTOSYNC_KEY = 'agentflow.studio.autosync.1';
/** One working folder of a project. since: its sessions updated before it are not taken; backfilled: its first look (recent
 * history) is done. A project can have several (a front end and a server in two repositories, say): each comes in the same way. */
export interface FolderLink { path: string; connectedAt: string; since: string; backfilled: boolean }
/** One project's connection: its folders, how far each session was taken (by session, whichever folder it came through). With no
 * folders it is not connected, but its marks stay: connecting again goes on from them instead of taking every session again. */
export interface Binding { folders: FolderLink[]; marks: Record<string, SessionMark>;
  runs: { day: string; n: number; last: string | null }; taken: number; lastCheck: string | null; error: string | null }
const folderName = (path: string) => path.split(/[\\/]/).filter(Boolean).pop() ?? path;
/** A session begun at or after its folder was connected. */
const begunSince = (s: SessionSummary, f: FolderLink) => !!s.startedAt && Date.parse(s.startedAt) >= Date.parse(f.connectedAt);
/** A binding as kept: the first form (one folder in place) is read as a binding with that one folder. */
function readBinding(v: unknown): Binding | null {
  const b = v as Partial<Binding> & { folder?: unknown; connectedAt?: unknown; since?: unknown; backfilled?: unknown } | null;
  if (!b || typeof b !== 'object' || !b.marks || !b.runs) return null;
  if (Array.isArray(b.folders)) return b as Binding;
  if (typeof b.folder !== 'string') return null;
  const { folder, connectedAt, since, backfilled, ...rest } = b;
  return { ...rest, folders: [{ path: folder, connectedAt: String(connectedAt), since: String(since), backfilled: !!backfilled }] } as Binding;
}
/** Which of two marks of one session is further on (the later one wins, so an older copy never takes a session back). */
const further = (m: SessionMark, was: SessionMark | undefined) => !was || (m.lastAt ?? '') > (was.lastAt ?? '') || ((m.lastAt ?? '') === (was.lastAt ?? '') && m.updatedAt >= was.updatedAt);

export interface AutoSyncHost {
  current(): { key: string; kind: string; project: Project } | null;
  sources: SessionSources;
  kv: StorageLike;
  /** Keeps these texts (one session's) as pasted records of entry `key` (only while it is the one open), in order, in one save.
   * Not kept: why, and whether only these texts were refused (the next session can still be kept) or nothing can be saved now. */
  save(key: string, texts: string[]): Promise<{ error: string; refused: boolean } | null>;
  /** Why the open entry can take no more records (it holds as many, or as much, as a project can), or null. */
  full(): string | null;
  /** A map reading of the open entry could start now with records not read yet (what the person's own click would start). */
  canRead(): boolean;
  read(): void;
  /** Why a map reading cannot be made here (no AI for maps, a limited release), or null. */
  readBlocked(): string | null;
}

const TICK_MS = 60 * 1000;
/** How many readings of one session a look makes at most (each within the reading's budget); what is left waits for the next. */
const PAGES = 8;
const day = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

export function createAutoSync(host: AutoSyncHost) {
  let busy = false, again = false, timer: ReturnType<typeof setInterval> | null = null, panelOpen = false;
  let folders: { folder: string; count: number; latest: string; tools: Set<string> }[] | null = null, foldersError: string | null = null, foldersLoading = false;
  let typed = '', adding = false;
  // Projects whose last look in this tab could not save: no look runs for them until the person asks ('지금 확인', connecting).
  const halted = new Map<string, string>();

  function all(): Record<string, Binding> {
    try { const v = JSON.parse(host.kv.getItem(AUTOSYNC_KEY) ?? '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; }
  }
  /** The project's connection, or null when it has no folder (its marks may still be kept: stored). */
  function bindingOf(key: string): Binding | null { const b = stored(key); return b?.folders.length ? b : null; }
  function stored(key: string): Binding | null { return readBinding(all()[key]); }
  /** A session's mark, also one kept under an id the session had before (made from its file's path). */
  const markOf = (b: Binding, s: SessionSummary): SessionMark | null => b.marks[s.id] ?? s.aliases?.map(a => b.marks[a]).find(m => !!m) ?? null;
  /** Whether this folder is still linked as it was when a look began (the person may have left it, or ended the connection). */
  const stillLinked = (key: string, f: FolderLink) => !!stored(key)?.folders.some(x => x.path === f.path && x.connectedAt === f.connectedAt);
  /** One session's mark onto the binding as it is now, where it is further on (its old ids' marks give way to it). */
  function keepMark(key: string, s: SessionSummary, m: SessionMark) {
    const cur = stored(key); if (!cur) return;
    for (const id of s.aliases ?? []) delete cur.marks[id];
    if (further(m, cur.marks[s.id])) cur.marks[s.id] = m;
    put_(key, cur);
  }
  /** Marks kept under an id a listed session had before move to its id now, whether or not it is read this time: once its file
   * moves (Codex archives a thread) the id its old path gave is no longer listed with it. */
  function adopt(key: string, list: SessionSummary[]) {
    const cur = stored(key); if (!cur) return; let moved = false;
    for (const s of list) for (const a of s.aliases ?? []) {
      const m = cur.marks[a]; if (!m) continue;
      if (further(m, cur.marks[s.id])) cur.marks[s.id] = m;
      delete cur.marks[a]; moved = true;
    }
    if (moved) put_(key, cur);
  }
  function put_(key: string, b: Binding | null) {
    const v = all(); if (b) v[key] = b; else delete v[key];
    try { host.kv.setItem(AUTOSYNC_KEY, JSON.stringify(v)); } catch { /* the binding holds for this page only */ }
  }
  const offered = () => host.sources.offered();
  const failText = (e: unknown, fallback: string) => ERROR_TEXT[(e as { code?: string } | null)?.code ?? ''] ?? fallback;
  const open = () => { const o = host.current(); return o && o.kind === 'saved' ? o : null; };

  /** Looks once at the open project's folder: takes what settled since, then reads the map if it can and may. */
  async function tick(force = false) {
    const o = open(); if (!o || !offered()) return;
    // A look asked for while one runs (a folder just added, '지금 확인') follows it instead of being dropped.
    if (busy) { if (force) again = true; return; }
    const key = o.key, b = bindingOf(key), src = host.sources.current(); if (!b || !src) return;
    // A look that could not save waits for the person: the same sessions are not read again every minute.
    if (halted.has(key) && !force) return;
    halted.delete(key);
    busy = true; render();
    // What this look did, and only that, goes onto the binding at its end: the marks of the sessions it kept, what it took.
    const marks: Record<string, SessionMark> = {}, moved: string[] = [], kept = new Set<string>(), whole = new Set<FolderLink>(), due: { s: SessionSummary; f: FolderLink; history: boolean }[] = [];
    let taken = 0, ran: string | null = null, error: string | null | undefined;
    try {
      // A project that can take no more is not read at all (its records can still be read into the map).
      const now = Date.now(), seen = new Set<string>(), full = host.full();
      let failed: string | null = full;
      for (const f of full ? [] : b.folders) {
        let list: SessionSummary[];
        try { list = await src.list(f.path); }
        catch (e) { failed = `${folderName(f.path)}: ${failText(e, '세션 기록을 확인하지 못했어요.')}`; continue; }
        adopt(key, list);
        // A picked folder that could not be read is said, and the first look of this folder is not done until it can be.
        const missed = src.partial?.() ?? null; if (missed) failed = missed;
        // Folders inside one another list the same session once.
        let mine = list.filter(s => !seen.has(s.id) && s.updatedAt >= f.since);
        // A folder's first look takes its recent history (newest sessions first, those taken already counted); later ones only what
        // changed. A session taken from before, or worked in since the folder was connected, is always followed.
        const history = new Set(f.backfilled ? [] : mine.slice(0, BACKFILL_SESSIONS).filter(s => !begunSince(s, f)).map(s => s.id));
        if (!f.backfilled) mine = mine.filter(s => history.has(s.id) || !!markOf(b, s) || Date.parse(s.updatedAt) >= Date.parse(f.connectedAt));
        mine = mine.filter(s => markOf(b, s)?.updatedAt !== s.updatedAt);
        const ready = mine.filter(s => force || now - Date.parse(s.updatedAt) >= SETTLE_MS);
        // Its first look is done only when every one of them was read and kept: one still being written is taken whole later.
        if (ready.length === mine.length && !missed) whole.add(f);
        for (const s of mine) seen.add(s.id);
        for (const s of ready) due.push({ s, f, history: history.has(s.id) });
      }
      due.sort((x, y) => x.s.updatedAt.localeCompare(y.s.updatedAt)); // oldest first, so records keep the order the work happened in
      sessions: for (const { s, f, history } of due) {
        // Any session but the first look's history is work done since the folder was connected: taken whole, from the connection on.
        const from = history ? null : f.connectedAt;
        // A mark of nothing taken (an empty reading, as marked before) is no mark: read from the connection, or as history.
        let was = markOf(b, s); if (was && !was.lastAt && !was.count && !was.reply) was = null;
        let first = !was && history;
        // A reading from a mark sends the turns after it oldest first within its budget; the rest is read from the new mark, a few
        // pages a look (a long stretch since the last look is taken whole, over several looks if need be).
        for (let page = 0; page < PAGES; page++) {
          // Read from the mark on (the reply taken last comes back too, in case it went on); a new session from the connection on.
          let d: SessionDetail;
          try { d = await src.read(s.id, was ? was.lastAt : from); }
          catch (e) { failed = `${folderName(f.path)}: ${failText(e, '세션 기록을 읽지 못했어요.')}`; continue sessions; }
          let turns = newTurns(d, was, from);
          // A first look takes one record of each session's newest turns; later ones every new turn, in as many records as it takes.
          // A history session worked in since the connection gives its history up to the connection; the work since is read on from
          // there, as a later look reads it.
          const upTo = first && Date.parse(s.updatedAt) >= Date.parse(f.connectedAt) ? new Date(Date.parse(f.connectedAt) - 1).toISOString() : null;
          if (upTo) turns = turns.filter(t => !t.at || t.at <= upTo);
          const texts = !turns.length ? [] : first ? [sessionText({ ...d, turns }).text] : sessionChunks(d, turns, undefined, leftSince(d, was));
          if (texts.length) {
            // Kept only on the entry still open; otherwise nothing is marked and the next look takes the same turns again. A folder the
            // person left meanwhile (or the connection they ended) takes nothing more.
            if (open()?.key !== key) return;
            if (!stillLinked(key, f)) continue sessions;
            const no = await host.save(key, texts);
            // A text refused leaves only its session to be taken again; anything else stops this look (and the next, until asked).
            if (no?.refused) { failed = no.error; continue sessions; }
            if (no) { error = no.error; halted.set(key, no.error); return; }
            taken += texts.length;
          }
          // More to read when the reading left newer turns and moved on; until they are read the mark does not match the file's
          // time, so the next look comes back to this session even if it does not change.
          // Its history taken, it is marked at its last turn before the connection (a reply still being written then goes on from
          // there), or at the connection when the reading held none.
          const end = upTo ? (turns.length ? markAfter({ ...d, turns }, null, '') : { lastAt: upTo, count: 0, updatedAt: '' }) : markAfter(d, was, s.updatedAt, from);
          const more = !!upTo || (!first && !!d.rest && end.lastAt !== (was?.lastAt ?? null)), next = more ? { ...end, updatedAt: '' } : end;
          // Marked as soon as it is kept: a tab closed later in this look does not take these turns again.
          keepMark(key, s, next); marks[s.id] = next; moved.push(...s.aliases ?? []); kept.add(s.id);
          if (!more) break;
          was = next; first = false;
        }
      }
      error = failed;
      const runs = stored(key)?.runs ?? b.runs, today = day(), n = runs.day === today ? runs.n : 0;
      // A connection ended meanwhile starts no reading: what it kept before then is read by the person's own click.
      if (open()?.key === key && bindingOf(key) && host.canRead() && !host.readBlocked() && n < AUTO_RUNS_PER_DAY && (!runs.last || now - Date.parse(runs.last) >= AUTO_RUN_GAP_MS)) {
        ran = new Date().toISOString(); host.read();
      }
    } finally {
      // Onto the binding as it is now (another tab, or the person, may have changed it meanwhile): a mark only where it is further
      // on, a folder's first look done only when all of it was kept, a folder added or left meanwhile kept as the person left it.
      const cur = stored(key);
      if (cur) {
        for (const id of moved) delete cur.marks[id];
        for (const [id, m] of Object.entries(marks)) if (further(m, cur.marks[id])) cur.marks[id] = m;
        for (const f of cur.folders) if ([...whole].some(x => x.path === f.path && x.connectedAt === f.connectedAt) && due.every(x => x.f.path !== f.path || kept.has(x.s.id))) f.backfilled = true;
        cur.taken += taken; cur.lastCheck = new Date().toISOString(); if (error !== undefined) cur.error = error;
        if (ran) { const today = day(); cur.runs = { day: today, n: (cur.runs.day === today ? cur.runs.n : 0) + 1, last: ran }; }
        put_(key, cur);
      }
      busy = false; render();
      if (again) { again = false; void tick(true); }
    }
  }

  async function loadFolders() {
    const src = host.sources.current(); if (foldersLoading || !src) return;
    foldersLoading = true; foldersError = null; render();
    try {
      const by = new Map<string, { folder: string; count: number; latest: string; tools: Set<string> }>();
      for (const s of await src.list()) {
        if (!s.cwd) continue;
        const f = by.get(s.cwd) ?? { folder: s.cwd, count: 0, latest: s.updatedAt, tools: new Set<string>() };
        f.count++; if (s.updatedAt > f.latest) f.latest = s.updatedAt; f.tools.add(TOOL_NAME[s.tool]); by.set(s.cwd, f);
      }
      folders = [...by.values()].sort((a, b) => b.latest.localeCompare(a.latest));
    } catch (e) { foldersError = failText(e, '세션 기록을 찾지 못했어요.'); }
    foldersLoading = false; render();
  }
  /** Connects the open project to a folder: the first one makes the connection, another is added to it (once). */
  function connect(folder: string) {
    // A path copied from Windows Explorer ('경로로 복사', Ctrl+Shift+C) comes in quotes: the folder is what is inside them.
    const o = open(), path = folder.trim().replace(/^(["'])(.+)\1$/, '$2').trim(); if (!o || !path) return;
    const now = new Date(), link: FolderLink = { path, connectedAt: now.toISOString(), since: new Date(now.getTime() - BACKFILL_MS).toISOString(), backfilled: false };
    // Connecting again after the connection ended goes on from the sessions' marks kept with it.
    const b = stored(o.key);
    if (b) { if (!b.folders.some(f => f.path === path)) b.folders.push(link); if (b.folders.length === 1) b.error = null; put_(o.key, b); }
    else put_(o.key, { folders: [link], marks: {}, runs: { day: day(now), n: 0, last: null }, taken: 0, lastCheck: null, error: null });
    panelOpen = false; adding = false; typed = ''; render(); void tick(true);
  }
  /** Leaves one folder (its records stay); the last one leaving ends the connection (the marks stay with the project). */
  function removeFolder(path: string) {
    const o = open(), b = o ? bindingOf(o.key) : null; if (!o || !b) return;
    b.folders = b.folders.filter(f => f.path !== path); if (!b.folders.length) { b.error = null; halted.delete(o.key); } put_(o.key, b); render();
  }
  function disconnect() {
    const o = open(), b = o ? stored(o.key) : null; if (!o) return;
    if (b) { b.folders = []; b.error = null; put_(o.key, b); }
    halted.delete(o.key); adding = false; render();
  }

  /* ---------- the bar's pill and its panel ---------- */
  function render() {
    const pill = document.getElementById('sync-pill'), panel = document.getElementById('sync-panel');
    if (!pill || !panel) return;
    const o = open();
    if (!o || !offered()) { pill.hidden = true; panel.hidden = true; return; }
    const b = bindingOf(o.key), name = b ? `${folderName(b.folders[0]!.path)}${b.folders.length > 1 ? ` 외 ${b.folders.length - 1}` : ''}` : null;
    // Connected, but the picked session folders wait for this browser's permission again (a later visit): said on the pill.
    const waiting = !!b && !host.sources.current(), error = b ? halted.get(o.key) ?? b.error : null;
    pill.hidden = false; pill.dataset.state = !b ? 'off' : error || waiting ? 'error' : busy ? 'busy' : 'on';
    pill.setAttribute('aria-expanded', String(panelOpen));
    pill.replaceChildren(h('i', { 'aria-hidden': 'true' }), h('span', {}, b ? `자동 연결 · ${name}${waiting ? ' · 허용 필요' : ''}` : '자동 연결 안 됨'));
    panel.hidden = !panelOpen; if (!panelOpen) return;
    // A redraw (a look starting or ending, the folders found) keeps a path being typed in focus, caret and all.
    const typing = panel.querySelector<HTMLInputElement>('.sync-path'), caret = typing && document.activeElement === typing ? [typing.selectionStart, typing.selectionEnd] as const : null;
    panel.replaceChildren();
    const setup = sourceSetup();
    if (b && !adding) {
      const runs = b.runs.day === day() ? b.runs.n : 0;
      put(panel, h('h3', {}, '작업 폴더에 자동 연결됨'),
        h('ul', { class: 'sync-linked' }, ...b.folders.map(f => h('li', {}, h('span', { class: 'sync-folder' }, f.path),
          b.folders.length > 1 ? h('button', { type: 'button', class: 'link-button quiet sync-remove', 'aria-label': `${f.path} 연결 빼기`, onclick: () => removeFolder(f.path) }, '빼기') : null))),
        h('p', { class: 'fine' }, `${b.folders.length > 1 ? '이 폴더들' : '이 폴더'}의 Claude Code·Codex 대화가 잠잠해지면(약 ${SETTLE_MS / 60000}분) 기록으로 들어오고 지도가 자동으로 갱신돼요(그때 기록을 AI에게 보내요). 이 탭이 열려 있을 때만 확인하고, 닫혀 있던 동안의 대화는 다시 열면 들어와요.`),
        h('dl', { class: 'sync-facts' }, h('dt', {}, '가져온 기록'), h('dd', {}, `${b.taken}개`), h('dt', {}, '마지막 확인'), h('dd', {}, b.lastCheck ? stamp(b.lastCheck, true) : busy ? '확인 중…' : '아직'),
          h('dt', {}, '오늘 자동 지도 갱신'), h('dd', {}, `${runs} / ${AUTO_RUNS_PER_DAY}회`)),
        host.readBlocked() ? h('p', { class: 'fine sync-blocked' }, `기록은 들어오지만 지도는 갱신하지 않아요: ${host.readBlocked()}`) : null,
        error ? h('p', { class: 'pp-error', role: 'alert' }, error) : null,
        setup,
        h('div', { class: 'pp-row' }, h('button', { type: 'button', class: 'secondary small', disabled: busy || waiting, onclick: () => void tick(true) }, busy ? '확인 중…' : '지금 확인'),
          h('button', { type: 'button', class: 'link-button sync-add', onclick: () => { adding = true; folders = null; foldersError = null; render(); } }, '폴더 추가'),
          h('button', { type: 'button', class: 'link-button quiet sync-off', onclick: disconnect }, '연결 끊기')));
      return;
    }
    const linked = new Set(b?.folders.map(f => f.path) ?? []), picks = folders?.filter(f => !linked.has(f.folder)) ?? null;
    // No source yet: the session folders are picked (or allowed again) first.
    if (!host.sources.current()) {
      put(panel, h('h3', {}, '내 AI 세션 연결'), setup,
        b ? h('button', { type: 'button', class: 'link-button quiet', onclick: () => { adding = false; render(); } }, '취소') : null);
      return;
    }
    // Looking the folders up draws the panel itself (its loading state, then the list).
    if (!folders && !foldersLoading && !foldersError) { void loadFolders(); return; }
    const input = h('input', { type: 'text', class: 'sync-path', placeholder: '작업 폴더 경로 (예: C:\\work\\salon)', 'aria-label': '작업 폴더 경로', value: typed }) as HTMLInputElement;
    input.addEventListener('input', () => { typed = input.value; });
    put(panel, h('h3', {}, b ? '작업 폴더 추가' : '작업 폴더 자동 연결'),
      h('p', { class: 'fine' }, b ? '저장소가 나뉜 프로젝트라면 다른 작업 폴더도 함께 묶어요. 그 폴더의 세션도 같은 방식으로 들어오고, 지도에서 부분마다 어느 세션이 다뤘는지 보여요.'
        : `이 프로젝트를 작업 폴더에 묶어요. 그 폴더의 최근 대화(${BACKFILL_MS / 86400000}일, 세션 ${BACKFILL_SESSIONS}개까지)로 첫 지도를 만들고, 이후 대화도 저절로 들어와요. 사람이 쓴 요청과 AI의 답변·바꾼 파일만 원문 그대로 가져오고, 키·토큰처럼 보이는 부분은 가려요. 지도를 갱신할 때 이 기록을 AI에게 보내요. 저장소가 여러 개라면 연결한 뒤 폴더를 더할 수 있어요.`),
      foldersLoading ? h('p', { class: 'fine' }, '이 PC의 세션에서 작업 폴더를 찾는 중…') : null,
      foldersError ? h('p', { class: 'pp-error', role: 'alert' }, foldersError) : null,
      picks && !picks.length ? h('p', { class: 'fine' }, b ? '세션이 있는 다른 작업 폴더를 찾지 못했어요. 폴더 경로를 직접 적을 수도 있어요.' : '이 PC에서 Claude Code·Codex 세션을 찾지 못했어요. 폴더 경로를 직접 적을 수도 있어요.') : null,
      picks?.length ? h('ul', { class: 'sync-folders' }, ...picks.slice(0, 12).map(f => h('li', {}, h('button', { type: 'button', class: 'sync-folder-pick', onclick: () => connect(f.folder) },
        h('strong', {}, f.folder), h('small', {}, `${[...f.tools].join('·')} 세션 ${f.count}개 · 최근 ${stamp(f.latest, true)}`))))) : null,
      h('div', { class: 'pp-row sync-manual' }, input, h('button', { type: 'button', class: 'secondary small', onclick: () => connect(typed) }, '연결')),
      setup,
      b ? h('button', { type: 'button', class: 'link-button quiet', onclick: () => { adding = false; render(); } }, '취소') : null);
    if (caret) { input.focus({ preventScroll: true }); input.setSelectionRange(caret[0], caret[1]); }
  }
  /** Where sessions come from when no local server reads them: the .claude / .codex folders picked in this browser. Null with a
   * server (it reads this PC's own folders). */
  function sourceSetup(): HTMLElement | null {
    const src = host.sources; if (src.usesServer()) return null;
    const state = src.folderState(), names = src.folders();
    // A pick that added nothing (the folder is already read) says why, under the picked folders.
    const pick = async () => { if (await src.pick()) { folders = null; foldersError = null; render(); void tick(true); } else render(); };
    const grant = async () => { await src.grant(); folders = null; foldersError = null; render(); void tick(true); };
    if (state === 'unsupported') return null;
    if (state === 'none') return h('div', { class: 'sync-source' },
      h('p', { class: 'fine' }, '설치 없이 이 브라우저가 AI 세션 기록을 직접 읽어요. Claude Code 앱·CLI는 사용자 폴더의 .claude, Codex 앱·CLI는 .codex 폴더를 골라 주세요. 둘 다 쓰면 하나씩 두 번 고르면 돼요. 폴더는 이 브라우저 안에서만 읽어요. 거기서 가져온 대화는 이 프로젝트의 기록이 되고, 지도를 갱신할 때(자동 갱신도) AI에게 보내요.'),
      h('button', { type: 'button', class: 'primary small sync-pick-root', onclick: () => void pick() }, '세션 폴더 고르기'));
    return h('div', { class: 'sync-source' },
      h('p', { class: 'fine' }, `읽는 세션 폴더: ${names.join(', ')}`),
      src.notice() ? h('p', { class: 'fine sync-source-notice' }, src.notice()) : null,
      state === 'prompt' ? h('p', { class: 'fine sync-blocked' }, '브라우저가 이 폴더를 다시 읽어도 되는지 물어봐야 해요.') : null,
      h('div', { class: 'pp-row' },
        state === 'prompt' ? h('button', { type: 'button', class: 'primary small sync-grant', onclick: () => void grant() }, '다시 허용') : null,
        h('button', { type: 'button', class: 'link-button sync-pick-root', onclick: () => void pick() }, '세션 폴더 더 고르기'),
        ...names.map(n => h('button', { type: 'button', class: 'link-button quiet', 'aria-label': `${n} 세션 폴더 빼기`, onclick: async () => { await src.forget(n); folders = null; render(); void tick(true); } }, `${n} 빼기`))));
  }
  function toggle() { panelOpen = !panelOpen; adding = false; if (panelOpen) { folders = null; foldersError = null; } render(); }
  function close() { if (panelOpen) { panelOpen = false; adding = false; render(); } }

  return {
    /** The open project or the server's status changed: redraw, and look at once when it is a connected project. */
    opened() { panelOpen = false; adding = false; render(); if (open() && bindingOf(open()!.key)) void tick(); },
    /** The picked session folders were looked up (or the server's status came): redraw. */
    sourcesChanged() { folders = null; foldersError = null; render(); },
    start() {
      if (timer === null) timer = setInterval(() => { if (document.visibilityState === 'visible') void tick(); }, TICK_MS);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void tick(); });
    },
    toggle, close, render, tick, bindingOf, connect, removeFolder, disconnect
  };
}
