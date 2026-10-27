/* Return readings already made, so the same material is never sent again on its own. A reading is found only by the exact
 * request (SHA-256 of its JSON: part names and notes, source texts, notes, bases and plan context), the model and the prompt
 * id the server reports; any change to one of them is a different reading. Each entry also keeps the sources it cites, so an
 * earlier reading stays readable after the material grew. Saved projects: one own key in this browser, apart from the project
 * and its plans. Examples: this tab only. Nothing here calls the AI. */
import type { StorageLike } from '../shared/storage.js';
import { validateDigestReply, type DigestAsk, type DigestReply } from '../shared/digest-api.js';
import type { ReadingInput, ReadingSource } from './digest-source.js';

export const DIGEST_KEY = 'agentflow.studio.digest.1';
const PER_PROJECT = 4, PROJECTS = 30, CITED_CHARS = 2000;
export interface Reading {
  hash: string; model: string; prompt: string; at: string; coverage: { total: number; sent: number };
  /** Reply as made, in the request's aliases. */
  reply: DigestReply;
  /** alias → real part id, and alias → cited source as it read then (text cut to CITED_CHARS) */
  parts: Record<string, string>; cited: Record<string, ReadingSource>;
}

export async function askHash(ask: DigestAsk): Promise<string> {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(ask)));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
export function makeReading(input: ReadingInput, hash: string, model: string, prompt: string, reply: DigestReply): Reading {
  const refs = new Set([...reply.changes, ...reply.open].flatMap(s => s.refs).concat(reply.read?.refs ?? []));
  const cited: Record<string, ReadingSource> = {};
  for (const r of refs) { const s = input.sources.get(r); if (s) cited[r] = { ...s, partIds: [...s.partIds], text: s.text.slice(0, CITED_CHARS) }; }
  return { hash, model, prompt, at: new Date().toISOString(), coverage: { ...input.coverage }, reply: structuredClone(reply), parts: Object.fromEntries(input.parts), cited };
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
/** A stored entry is used only when it still has the stored shape; anything else is skipped, never repaired. */
function readable(v: unknown): Reading | null {
  if (!isObj(v) || typeof v.hash !== 'string' || !/^[0-9a-f]{64}$/.test(v.hash) || typeof v.model !== 'string' || typeof v.prompt !== 'string'
    || typeof v.at !== 'string' || !Number.isFinite(Date.parse(v.at)) || !isObj(v.coverage) || !isObj(v.reply) || !isObj(v.parts) || !isObj(v.cited)) return null;
  return v as unknown as Reading;
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
