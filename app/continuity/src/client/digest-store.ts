/* Return readings already made, so the same material is never sent again on its own. A reading is found only by the exact
 * request (SHA-256 of its JSON: part names and notes, source texts, notes, bases and plan context), the model and the prompt
 * id the server reports; any change to one of them is a different reading. Each entry also keeps the sources it cites, so an
 * earlier reading stays readable after the material grew. Saved projects: one own key in this browser, apart from the project
 * and its plans. Examples: this tab only. Nothing here calls the AI. */
import type { StorageLike } from '../shared/storage.js';
import { DIGEST_SCHEMA, DIGEST_KINDS, validateDigestReply, type DigestAsk, type DigestKind, type DigestReply } from '../shared/digest-api.js';
import type { ReadingInput, ReadingSource } from './digest-source.js';

export const DIGEST_KEY = 'agentflow.studio.digest.1';
const PER_PROJECT = 4, PROJECTS = 30;
export interface Reading {
  /** Earlier cache entries silently cut source text; they cannot establish that the source is complete. */
  sourceVersion: 'complete.1';
  hash: string; model: string; prompt: string; at: string; coverage: { total: number; sent: number };
  /** Reply as made, in the request's aliases. */
  reply: DigestReply;
  /** alias → real part id, and alias → complete cited source as held when sent (with any AI excerpt notice). */
  parts: Record<string, string>; cited: Record<string, ReadingSource>;
}

export async function askHash(ask: DigestAsk): Promise<string> {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(ask)));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
export function makeReading(input: ReadingInput, hash: string, model: string, prompt: string, reply: DigestReply): Reading {
  const refs = new Set([...reply.changes, ...reply.open].flatMap(s => s.refs).concat(reply.read?.refs ?? []));
  const cited: Record<string, ReadingSource> = {};
  for (const r of refs) { const s = input.sources.get(r); if (s) cited[r] = { ...s, partIds: [...s.partIds] }; }
  return { sourceVersion: 'complete.1', hash, model, prompt, at: new Date().toISOString(), coverage: { ...input.coverage }, reply: structuredClone(reply), parts: Object.fromEntries(input.parts), cited };
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
/** A stored entry is used only when it still has the stored shape; anything else is skipped, never repaired. */
function readable(v: unknown): Reading | null {
  if (!isObj(v) || v.sourceVersion !== 'complete.1' || typeof v.hash !== 'string' || !/^[0-9a-f]{64}$/.test(v.hash) || typeof v.model !== 'string' || !v.model.trim() || v.model.length > 200 || typeof v.prompt !== 'string' || !v.prompt.trim() || v.prompt.length > 200
    || typeof v.at !== 'string' || !Number.isFinite(Date.parse(v.at)) || !isObj(v.coverage) || !isObj(v.reply) || !isObj(v.parts) || !isObj(v.cited)) return null;
  const count = (x: unknown): x is number => Number.isSafeInteger(x) && (x as number) >= 0;
  if (!count(v.coverage.total) || !count(v.coverage.sent) || v.coverage.sent > v.coverage.total || v.coverage.sent > 48) return null;
  const partEntries = Object.entries(v.parts), citedEntries = Object.entries(v.cited);
  if (partEntries.length > 200 || citedEntries.length > v.coverage.sent || partEntries.some(([a, id]) => !/^P\d{2,3}$/.test(a) || typeof id !== 'string' || !id.trim())
    || new Set(partEntries.map(([, id]) => id)).size !== partEntries.length) return null;
  const alias = new Map(partEntries.map(([a, id]) => [id, a]));
  const text = (x: unknown, max: number, empty = false): x is string => typeof x === 'string' && x.length <= max && (empty || !!x.trim()) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(x);
  for (const [id, s] of citedEntries) {
    if (!/^[A-Z]{1,2}\d{2,3}$/.test(id) || !isObj(s) || s.id !== id || !DIGEST_KINDS.includes(s.kind as DigestKind)
      || !text(s.title, 200) || !text(s.text, 1_000_000) || !text(s.note, 4000, true) || !text(s.basis, 600)
      || !Array.isArray(s.partIds) || s.partIds.length > 32 || s.partIds.some(p => typeof p !== 'string' || !alias.has(p)) || new Set(s.partIds).size !== s.partIds.length
      || !(s.url === null || (typeof s.url === 'string' && /^https?:\/\//.test(s.url)))) return null;
  }
  const reading = v as unknown as Reading;
  // Previous readings have no current request. Recheck their reply using only the frozen citations and aliases they hold.
  const ask: DigestAsk = { schemaVersion: DIGEST_SCHEMA, project: { name: '보관 정리', purpose: null }, plan: null,
    parts: partEntries.map(([id]) => ({ id, name: id, note: '', parentId: null })),
    sources: Object.values(reading.cited).map(s => ({ ...s, partIds: s.partIds.map(id => alias.get(id)).filter((id): id is string => !!id) })) };
  try { validateDigestReply(reading.reply, ask); return reading; } catch { return null; }
}

export interface DigestStore {
  /** The reading of exactly this request with this model and prompt, re-checked against the request; else null. */
  find(projectId: string, hash: string, ask: DigestAsk, model: string, prompt: string): Reading | null;
  /** Newest reading of the project made from other material (or another model/prompt). */
  previous(projectId: string, hash: string): Reading | null;
  /** null when kept; otherwise the text to show (the reading still shows for this tab). */
  keep(projectId: string, reading: Reading): string | null;
}

export function digestStore(kv: StorageLike | null): DigestStore {
  const memory = new Map<string, Reading[]>();
  const load = (): Record<string, unknown[]> | null => {
    if (!kv) return null;
    try { const raw = kv.getItem(DIGEST_KEY); if (raw === null) return {}; const v = JSON.parse(raw); return isObj(v) && v.version === 'studio.digest-cache.1' && isObj(v.projects) ? v.projects as Record<string, unknown[]> : null; }
    catch { return null; }
  };
  const list = (projectId: string): Reading[] => {
    const mem = memory.get(projectId); if (mem) return mem;
    const all = load(), raw = all && Array.isArray(all[projectId]) ? all[projectId]! : [];
    return raw.map(readable).filter((x): x is Reading => !!x);
  };
  return {
    find(projectId, hash, ask, model, prompt) {
      const hit = list(projectId).find(x => x.hash === hash && x.model === model && x.prompt === prompt);
      if (!hit) return null;
      try { validateDigestReply(hit.reply, ask); return hit; } catch { return null; }
    },
    previous(projectId, hash) { return list(projectId).find(x => x.hash !== hash) ?? null; },
    keep(projectId, reading) {
      const next = [reading, ...list(projectId).filter(x => !(x.hash === reading.hash && x.model === reading.model && x.prompt === reading.prompt))].slice(0, PER_PROJECT);
      memory.set(projectId, next);
      if (!kv) return null;
      const all = load();
      if (!all) return '이 브라우저의 정리 보관 자리를 읽지 못해 새로 저장하지 않았어요. 이 탭에서만 보여요.';
      all[projectId] = next;
      const keys = Object.keys(all); for (const k of keys.slice(0, Math.max(0, keys.length - PROJECTS))) if (k !== projectId) delete all[k];
      try {
        const text = JSON.stringify({ version: 'studio.digest-cache.1', projects: all });
        kv.setItem(DIGEST_KEY, text); if (kv.getItem(DIGEST_KEY) !== text) throw new Error('LOST_WRITE');
        memory.delete(projectId); return null;
      } catch { return '이 브라우저에 정리를 저장하지 못했어요. 이 탭에서만 보여요.'; }
    }
  };
}
