/* Recipe .50 (map-reading.20, Astra F5 Q5 and Q7 step 1): the row-processing ledger. Every current row of a folded 기록 v5 record's tables
 * (record-excerpt.ts v5Folds; the ledgers C-SRC and C-EVID and the page frame C-HEAD, C-SUMMARY, C-DROP and C-END aside) has one state per
 * (record, table, row ID), decided by the newest map reading that sent it:
 * - reflected: an applied item of the reading stands on the row (a part's basis or any field of it, a claim, a relation or a port-map row, a
 *   field of the reading itself), with what it became;
 * - held: an undecided candidate stands on it (identity, parent, attribution, holds), with the parts it names; or a part row it names is held;
 * - rejected: the reading kept it as material, a part row it names was rejected, or it was sent as often as the ledger allows and never placed;
 * - waiting: limit, budget, unresolved-endpoint, transient, or not-yet-sent.
 * Parsed is never reflected: a row inside a read interval with nothing standing on it waits, and buildMapAsk sends it again (resendRows).
 * A reading of map-reading.20 stores what it decided (MapReading.rows); an earlier reading is read by the same rule here, its rows being
 * those past what was read before it and inside its read interval. Nothing here calls a model or changes a project. */
import { isMapReading, type MapReading, type Project, type ReadingExclusion, type ReadingRow, type ReadingRowTarget, type RowState } from './types.js';
import type { FoldRow } from './record-table.js';
import type { V5Fold, ExcerptPiece } from './record-excerpt.js';

/** The tables whose rows are tracked: every table with row IDs but the ledgers and the page frame. */
export const LEDGER_SKIP_TABLES: ReadonlySet<string> = new Set(['C-HEAD', 'C-SUMMARY', 'C-SRC', 'C-EVID', 'C-DROP', 'C-END', 'C-IDENT']);
/** Recipe .50 step 5: the C-IDENT rows are tracked apart: never sent, their state is what the newest reading that weighed them decided
 * (MapReading.identity, map-identity.ts), and they are never sent again. */
export const IDENT_TABLE_ID = 'C-IDENT';
/** A row whose only reason is transient is sent at most three times; any waiting row at most six (limit included); then it is rejected
 * (unplaced). At most 80 earlier rows are sent again by one ask, oldest first; a reading stores at most 2048 row entries. */
export const RESEND_TRANSIENT_MAX = 3, RESEND_ALL_MAX = 6, RESEND_ROWS_MAX = 80, READING_ROWS_MAX = 2048;
/** The new parts and relations a reading may add (map.7 later; map.6 first): a reading that used all of them left the rest waiting (limit). */
const ALLOWANCE = { later: { parts: 12, relations: 16 }, first: { parts: 36, relations: 48 } };
const PART_ID = /(?<![A-Za-z0-9])B\d{1,3}(?!\d)/g;

export interface LedgerRow extends ReadingRow {
  /** The pasted text the row stands in now and its [start, end) there. */
  paste: string; start: number; end: number;
  /** The C-PART row IDs (B…) the row names, its own aside. */
  ends: string[];
  /** The C-PART 이름 cell (C-PART rows), for naming the row. */
  name: string | null;
  /** The reading that decided the row (null: none yet). */
  reading: string | null }
export const ledgerKey = (record: string, table: string, id: string): string => `${record}\u0000${table}\u0000${id}`;

interface Tracked { key: string; record: string; row: FoldRow; ends: string[]; name: string | null }
/** The tracked rows of a fold, in table order then row order. */
export function trackedRows(f: V5Fold): Tracked[] {
  const out: Tracked[] = [];
  for (const [table, rows] of f.fold.rows) {
    if (LEDGER_SKIP_TABLES.has(table)) continue;
    for (const r of rows) {
      const own = table === 'C-PART' ? r.id : null, text = [r.id, ...r.row.cells.map(c => c.text)].join(' ');
      const ends = [...new Set(text.match(PART_ID) ?? [])].filter(b => b !== own);
      out.push({ key: ledgerKey(f.key, table, r.id), record: f.key, row: r, ends, name: table === 'C-PART' ? (r.row.byColumn['이름'] ?? '').trim() || null : null });
    }
  }
  return out;
}

/* ---------- what one reading did with the rows it sent ---------- */
interface Place { record: string; from: number; to: number }
interface Stand extends Place { target: ReadingRowTarget }
interface Hold extends Place { reason: string; with: string[] }
interface Aside extends Place { category: string | null; with: string[] }
/** Recipe .50 step 2: the server's reasons that hold a row for a correction (the obligation and the items on its lines; map-blueprint.mjs). */
export const CORRECTION_HOLDS: ReadonlySet<string> = new Set(['correction-unmet', 'correction-held']);
const isPlace = (v: unknown): v is Place => !!v && typeof v === 'object' && typeof (v as Place).record === 'string' && Number.isSafeInteger((v as Place).from) && Number.isSafeInteger((v as Place).to);
/** Every place a value quotes, however deep. */
function places(v: unknown, out: Place[] = []): Place[] {
  if (Array.isArray(v)) { for (const x of v) places(x, out); return out; }
  if (!v || typeof v !== 'object') return out;
  if (isPlace(v) && typeof (v as { quote?: unknown }).quote === 'string') out.push({ record: v.record, from: v.from, to: v.to });
  for (const x of Object.values(v)) if (x && typeof x === 'object') places(x, out);
  return out;
}
/** The reading's own fields that are not map items, candidates, material or diagnostics. */
const OWN_FIELDS = new Set(['version', 'id', 'at', 'model', 'prompt', 'hash', 'records', 'summary', 'parts', 'relations', 'candidates', 'gaps', 'skipped', 'material', 'exclusions', 'portMap', 'rows', 'identity', 'requests', 'recordDiagnostics', 'obligations', 'pages', 'level', 'firstLines', 'basisAt', 'basisVersion']);
function standing(r: MapReading, heldWith: (x: ReadingExclusion) => string[]): { stands: Stand[]; holds: Hold[]; material: Place[]; asides: Aside[] } {
  const stands: Stand[] = [];
  for (const p of r.parts) {
    for (const [k, v] of Object.entries(p)) {
      if (k === 'claims') { (v as unknown[]).forEach((c, index) => { for (const q of places(c)) stands.push({ ...q, target: { kind: 'claim', id: p.areaId, index } }); }); continue; }
      for (const q of places(v)) stands.push({ ...q, target: { kind: 'part', id: p.areaId, index: null } });
    }
  }
  for (const x of r.relations) for (const q of places(x)) stands.push({ ...q, target: { kind: 'relation', id: x.relationId, index: null } });
  for (const x of r.portMap ?? []) for (const q of places(x)) stands.push({ ...q, target: { kind: 'relation', id: x.relationId, index: null } });
  for (const [k, v] of Object.entries(r)) if (!OWN_FIELDS.has(k)) for (const q of places(v)) stands.push({ ...q, target: { kind: 'reading', id: k, index: null } });
  const holds: Hold[] = r.candidates.flatMap(c => ([c.quote, c.statement?.quote ?? null] as unknown[]).filter(isPlace).map(q => ({ record: q.record, from: q.from, to: q.to, reason: c.target ?? 'identity', with: [...c.areaIds] })));
  const material = (r.material ?? []).map(m => ({ record: m.record, from: m.from, to: m.to }));
  const asides = (r.exclusions ?? []).filter(x => x.record !== null && x.from !== null && x.to !== null).map(x => ({ record: x.record!, from: x.from!, to: x.to!, category: x.category, with: x.category && CORRECTION_HOLDS.has(x.category) ? heldWith(x).slice(0, 4) : [] }));
  return { stands, holds, material, asides };
}
const on = (q: Place, t: Tracked) => q.record === t.row.record && q.from < t.row.row.to && t.row.row.from < q.to;

/** How a reading took the rows: sent (in a piece the ask carried), left (inside its read interval, not sent: left out for room). */
export type Sent = (t: Tracked) => 'sent' | 'left' | null;

/** What reading r decided for the rows it sent or left, given the ledger before it (prior) and whether it was the first map. heldWith (recipe
 * .50 step 2): the part areas a server reason holding a correction stands with (applyReading resolves its part index). */
export function decideRows(rows: readonly Tracked[], r: MapReading, sentOf: Sent, prior: ReadonlyMap<string, LedgerRow>, first: boolean, heldWith: (x: ReadingExclusion) => string[] = () => []): ReadingRow[] {
  const { stands, holds, material, asides } = standing(r, heldWith), allow = first ? ALLOWANCE.first : ALLOWANCE.later;
  const made = r.parts.filter(p => p.created).length, out: ReadingRow[] = [];
  const decided = new Map<string, ReadingRow>(), lazy: { t: Tracked; e: ReadingRow }[] = [];
  for (const t of rows) {
    const how = sentOf(t); if (!how) continue;
    const before = prior.get(t.key), sent = (before?.sent ?? 0) + (how === 'sent' ? 1 : 0);
    const base = { record: t.record, table: t.row.table, id: t.row.id, detail: null as string | null, sent, to: [] as ReadingRowTarget[], with: [] as string[] };
    let e: ReadingRow;
    if (how === 'left') e = { ...base, state: 'waiting', reason: 'budget', detail: before?.detail ?? null };
    else {
      const to = stands.filter(q => on(q, t)).map(q => q.target), hold = holds.find(q => on(q, t));
      const uniq = [...new Map(to.map(x => [`${x.kind}\u0000${x.id}\u0000${x.index}`, x])).values()].slice(0, 8);
      const aside = asides.filter(q => on(q, t)), limit = aside.some(q => q.category === 'count' || q.category === 'new-count');
      if (uniq.length) e = { ...base, state: 'reflected', reason: null, to: uniq };
      else if (hold) e = { ...base, state: 'held', reason: ['identity', 'parent', 'attribution', 'holds'].includes(hold.reason) ? hold.reason : 'identity', with: hold.with.slice(0, 4) };
      // Recipe .50 step 2: a row an unmet correction obligation (or an item on its lines) stands on is held with that unit, not sent again.
      else if (aside.some(q => q.category && CORRECTION_HOLDS.has(q.category))) { const q = aside.find(y => y.category && CORRECTION_HOLDS.has(y.category))!;
        e = { ...base, state: 'held', reason: 'correction', detail: q.category, with: [...new Set(aside.flatMap(y => y.with))].slice(0, 4) }; }
      else if (material.some(q => on(q, t))) e = { ...base, state: 'rejected', reason: 'material' };
      else if (limit) e = { ...base, state: 'waiting', reason: 'limit', detail: 'count' };
      else { e = { ...base, state: 'waiting', reason: 'transient', detail: aside.find(q => q.category)?.category ?? before?.detail ?? null }; if (!aside.length) lazy.push({ t, e }); }
    }
    decided.set(t.key, e); out.push(e);
  }
  // A row with no reason of its own yet: a part row it names that is not reflected (now or before) leaves it waiting on that endpoint; the
  // reading's whole allowance used leaves a part or link row waiting on the limit; else it stays transient.
  const stateOf = (key: string): RowState | null => decided.get(key)?.state ?? prior.get(key)?.state ?? null;
  for (const { t, e } of lazy) {
    const ends = t.ends.map(b => ledgerKey(t.record, 'C-PART', b)).filter(k => prior.has(k) || decided.has(k));
    if (ends.some(k => stateOf(k) !== 'reflected')) { e.reason = 'unresolved-endpoint'; continue; }
    if (t.row.table === 'C-PART' && made >= allow.parts || t.row.table === 'C-LINK' && r.relations.length >= allow.relations) { e.reason = 'limit'; e.detail = null; }
  }
  // Bounded: a row sent as often as allowed is rejected (unplaced); an endpoint wait spends only the overall bound.
  for (const e of out) if (e.state === 'waiting' && e.reason !== 'budget' && (e.sent >= RESEND_ALL_MAX || e.reason === 'transient' && e.sent >= RESEND_TRANSIENT_MAX)) { e.state = 'rejected'; e.reason = 'unplaced'; }
  return out.slice(0, READING_ROWS_MAX);
}

/* ---------- the ledger ---------- */
const anchored = (r: MapReading) => !['map-reading.1', 'map-reading.2', 'map-reading.3'].includes(r.version);
/** Every tracked row of the folds with its state now: the newest reading that decided it wins (a .20 reading's stored entries, an earlier
 * one's read by decideRows on the rows past what was read before it, inside its interval); a row no reading decided waits (not-yet-sent).
 * A waiting row on an endpoint that is held or rejected now carries that (depends). */
export function rowLedger(p: Pick<Project, 'readings'>, folds: readonly V5Fold[]): Map<string, LedgerRow> {
  const out = new Map<string, LedgerRow>(), byPaste = new Map<string, Tracked[]>();
  for (const f of folds) for (const t of trackedRows(f)) {
    out.set(t.key, { record: t.record, table: t.row.table, id: t.row.id, state: 'waiting', reason: 'not-yet-sent', detail: null, sent: 0, to: [], with: [],
      paste: t.row.record, start: t.row.row.from, end: t.row.row.to, ends: t.ends, name: t.name, reading: null });
    byPaste.set(t.row.record, [...byPaste.get(t.row.record) ?? [], t]);
  }
  // Recipe .50 step 5: each C-IDENT row waits until a reading weighs it (it is the program's, so it is never sent).
  for (const f of folds) for (const r of f.fold.rows.get(IDENT_TABLE_ID) ?? []) out.set(ledgerKey(f.key, IDENT_TABLE_ID, r.id), { record: f.key, table: IDENT_TABLE_ID, id: r.id,
    state: 'waiting', reason: 'not-yet-sent', detail: null, sent: 0, to: [], with: [], paste: r.record, start: r.row.from, end: r.row.to, ends: [], name: null, reading: null });
  const all = [...byPaste.values()].flat(), readTo = new Map<string, number>();
  const maps = p.readings.filter(isMapReading);
  maps.forEach((r, i) => {
    const entries = r.rows ?? (anchored(r) ? decideRows(all, r, t => {
      const x = r.records.find(y => y.id === t.row.record);
      return x && t.row.row.from >= (readTo.get(x.id) ?? 0) && t.row.row.from >= x.from && t.row.row.to <= x.to ? 'sent' : null;
    }, out, i === 0) : []);
    for (const e of entries) { const x = out.get(ledgerKey(e.record, e.table, e.id)); if (x) Object.assign(x, { state: e.state, reason: e.reason, detail: e.detail, sent: e.sent, to: structuredClone(e.to), with: [...e.with], reading: r.id }); }
    for (const e of r.identity ?? []) { const x = out.get(ledgerKey(e.record, IDENT_TABLE_ID, e.id)); if (x) Object.assign(x, { state: e.state, reason: e.reason, detail: e.op?.kind ?? null,
      to: e.state === 'reflected' && e.areaId ? [{ kind: 'part' as const, id: e.areaId, index: null }, ...(e.op?.successor ? [{ kind: 'part' as const, id: e.op.successor, index: null }] : [])] : [],
      with: e.state === 'held' && e.areaId ? [e.areaId] : [], reading: r.id }); }
    // Recipe .50 step 2: a row held for a correction is weighed again only when its target changes: a later reading that writes claims on the
    // part it stands with lets it wait (transient) and go again within the send bounds. A re-pasted row is new text and goes anyway.
    // Recipe .50 step 4: a row held on an identity question likewise, when a later reading writes basis or claims on a part it names (the
    // same conflict is not sent again until its target changes).
    for (const x of out.values()) if (x.state === 'held' && x.reading !== r.id && (x.reason === 'correction' && r.parts.some(q => x.with.includes(q.areaId) && q.claims.length)
      || x.reason === 'identity' && r.parts.some(q => x.with.includes(q.areaId) && (q.claims.length || q.basis.length))))
      Object.assign(x, { state: 'waiting', reason: 'transient', detail: x.reason === 'correction' ? 'correction-unmet' : 'identity', with: [] });
    for (const x of r.records) readTo.set(x.id, Math.max(readTo.get(x.id) ?? 0, x.to));
  });
  for (const x of out.values()) {
    if (x.state !== 'waiting' || x.reason !== 'unresolved-endpoint') continue;
    const ends = x.ends.map(b => out.get(ledgerKey(x.record, 'C-PART', b))).filter((y): y is LedgerRow => !!y);
    const held = ends.find(y => y.state === 'held'), gone = ends.find(y => y.state === 'rejected');
    if (held) Object.assign(x, { state: 'held', reason: 'depends', with: [...held.with] });
    else if (gone) Object.assign(x, { state: 'rejected', reason: 'depends' });
  }
  return out;
}

/** Recipe .50 step 4 (row-binding.1, ruling F5 Q7(4)): the row → part mapping, from the ledger (so every reading, old or new, gives it): a
 * C-PART row reflected into exactly one part that is live (live(id)) by a part target (its basis, or a part field standing on the row: type,
 * family, implementation) is bound to that part, by (record, row ID). A row reflected into two parts binds nothing; a claim quoting the row
 * never binds; a name never binds. Keyed as the ledger is (ledgerKey(record, 'C-PART', B…)). */
export function rowBindings(ledger: ReadonlyMap<string, LedgerRow>, live: (id: string) => boolean): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, x] of ledger) {
    if (x.table !== 'C-PART' || x.state !== 'reflected') continue;
    const ids = [...new Set(x.to.filter(t => t.kind === 'part').map(t => t.id))];
    if (ids.length === 1 && live(ids[0]!)) out.set(k, ids[0]!);
  }
  return out;
}
/** The waiting rows an ask sends again: every waiting row that lies before what was read of its pasted text (a row past it goes anyway),
 * the record standing now first (records in `order`, newest first), then oldest first within a record (paste order, then text order), at
 * most RESEND_ROWS_MAX. */
export function resendRows(ledger: ReadonlyMap<string, LedgerRow>, readTo: ReadonlyMap<string, number>, pasteOrder: ReadonlyMap<string, number>, order: readonly string[] = []): LedgerRow[] {
  const rank = (x: LedgerRow) => { const i = order.indexOf(x.record); return i < 0 ? order.length : i; };
  return [...ledger.values()].filter(x => x.state === 'waiting' && x.table !== IDENT_TABLE_ID && x.end <= (readTo.get(x.paste) ?? 0))
    .sort((a, b) => rank(a) - rank(b) || (pasteOrder.get(a.paste) ?? 0) - (pasteOrder.get(b.paste) ?? 0) || a.start - b.start).slice(0, RESEND_ROWS_MAX);
}
/** How a new reading took each tracked row, from the pieces its ask sent: inside a piece, sent; inside its read interval and waiting before
 * it, left (for room). */
export function sentByPieces(refs: readonly { id: string; from: number; to: number; pieces?: readonly ExcerptPiece[] }[], prior: ReadonlyMap<string, LedgerRow>): Sent {
  return t => {
    const own = refs.filter(r => r.id === t.row.record && r.pieces);
    if (own.some(r => r.pieces!.some(p => p.from <= t.row.row.from && t.row.row.to <= p.to))) return 'sent';
    const before = prior.get(t.key);
    return before?.state === 'waiting' && own.some(r => r.from <= t.row.row.from && t.row.row.to <= r.to) ? 'left' : null;
  };
}
/** The ledger in numbers, by state and reason. */
export function ledgerCounts(ledger: ReadonlyMap<string, LedgerRow>): Record<RowState, number> & { reasons: Record<string, number> } {
  const out = { reflected: 0, waiting: 0, held: 0, rejected: 0, reasons: {} as Record<string, number> };
  for (const x of ledger.values()) { out[x.state]++; if (x.reason) out.reasons[`${x.state}:${x.reason}`] = (out.reasons[`${x.state}:${x.reason}`] ?? 0) + 1; }
  return out;
}
