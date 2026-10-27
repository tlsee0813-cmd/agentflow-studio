import { DIGEST_SCHEMA, DIGEST2_SCHEMA, DIGEST_KINDS, validateDigestReply } from '../shared/digest-api.js';
export const DIGEST_KEY = 'agentflow.studio.digest.1';
const PER_PROJECT = 4, PROJECTS = 30;
export async function askHash(ask) {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(ask)));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
export function makeReading(input, hash, model, prompt, reply) {
    const refs = new Set([...reply.changes, ...reply.open].flatMap(s => s.refs).concat(reply.read?.refs ?? [], (reply.recordReadings ?? []).map(x => x.ref)));
    const cited = {};
    for (const r of refs) {
        const s = input.sources.get(r);
        if (s)
            cited[r] = { ...s, partIds: [...s.partIds] };
    }
    return { sourceVersion: 'complete.1', hash, model, prompt, at: new Date().toISOString(), coverage: { ...input.coverage }, reply: structuredClone(reply), parts: Object.fromEntries(input.parts), cited };
}
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
/** A stored entry is used only when it still has the stored shape; anything else is skipped, never repaired. */
function readable(v) {
    if (!isObj(v) || v.sourceVersion !== 'complete.1' || typeof v.hash !== 'string' || !/^[0-9a-f]{64}$/.test(v.hash) || typeof v.model !== 'string' || !v.model.trim() || v.model.length > 200 || typeof v.prompt !== 'string' || !v.prompt.trim() || v.prompt.length > 200
        || typeof v.at !== 'string' || !Number.isFinite(Date.parse(v.at)) || !isObj(v.coverage) || !isObj(v.reply) || !isObj(v.parts) || !isObj(v.cited))
        return null;
    const count = (x) => Number.isSafeInteger(x) && x >= 0;
    if (!count(v.coverage.total) || !count(v.coverage.sent) || v.coverage.sent > v.coverage.total || v.coverage.sent > 48)
        return null;
    const partEntries = Object.entries(v.parts), citedEntries = Object.entries(v.cited);
    if (partEntries.length > 200 || citedEntries.length > v.coverage.sent || partEntries.some(([a, id]) => !/^P\d{2,3}$/.test(a) || typeof id !== 'string' || !id.trim())
        || new Set(partEntries.map(([, id]) => id)).size !== partEntries.length)
        return null;
    const alias = new Map(partEntries.map(([a, id]) => [id, a]));
    const text = (x, max, empty = false) => typeof x === 'string' && x.length <= max && (empty || !!x.trim()) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(x);
    for (const [id, s] of citedEntries) {
        if (!/^[A-Z]{1,2}\d{2,3}$/.test(id) || !isObj(s) || s.id !== id || !DIGEST_KINDS.includes(s.kind)
            || !text(s.title, 200) || !text(s.text, 1_000_000) || !text(s.note, 4000, true) || !text(s.basis, 600)
            || !Array.isArray(s.partIds) || s.partIds.length > 32 || s.partIds.some(p => typeof p !== 'string' || !alias.has(p)) || new Set(s.partIds).size !== s.partIds.length
            || !(s.url === null || (typeof s.url === 'string' && /^https?:\/\//.test(s.url))))
            return null;
        // A pasted record: never located, and how much of it was sent (its quotes are checked against that excerpt only).
        if (s.kind === 'record' && (s.partIds.length || typeof s.recordId !== 'string' || !Number.isSafeInteger(s.sent) || s.sent < 1 || s.sent > s.text.length))
            return null;
    }
    const reading = v;
    // Previous readings have no current request. Recheck their reply using only the frozen citations and aliases they hold.
    const two = isObj(v.reply) && Object.hasOwn(v.reply, 'recordReadings');
    const ask = { schemaVersion: two ? DIGEST2_SCHEMA : DIGEST_SCHEMA, project: { name: '보관 정리', purpose: null }, plan: null,
        parts: partEntries.map(([id]) => ({ id, name: id, note: '', parentId: null })),
        sources: Object.values(reading.cited).map(s => ({ id: s.id, kind: s.kind, title: s.title, text: s.kind === 'record' ? s.text.slice(0, s.sent) : s.text, note: s.note, basis: s.basis,
            partIds: s.partIds.map(id => alias.get(id)).filter((id) => !!id) })) };
    try {
        validateDigestReply(reading.reply, ask);
        return reading;
    }
    catch {
        return null;
    }
}
export function digestStore(kv) {
    const memory = new Map();
    const load = () => {
        if (!kv)
            return null;
        try {
            const raw = kv.getItem(DIGEST_KEY);
            if (raw === null)
                return {};
            const v = JSON.parse(raw);
            return isObj(v) && v.version === 'studio.digest-cache.1' && isObj(v.projects) ? v.projects : null;
        }
        catch {
            return null;
        }
    };
    const list = (key, legacy) => {
        const mem = memory.get(key);
        if (mem)
            return mem;
        const all = load(), own = all && Object.hasOwn(all, key) ? all[key] : legacy !== null && all && Object.hasOwn(all, legacy) ? all[legacy] : null;
        return (Array.isArray(own) ? own : []).map(readable).filter((x) => !!x);
    };
    return {
        find(key, legacy, hash, ask, model, prompt) {
            const hit = list(key, legacy).find(x => x.hash === hash && x.model === model && x.prompt === prompt);
            if (!hit)
                return null;
            try {
                validateDigestReply(hit.reply, ask);
                return hit;
            }
            catch {
                return null;
            }
        },
        previous(key, legacy, hash) { return list(key, legacy).find(x => x.hash !== hash) ?? null; },
        keep(key, legacy, reading) {
            const next = [reading, ...list(key, legacy).filter(x => !(x.hash === reading.hash && x.model === reading.model && x.prompt === reading.prompt))].slice(0, PER_PROJECT);
            memory.set(key, next);
            if (!kv)
                return null;
            const all = load();
            if (!all)
                return '이 브라우저의 정리 보관 자리를 읽지 못해 새로 저장하지 않았어요. 이 탭에서만 보여요.';
            all[key] = next;
            const keys = Object.keys(all);
            for (const k of keys.slice(0, Math.max(0, keys.length - PROJECTS)))
                if (k !== key)
                    delete all[k];
            try {
                const text = JSON.stringify({ version: 'studio.digest-cache.1', projects: all });
                kv.setItem(DIGEST_KEY, text);
                if (kv.getItem(DIGEST_KEY) !== text)
                    throw new Error('LOST_WRITE');
                memory.delete(key);
                return null;
            }
            catch {
                return '이 브라우저에 정리를 저장하지 못했어요. 이 탭에서만 보여요.';
            }
        }
    };
}
