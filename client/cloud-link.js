import { foldRecord } from '../shared/handover.js';
import { RUNTIME } from './runtime.js';
export const CLOUDLINK_KEY = 'agentflow.studio.cloudlink.1';
const TICK_MS = 60 * 1000;
const same = () => RUNTIME.apiBase === '' || RUNTIME.apiBase === 'same-origin';
async function call(path, body = null) {
    const res = await fetch(path, { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: { 'X-AgentFlow-Request': '1', ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    let data = null;
    try {
        data = await res.json();
    }
    catch { /* none */ }
    return { status: res.status, data };
}
export function createCloudLink(host) {
    let state = { kind: 'off' }, busy = false, timer = null, error = null;
    const left = new Map(); // project key -> revision whose handover was left
    function links() { try {
        const v = JSON.parse(host.kv.getItem(CLOUDLINK_KEY) ?? '{}');
        return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    }
    catch {
        return {};
    } }
    function keep(v) { try {
        host.kv.setItem(CLOUDLINK_KEY, JSON.stringify(v));
    }
    catch { /* this page only */ } }
    const linked = (key) => !!links()[key];
    async function load() {
        if (!same()) {
            state = { kind: 'off' };
            return state;
        }
        try {
            const r = await call('/api/connector/me');
            state = r.status === 200 && typeof r.data?.login === 'string' ? { kind: 'in', user: r.data.login, mcp: String(r.data.mcp), pc: String(r.data.pc) } : r.status === 401 && typeof r.data?.login === 'string' ? { kind: 'out', login: r.data.login } : { kind: 'off' };
        }
        catch {
            state = { kind: 'off' };
        }
        host.changed?.();
        return state;
    }
    async function tick() {
        const o = host.current();
        if (busy || state.kind !== 'in' || !o || o.kind !== 'saved' || !linked(o.key))
            return;
        busy = true;
        try {
            const key = o.key;
            const r = await call(`/api/connector/records?project=${encodeURIComponent(key)}&unplaced=1`);
            if (r.status === 401) {
                await load();
                return;
            }
            const records = Array.isArray(r.data?.records) ? r.data.records.filter((x) => typeof x?.id === 'string' && typeof x?.text === 'string') : [];
            if (records.length) {
                const no = await host.save(key, records.map(x => foldRecord(x.text)));
                if (no) {
                    error = no.error;
                    host.changed?.();
                    return;
                }
                await call('/api/connector/ack', { ids: records.map(x => x.id) });
            }
            const now = host.current();
            if (now?.key === key && left.get(key) !== now.project.revision) {
                const text = host.handover();
                if (text && (await call('/api/connector/handover', { key, name: now.project.name, text })).status === 200)
                    left.set(key, now.project.revision);
            }
            error = null;
        }
        catch {
            error = '웹 AI 커넥터에 연결하지 못했어요. 잠시 뒤 다시 해요.';
        }
        finally {
            busy = false;
            host.changed?.();
        }
    }
    async function link(key) { const v = links(); v[key] = { at: new Date().toISOString() }; keep(v); left.delete(key); host.changed?.(); await tick(); }
    async function unlink(key) { const v = links(); delete v[key]; keep(v); left.delete(key); host.changed?.(); if (state.kind === 'in')
        await call('/api/connector/unlink', { key }).catch(() => null); }
    function start() { void load().then(() => tick()); if (!timer)
        timer = setInterval(() => void tick(), TICK_MS); }
    /** The sign-in address that comes back to where the person is now. */
    const loginHref = () => (state.kind === 'out' ? `${state.login}?return=${encodeURIComponent(location.pathname + location.search)}` : '');
    return { state: () => state, error: () => error, linked, link, unlink, start, tick, load, loginHref };
}
