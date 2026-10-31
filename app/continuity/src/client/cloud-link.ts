/* The web AI connector, on a site that offers it (server/cloud-connector.mjs, same origin): the person signs in with GitHub, links a
 * project, and adds this site's /mcp address to claude.ai as a connector. While a linked project is open in this tab, the records
 * web AI sessions left for it (or for no project yet) come in as pasted records once a minute, and its handover document is left
 * for those sessions whenever the project changed. Which projects are linked is kept in this browser; the records and the
 * handover sit with the person's account until they are taken. */
import type { StorageLike } from '../shared/storage.js';
import type { Project } from '../shared/types.js';
import { foldRecord } from '../shared/handover.js';
import { RUNTIME } from './runtime.js';

export const CLOUDLINK_KEY = 'agentflow.studio.cloudlink.1';
export type CloudState = { kind: 'off' } | { kind: 'out'; login: string } | { kind: 'in'; user: string; mcp: string; pc: string };
export interface CloudHost {
  current(): { key: string; kind: string; project: Project } | null;
  kv: StorageLike;
  /** Keeps these texts as records of entry `key` (only while it is open); an error says why not. */
  save(key: string, texts: string[]): Promise<{ error: string } | null>;
  /** The open project's handover document, or null. */
  handover(): string | null;
  changed?(): void;
}
const TICK_MS = 60 * 1000;
const same = () => RUNTIME.apiBase === '' || RUNTIME.apiBase === 'same-origin';

async function call(path: string, body: unknown = null): Promise<{ status: number; data: any }> {
  const res = await fetch(path, { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: { 'X-AgentFlow-Request': '1', ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  let data: any = null; try { data = await res.json(); } catch { /* none */ }
  return { status: res.status, data };
}

export function createCloudLink(host: CloudHost) {
  let state: CloudState = { kind: 'off' }, busy = false, timer: ReturnType<typeof setInterval> | null = null, error: string | null = null;
  const left = new Map<string, number>(); // project key -> revision whose handover was left
  function links(): Record<string, { at: string }> { try { const v = JSON.parse(host.kv.getItem(CLOUDLINK_KEY) ?? '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; } }
  function keep(v: Record<string, { at: string }>) { try { host.kv.setItem(CLOUDLINK_KEY, JSON.stringify(v)); } catch { /* this page only */ } }
  const linked = (key: string) => !!links()[key];

  async function load() {
    if (!same()) { state = { kind: 'off' }; return state; }
    try {
      const r = await call('/api/connector/me');
      state = r.status === 200 && typeof r.data?.login === 'string' ? { kind: 'in', user: r.data.login, mcp: String(r.data.mcp), pc: String(r.data.pc) } : r.status === 401 && typeof r.data?.login === 'string' ? { kind: 'out', login: r.data.login } : { kind: 'off' };
    } catch { state = { kind: 'off' }; }
    host.changed?.();
    return state;
  }
  async function tick() {
    const o = host.current(); if (busy || state.kind !== 'in' || !o || o.kind !== 'saved' || !linked(o.key)) return;
    busy = true;
    try {
      const key = o.key;
      const r = await call(`/api/connector/records?project=${encodeURIComponent(key)}&unplaced=1`);
      if (r.status === 401) { await load(); return; }
      const records: { id: string; text: string }[] = Array.isArray(r.data?.records) ? r.data.records.filter((x: any) => typeof x?.id === 'string' && typeof x?.text === 'string') : [];
      if (records.length) {
        const no = await host.save(key, records.map(x => foldRecord(x.text)));
        if (no) { error = no.error; host.changed?.(); return; }
        await call('/api/connector/ack', { ids: records.map(x => x.id) });
      }
      const now = host.current();
      if (now?.key === key && left.get(key) !== now.project.revision) {
        const text = host.handover();
        if (text && (await call('/api/connector/handover', { key, name: now.project.name, text })).status === 200) left.set(key, now.project.revision);
      }
      error = null;
    } catch { error = '웹 AI 커넥터에 연결하지 못했어요. 잠시 뒤 다시 해요.'; }
    finally { busy = false; host.changed?.(); }
  }
  async function link(key: string) { const v = links(); v[key] = { at: new Date().toISOString() }; keep(v); left.delete(key); host.changed?.(); await tick(); }
  async function unlink(key: string) { const v = links(); delete v[key]; keep(v); left.delete(key); host.changed?.(); if (state.kind === 'in') await call('/api/connector/unlink', { key }).catch(() => null); }
  function start() { void load().then(() => tick()); if (!timer) timer = setInterval(() => void tick(), TICK_MS); }
  /** The sign-in address that comes back to where the person is now. */
  const loginHref = () => (state.kind === 'out' ? `${state.login}?return=${encodeURIComponent(location.pathname + location.search)}` : '');
  return { state: () => state, error: () => error, linked, link, unlink, start, tick, load, loginHref };
}
export type CloudLink = ReturnType<typeof createCloudLink>;
