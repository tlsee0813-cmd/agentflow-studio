/* The evidence of a part's current description as read (PartUnderstanding.roleBasis): the passages that description was read on,
 * each once and in order, to be opened where it was read. Only that description's own basis: never a claim's quote standing in
 * for it, never the person's correction (which has none), never a place made up for an earlier reading's quote without one, and
 * never two passages merged for having the same words. No DOM here; app.ts renders it. */
import type { PartUnderstanding } from '../shared/map-reading.js';
import type { ReadingQuote } from '../shared/types.js';

export interface RoleEvidence { count: number; items: { key: string; quote: ReadingQuote; label: string }[] }
/** A short chip label that never ends inside a surrogate pair; the passage itself opens whole and exact. */
const short = (t: string, n = 40) => { if (t.length <= n) return `“${t}”`; const c = t.charCodeAt(n - 1); return `“${t.slice(0, c >= 0xd800 && c <= 0xdbff ? n - 1 : n)}…”`; };
export function roleEvidence(part: string, u: Pick<PartUnderstanding, 'role' | 'corrected' | 'roleBasis'>): RoleEvidence | null {
  if (!u.role || u.corrected || !u.roleBasis.length) return null;
  // The key names the passage where it stands (part, position in the basis, record, place), so the way back focuses this very one.
  const items = u.roleBasis.map((q, i) => ({ key: JSON.stringify(['role', part, i, q.record, q.from ?? null, q.to ?? null]), quote: q, label: short(q.quote) }));
  return { count: items.length, items };
}
