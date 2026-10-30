/* Automatic connection: a saved project bound to a working folder takes the new turns of that folder's Claude Code / Codex sessions
 * as pasted records and reads them into the map, without a click. The person connects once (a folder the local server found in
 * the sessions it reads); from then on, while the project is open in this tab, each settled session's new turns are kept as they
 * were written (credential-like parts hidden) and an automatic map reading follows, at most AUTO_RUNS_PER_DAY a day and
 * AUTO_RUN_GAP_MS apart. Nothing is done for a project that is not open: what came meanwhile is taken when it is opened again.
 * The binding and how far each session was taken are kept in this browser beside the project (never in the project data). */
import type { StorageLike } from '../shared/storage.js';
import type { Project } from '../shared/types.js';
import { listSessions, readSession, AskError, ERROR_TEXT, type AiStatus } from './studio-api.js';
import { newTurns, sessionChunks, stamp, TOOL_NAME, SETTLE_MS, AUTO_RUN_GAP_MS, AUTO_RUNS_PER_DAY, BACKFILL_MS, BACKFILL_SESSIONS, type SessionMark, type SessionSummary } from '../shared/session-import.js';
import { h, put } from './plan-dom.js';

export const AUTOSYNC_KEY = 'agentflow.studio.autosync.1';
/** One project's connection. since: sessions updated before it are not taken; backfilled: the first look (recent history) is done. */
export interface Binding { folder: string; connectedAt: string; since: string; backfilled: boolean; marks: Record<string, SessionMark>;
  runs: { day: string; n: number; last: string | null }; taken: number; lastCheck: string | null; error: string | null }

export interface AutoSyncHost {
  current(): { key: string; kind: string; project: Project } | null;
  status(): AiStatus;
  accessCode(): string;
  kv: StorageLike;
  /** Keeps these texts as pasted records of entry `key` (only while it is the one open), in order, in one save; text when not kept. */
  save(key: string, texts: string[]): Promise<string | null>;
  /** A map reading of the open entry could start now with records not read yet (what the person's own click would start). */
  canRead(): boolean;
  read(): void;
  /** Why a map reading cannot be made here (no AI for maps, a limited release), or null. */
  readBlocked(): string | null;
}

const TICK_MS = 60 * 1000;
const day = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

export function createAutoSync(host: AutoSyncHost) {
  let busy = false, timer: ReturnType<typeof setInterval> | null = null, panelOpen = false;
  let folders: { folder: string; count: number; latest: string; tools: Set<string> }[] | null = null, foldersError: string | null = null, foldersLoading = false;
  let typed = '';

  function all(): Record<string, Binding> {
    try { const v = JSON.parse(host.kv.getItem(AUTOSYNC_KEY) ?? '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; }
  }
  function bindingOf(key: string): Binding | null { const b = all()[key]; return b && typeof b.folder === 'string' ? b : null; }
  function put_(key: string, b: Binding | null) {
    const v = all(); if (b) v[key] = b; else delete v[key];
    try { host.kv.setItem(AUTOSYNC_KEY, JSON.stringify(v)); } catch { /* the binding holds for this page only */ }
  }
  const offered = () => !!host.status().sessions?.tools.length;
  const open = () => { const o = host.current(); return o && o.kind === 'saved' ? o : null; };

  /** Looks once at the open project's folder: takes what settled since, then reads the map if it can and may. */
  async function tick(force = false) {
    const o = open(); if (!o || busy || !offered()) return;
    const key = o.key, b = bindingOf(key); if (!b) return;
    busy = true; render();
    try {
      let list: SessionSummary[];
      try { list = await listSessions(host.accessCode(), b.folder); }
      catch (e) { b.error = ERROR_TEXT[e instanceof AskError ? e.code : ''] ?? '세션 기록을 확인하지 못했어요.'; return; }
      const now = Date.now();
      let due = list.filter(s => s.updatedAt >= b.since && b.marks[s.id]?.updatedAt !== s.updatedAt && (force || now - Date.parse(s.updatedAt) >= SETTLE_MS));
      // The first look takes the folder's recent history (newest sessions first); later ones only what changed.
      if (!b.backfilled) due = due.slice(0, BACKFILL_SESSIONS);
      due.reverse(); // oldest first, so records keep the order the work happened in
      const texts: string[] = [], marks: Record<string, SessionMark> = {};
      for (const s of due) {
        let d; try { d = await readSession(s.id, host.accessCode()); } catch { continue; }
        const mark = b.marks[s.id] ?? null, turns = newTurns(d, mark, b.backfilled ? b.connectedAt : null);
        const at = [...d.turns].reverse().find(t => t.at)?.at ?? null;
        marks[s.id] = { lastAt: at ?? mark?.lastAt ?? null, count: d.omitted + d.turns.length, updatedAt: s.updatedAt };
        if (turns.length) texts.push(...sessionChunks(d, turns));
      }
      // Kept only on the entry still open; otherwise nothing is marked and the next look takes the same turns again.
      if (open()?.key !== key) return;
      if (texts.length) { const failed = await host.save(key, texts); if (failed) { b.error = failed; return; } b.taken += texts.length; }
      Object.assign(b.marks, marks); b.backfilled = true; b.error = null;
      if (open()?.key === key && host.canRead() && !host.readBlocked()) {
        const today = day(); if (b.runs.day !== today) b.runs = { day: today, n: 0, last: b.runs.last };
        const gap = !b.runs.last || now - Date.parse(b.runs.last) >= AUTO_RUN_GAP_MS;
        if (b.runs.n < AUTO_RUNS_PER_DAY && gap) { b.runs.n++; b.runs.last = new Date().toISOString(); host.read(); }
      }
    } finally {
      b.lastCheck = new Date().toISOString();
      if (bindingOf(key)) put_(key, b);
      busy = false; render();
    }
  }

  async function loadFolders() {
    if (foldersLoading) return;
    foldersLoading = true; foldersError = null; render();
    try {
      const by = new Map<string, { folder: string; count: number; latest: string; tools: Set<string> }>();
      for (const s of await listSessions(host.accessCode())) {
        if (!s.cwd) continue;
        const f = by.get(s.cwd) ?? { folder: s.cwd, count: 0, latest: s.updatedAt, tools: new Set<string>() };
        f.count++; if (s.updatedAt > f.latest) f.latest = s.updatedAt; f.tools.add(TOOL_NAME[s.tool]); by.set(s.cwd, f);
      }
      folders = [...by.values()].sort((a, b) => b.latest.localeCompare(a.latest));
    } catch (e) { foldersError = ERROR_TEXT[e instanceof AskError ? e.code : ''] ?? '세션 기록을 찾지 못했어요.'; }
    foldersLoading = false; render();
  }
  function connect(folder: string) {
    const o = open(); if (!o || !folder.trim()) return;
    const now = new Date();
    put_(o.key, { folder: folder.trim(), connectedAt: now.toISOString(), since: new Date(now.getTime() - BACKFILL_MS).toISOString(), backfilled: false, marks: {},
      runs: { day: day(now), n: 0, last: null }, taken: 0, lastCheck: null, error: null });
    panelOpen = false; render(); void tick(true);
  }
  function disconnect() { const o = open(); if (!o) return; put_(o.key, null); render(); }

  /* ---------- the bar's pill and its panel ---------- */
  function render() {
    const pill = document.getElementById('sync-pill'), panel = document.getElementById('sync-panel');
    if (!pill || !panel) return;
    const o = open();
    if (!o || !offered()) { pill.hidden = true; panel.hidden = true; return; }
    const b = bindingOf(o.key), name = b ? b.folder.split(/[\\/]/).filter(Boolean).pop() ?? b.folder : null;
    pill.hidden = false; pill.dataset.state = !b ? 'off' : b.error ? 'error' : busy ? 'busy' : 'on';
    pill.setAttribute('aria-expanded', String(panelOpen));
    pill.replaceChildren(h('i', { 'aria-hidden': 'true' }), h('span', {}, b ? `자동 연결 · ${name}` : '자동 연결 안 됨'));
    panel.hidden = !panelOpen; if (!panelOpen) return;
    panel.replaceChildren();
    if (b) {
      const runs = b.runs.day === day() ? b.runs.n : 0;
      put(panel, h('h3', {}, '작업 폴더에 자동 연결됨'), h('p', { class: 'sync-folder' }, b.folder),
        h('p', { class: 'fine' }, `이 폴더의 Claude Code·Codex 대화가 잠잠해지면(약 ${SETTLE_MS / 60000}분) 기록으로 들어오고 지도가 자동으로 갱신돼요. 이 탭이 열려 있을 때만 확인하고, 닫혀 있던 동안의 대화는 다시 열면 들어와요.`),
        h('dl', { class: 'sync-facts' }, h('dt', {}, '가져온 기록'), h('dd', {}, `${b.taken}개`), h('dt', {}, '마지막 확인'), h('dd', {}, b.lastCheck ? stamp(b.lastCheck, true) : busy ? '확인 중…' : '아직'),
          h('dt', {}, '오늘 자동 지도 갱신'), h('dd', {}, `${runs} / ${AUTO_RUNS_PER_DAY}회`)),
        host.readBlocked() ? h('p', { class: 'fine sync-blocked' }, `기록은 들어오지만 지도는 갱신하지 않아요: ${host.readBlocked()}`) : null,
        b.error ? h('p', { class: 'pp-error', role: 'alert' }, b.error) : null,
        h('div', { class: 'pp-row' }, h('button', { type: 'button', class: 'secondary small', disabled: busy, onclick: () => void tick(true) }, busy ? '확인 중…' : '지금 확인'),
          h('button', { type: 'button', class: 'link-button quiet sync-off', onclick: disconnect }, '연결 끊기')));
      return;
    }
    if (!folders && !foldersLoading && !foldersError) void loadFolders();
    const input = h('input', { type: 'text', class: 'sync-path', placeholder: '작업 폴더 경로 (예: C:\\work\\salon)', 'aria-label': '작업 폴더 경로', value: typed }) as HTMLInputElement;
    input.addEventListener('input', () => { typed = input.value; });
    put(panel, h('h3', {}, '작업 폴더 자동 연결'),
      h('p', { class: 'fine' }, `이 프로젝트를 작업 폴더 하나에 묶어요. 그 폴더의 최근 대화(${BACKFILL_MS / 86400000}일, 세션 ${BACKFILL_SESSIONS}개까지)로 첫 지도를 만들고, 이후 대화도 저절로 들어와요. 사람이 쓴 요청과 AI의 답변·바꾼 파일만 원문 그대로 가져와요.`),
      foldersLoading ? h('p', { class: 'fine' }, '이 PC의 세션에서 작업 폴더를 찾는 중…') : null,
      foldersError ? h('p', { class: 'pp-error', role: 'alert' }, foldersError) : null,
      folders && !folders.length ? h('p', { class: 'fine' }, '이 PC에서 Claude Code·Codex 세션을 찾지 못했어요. 폴더 경로를 직접 적을 수도 있어요.') : null,
      folders?.length ? h('ul', { class: 'sync-folders' }, ...folders.slice(0, 12).map(f => h('li', {}, h('button', { type: 'button', class: 'sync-folder-pick', onclick: () => connect(f.folder) },
        h('strong', {}, f.folder), h('small', {}, `${[...f.tools].join('·')} 세션 ${f.count}개 · 최근 ${stamp(f.latest, true)}`))))) : null,
      h('div', { class: 'pp-row sync-manual' }, input, h('button', { type: 'button', class: 'secondary small', onclick: () => connect(typed) }, '연결')));
  }
  function toggle() { panelOpen = !panelOpen; if (panelOpen) { folders = null; foldersError = null; } render(); }
  function close() { if (panelOpen) { panelOpen = false; render(); } }

  return {
    /** The open project or the server's status changed: redraw, and look at once when it is a connected project. */
    opened() { panelOpen = false; render(); if (open() && bindingOf(open()!.key)) void tick(); },
    start() {
      if (timer === null) timer = setInterval(() => { if (document.visibilityState === 'visible') void tick(); }, TICK_MS);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void tick(); });
    },
    toggle, close, render, tick, bindingOf, connect, disconnect
  };
}
