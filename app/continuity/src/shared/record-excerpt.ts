/* Recipe .47: what a map ask sends of a 기록 v5 record. A v5 record is written as many pages, several of them pasted again later (the
 * later text of a page replaces the earlier, C-DROP takes rows away, 교체 rows replace earlier ones), so its pasted texts hold far more
 * than the record says now. The ask sends the record's fold instead of its newest pastes cut at a length: for each pasted text, the
 * lines of the current page texts it holds (each page's head line, every current row of the record's tables, the ledger rows those
 * rows cite, each table's title and header lines, the page's 쪽 끝 rows and closing lines, any other line written on the page), never a
 * page text a later paste replaced, a row C-DROP took away or a later 교체 replaced, a C-DROP table, or a ledger row no sent row cites.
 * The lines go exactly as pasted, in their order, as pieces of the pasted text; where the pasted text has lines that are not sent
 * between two pieces, one line stands in their place: an empty row 「| |」 inside a table, a blank line elsewhere (no anchored range of a
 * v5 record crosses either: map-reading.ts crossesGap).
 * Rows left out for room are said (left), never left out silently. Nothing here calls a model. */
import { foldPages, readRecordTables, recordVersion, rowKey, V5_TABLE_DEFS, type FoldedRecord, type FoldRow, type RecordTables } from './record-table.js';

/** One sent piece: [from, to) of the pasted text, standing at `at` of the excerpt. */
export interface ExcerptPiece { at: number; from: number; to: number }
/** How a line goes: a row of a queue (left out for room by the budget only), a ledger row (when a sent line cites it), a table line
 * (title, header and rule: when its table sends a line), a line that always goes (page head, 쪽 끝, closing and other written lines), a
 * blank line (when the lines on both sides go). */
type LineKind = 'row' | 'ledger' | 'table' | 'always' | 'blank';
interface Line { from: number; to: number; page: number; kind: LineKind; table: number | null; tableId: string | null; rowId: string | null; key: string | null; queue: 1 | 2 | 3 | null; cites: string[] }
/** One pasted text of the fold: the lines of its current pages in order, and those pages. */
export interface FoldPaste { id: string; text: string; pages: number[]; lines: Line[] }
/** A row that may be left out for room, in the order rows are left out (Q3 first, then the least central Q2 rows). */
export interface Droppable { key: string; table: string; id: string; paste: string; page: number; queue: 2 | 3 }
/** A run of the record's pages one pasted text holds in a row (the record's pages in order: the first-structure pages first). One
 * goes as one record of the ask, so the ask reads the record's pages in their order (Q1, Q2, then the supplementary pages). */
export interface PageRun { paste: FoldPaste; pages: number[]; from: number; to: number }
export interface V5Fold { key: string; recordId: string; fold: FoldedRecord;
  /** The pasted texts that hold a current page, by their first page (the first-structure pages first). */
  pastes: FoldPaste[];
  /** The record's current pages in order, as runs of pages one text holds in a row. */
  runs: PageRun[];
  /** Pasted texts of this record holding no current page (every page of theirs replaced by a later text, or held after a gap). */
  stale: string[];
  /** Pages held after a gap (not folded), and pages a later text replaced (each once). */
  held: number[]; replaced: number[];
  droppable: Droppable[] }

/** The line standing for rows left out between two lines of one table: an empty row (no reader takes it for a data row). */
export const GAP_ROW = '| |\n';
/** The texts that may stand between two pieces of an excerpt (after a piece that ends its line, or one that does not). */
export const GAPS: readonly string[] = ['\n', '\n\n', GAP_ROW, `\n${GAP_ROW}`];
const CITE = /(?<![A-Za-z0-9])([FE]\d{1,3})(?![\dA-Za-z])/g, PART_ID = /(?<![A-Za-z0-9])B\d{1,3}(?![\d])/g;
const citesOf = (s: string): string[] => [...new Set([...s.matchAll(CITE)].map(m => m[1]!))];
const lineEnd = (t: string, from: number): number => { const nl = t.indexOf('\n', from); return nl < 0 ? t.length : nl; };

/** The lines of one pasted text the fold's current pages hold, each with what decides whether it goes. */
function pasteLines(id: string, text: string, f: FoldedRecord, rt: RecordTables): Line[] {
  const regions = f.pages.filter(p => p.record === id).map(p => [p.from, p.to, p.n] as const).sort((a, b) => a[0] - b[0]);
  const current = new Map<number, FoldRow>();
  for (const l of f.rows.values()) for (const r of l) if (r.record === id) current.set(r.row.from, r);
  for (const r of f.head.values()) if (r.record === id) current.set(r.row.from, r);
  // Where each table's lines stand: its title, its '|' lines that are no data row (header, rule, a row past the header's width), its
  // rows, its body lines and its 「없음:」 line.
  const at = new Map<number, { table: number; role: 'title' | 'struct' | 'row' | 'body' | 'none' }>();
  rt.tables.forEach((t, i) => {
    at.set(t.from, { table: i, role: 'title' });
    for (const r of t.rows) at.set(r.from, { table: i, role: 'row' });
    for (const b of t.body) at.set(b.from, { table: i, role: 'body' });
    if (t.none) at.set(t.none.from, { table: i, role: 'none' });
    for (let o = t.from; o <= t.to && o < text.length;) {
      const e = lineEnd(text, o), raw = text.slice(o, e), s = raw.trim(), start = o + raw.indexOf(s);
      if (s.startsWith('|') && !at.has(start)) at.set(start, { table: i, role: 'struct' });
      o = e + 1;
    }
  });
  const out: Line[] = [];
  for (const [a, b, page] of regions) for (let o = a; o < b;) {
    const lineFrom = o, e = Math.min(lineEnd(text, o), b), raw = text.slice(o, e), s = raw.trim(), start = o + raw.indexOf(s), end = Math.min(e + 1, b);
    const place = s ? at.get(start) : undefined, table = place ? rt.tables[place.table]! : null;
    const def = table && table.dialect === 'v5' && table.known ? V5_TABLE_DEFS.get(table.id) : undefined;
    const line = (kind: LineKind, extra: Partial<Line> = {}): Line => ({ from: lineFrom, to: end, page, kind, table: place?.table ?? null, tableId: table?.id ?? null, rowId: null, key: null, queue: null, cites: citesOf(s), ...extra });
    o = e + 1;
    if (!s) { out.push(line('blank', { cites: [] })); continue; }
    // A line of no table, and a table no reader knows, go as written (the program keeps an unknown table as written too).
    if (!place || !table || !def) { out.push(line('always')); continue; }
    // C-DROP's work is done in the fold: what it took away is not sent, so neither is the table.
    if (table.id === 'C-DROP') continue;
    if (place.role === 'title' || place.role === 'struct') { out.push(line('table')); continue; }
    if (place.role === 'body' || place.role === 'none' || table.id === 'C-END') { out.push(line('always')); continue; }
    // A row the fold does not hold now (a later 교체 replaced it, C-DROP took it away, an extra) is not sent.
    const r = current.get(start); if (!r) continue;
    if (table.id === 'C-SRC' || table.id === 'C-EVID') out.push(line('ledger', { rowId: r.id, key: rowKey(r.table, r.id) }));
    else out.push(line('row', { rowId: r.id, key: `${id}@${start}`, queue: def.queue === 3 ? 3 : def.queue === 2 ? 2 : 1 }));
  }
  return out;
}

/** Every v5 record among the pasted texts (as pasted, oldest first), folded, with what each of its pasted texts holds now. */
export function v5Folds(pasted: readonly { id: string; text: string }[]): V5Fold[] {
  const list = pasted.filter(p => recordVersion(p.text) === 'v5');
  if (!list.length) return [];
  return foldPages(list.map(p => ({ record: p.id, text: p.text })), 'paste').map(f => {
    const own = list.filter(p => readRecordTables(p.text).pages.some(h => `${h.recordId}@${h.basis}` === f.key));
    const pastes: FoldPaste[] = own.map(p => ({ id: p.id, text: p.text, pages: f.pages.filter(x => x.record === p.id).map(x => x.n).sort((a, b) => a - b), lines: pasteLines(p.id, p.text, f, readRecordTables(p.text)) }))
      .filter(x => x.pages.length).sort((a, b) => a.pages[0]! - b.pages[0]!);
    // Room is made by leaving out Q3 rows first (the last first), then the Q2 rows naming the least connected parts (a part's degree:
    // the current rows that name it), the later row first among equals.
    const degree = new Map<string, number>();
    for (const l of f.rows.values()) for (const r of l) for (const b of new Set(r.row.cells.map(c => c.text).join(' ').match(PART_ID) ?? [])) degree.set(b, (degree.get(b) ?? 0) + 1);
    const rows = (q: 2 | 3) => pastes.flatMap(p => p.lines.filter(l => l.kind === 'row' && l.queue === q).map(l => ({ l, p })));
    const d = ({ l, p }: { l: Line; p: FoldPaste }): Droppable => ({ key: l.key!, table: l.tableId!, id: l.rowId!, paste: p.id, page: l.page, queue: l.queue as 2 | 3 });
    const centre = ({ l, p }: { l: Line; p: FoldPaste }) => Math.max(0, ...(p.text.slice(l.from, l.to).match(PART_ID) ?? []).map(b => degree.get(b) ?? 0));
    const q2 = rows(2).map((x, i) => ({ x, c: centre(x), i })).sort((a, b) => a.c - b.c || b.i - a.i).map(y => d(y.x));
    const runs: PageRun[] = [];
    for (const pg of [...f.pages].sort((a, b) => a.n - b.n)) {
      const last = runs.at(-1), paste = pastes.find(x => x.id === pg.record)!;
      if (last && last.paste === paste && last.pages.at(-1) === pg.n - 1) { last.pages.push(pg.n); last.from = Math.min(last.from, pg.from); last.to = Math.max(last.to, pg.to); }
      else runs.push({ paste, pages: [pg.n], from: pg.from, to: pg.to });
    }
    return { key: f.key, recordId: f.recordId, fold: f, pastes, runs, stale: own.filter(p => !pastes.some(x => x.id === p.id)).map(p => p.id),
      held: f.held.map(h => h.n), replaced: [...new Set(f.replaced.map(r => r.n))], droppable: [...rows(3).reverse().map(d), ...q2] };
  });
}

export interface PasteExcerpt { id: string; text: string; pieces: ExcerptPiece[]; rows: number; left: Droppable[];
  /** Recipe .50: the rows of `again` this excerpt sends (rows an earlier reading read without placing them: row-ledger.ts), by key. */
  again: string[];
  /** Cut at `cap`: where the pasted text's lines not sent this time begin (the rest is read next time), and the rows among them. */
  cut: number | null; cutRows: number }
/** What one pasted text of a fold sends: its rows from `sent.get(id)` on (rows an earlier reading read are not sent again; page head,
 * table and closing lines go wherever they stand), the rows in `leave` left out, and the ledger rows the rows sent from every text in
 * `sent` cite; with `cap`, only its lines up to the last whole line within cap characters (cut). null when nothing of it would go.
 * Recipe .50: the rows of `again` (by line key, `paste@offset`) go too wherever they stand (an earlier reading read them and placed
 * nothing of them), and so do the ledger rows they cite. */
export function pasteExcerpt(v: V5Fold, paste: FoldPaste, leave: ReadonlySet<string> = new Set(), sent: ReadonlyMap<string, number> = new Map(v.pastes.map(p => [p.id, 0])), cap = Infinity, pages: readonly number[] | null = null, again: ReadonlySet<string> = new Set()): PasteExcerpt | null {
  const from = sent.get(paste.id) ?? 0;
  const goes = (p: FoldPaste, l: Line) => sent.has(p.id) && (l.kind === 'always' || (l.kind === 'row' && !leave.has(l.key!) && (l.from >= sent.get(p.id)! || again.has(l.key!))));
  const resent = paste.lines.some(l => l.kind === 'row' && again.has(l.key!) && (!pages || pages.includes(l.page)));
  // The ledger rows any sent row cites (a row of one text may cite a ledger row of another), and the F rows a cited E row's 출처 names.
  const cited = new Set<string>();
  for (const p of v.pastes) for (const l of p.lines) if (goes(p, l)) for (const c of l.cites) cited.add(c);
  for (const p of v.pastes) for (const l of p.lines) if (l.kind === 'ledger' && l.rowId!.startsWith('E') && cited.has(l.rowId!)) for (const c of l.cites) cited.add(c);
  // Recipe .47: with `pages`, only the lines of those pages (one run of the record's pages).
  const lines = pages ? paste.lines.filter(l => pages.includes(l.page)) : paste.lines, keep = lines.map(l => goes(paste, l) || (l.kind === 'ledger' && cited.has(l.rowId!) && (l.from >= from || resent)));
  // A table's title and header lines go when the table sends a line.
  const used = new Set<number>(); lines.forEach((l, i) => { if (keep[i] && l.table !== null) used.add(l.table); });
  lines.forEach((l, i) => { if (l.kind === 'table' && used.has(l.table!)) keep[i] = true; });
  // A blank line goes when the lines on both sides of it go (it is the record's own paragraph break).
  const near = (i: number, step: 1 | -1) => { for (let j = i + step; j >= 0 && j < lines.length; j += step) if (lines[j]!.kind !== 'blank') return j; return -1; };
  lines.forEach((l, i) => { if (l.kind === 'blank') { const a = near(i, -1), b = near(i, 1); keep[i] = a >= 0 && b >= 0 && keep[a]! && keep[b]!; } });
  const pieces: ExcerptPiece[] = []; let text = '', rows = 0, cut: number | null = null, cutRows = 0;
  let previous: Line | null = null;
  const tableLine = (x: Line) => paste.text.slice(x.from, x.to).trim().startsWith('|');
  const append = (l: Line) => {
    const last = pieces.at(-1);
    if (last && last.to === l.from) { last.to = l.to; text += paste.text.slice(l.from, l.to); previous = l; return; }
    // A gap: one line in place of what is not sent, after the line break the piece before ends with: inside a table (rows left out
    // between two of its lines) an empty row 「| |」, which every table reader passes over as it passes a rule row; else a blank line.
    if (last) text += (text.endsWith('\n') ? '' : '\n') + (previous && tableLine(previous) && tableLine(l) ? GAP_ROW : '\n');
    pieces.push({ at: text.length, from: l.from, to: l.to }); text += paste.text.slice(l.from, l.to); previous = l;
  };
  // A blank line goes with the line after it (what is sent never ends on one); a line past the cap starts the part read next time.
  let pending: Line[] = []; const sentAgain: string[] = [];
  for (const [i, l] of lines.entries()) {
    if (!keep[i]) continue;
    if (cut !== null) { if (l.kind === 'row') cutRows++; continue; }
    if (l.kind === 'blank') { pending.push(l); continue; }
    const add = [...pending, l], size = text.length + add.reduce((n, x) => n + (x.to - x.from) + 2, 0);
    if (size > cap) { cut = add[0]!.from; if (l.kind === 'row') cutRows++; continue; }
    for (const x of add) append(x);
    pending = [];
    if (l.kind === 'row') { rows++; if (l.from < from && again.has(l.key!)) sentAgain.push(l.key!); }
  }
  if (!pieces.length || !text.trim()) return null;
  return { id: paste.id, text, pieces, rows, left: v.droppable.filter(x => x.paste === paste.id && (!pages || pages.includes(x.page)) && leave.has(x.key)), again: sentAgain, cut, cutRows };
}

/** The pasted text's [from, to) an excerpt range stands on when it lies within one piece, else null (it would cross a gap). */
export function rangeOf(pieces: readonly ExcerptPiece[], from: number, to: number): { from: number; to: number } | null {
  for (const p of pieces) { const n = p.to - p.from; if (from >= p.at && to <= p.at + n && from <= to) return { from: p.from + (from - p.at), to: p.from + (to - p.at) }; }
  return null;
}
/** An excerpt offset as the pasted text's own: inside a piece, or at its end; a gap's offset goes to the next piece's start. */
export function placeOf(pieces: readonly ExcerptPiece[], x: number): number {
  for (const p of pieces) { const n = p.to - p.from; if (x >= p.at && x <= p.at + n) return p.from + (x - p.at); if (x < p.at) return p.from; }
  return pieces.at(-1)?.to ?? x;
}
/** The excerpt's pieces stand in the pasted text as sent: the text has its length, and the excerpt is the pieces joined by gaps. */
export function piecesStand(text: string, total: number, excerpt: string, pieces: readonly ExcerptPiece[]): boolean {
  if (text.length !== total || !pieces.length) return false;
  let at = 0;
  for (const [i, p] of pieces.entries()) {
    if (i ? !GAPS.includes(excerpt.slice(at, p.at)) || p.from < pieces[i - 1]!.to : p.at !== 0) return false;
    if (text.slice(p.from, p.to) !== excerpt.slice(p.at, p.at + p.to - p.from)) return false;
    at = p.at + p.to - p.from;
  }
  return at === excerpt.length;
}
/** The rows left out, named for a note: 「C-STEP B07:S03·B07:S04, P1-02 3행」 within n characters. */
export function leftText(left: readonly Droppable[], n = 240): string {
  const by = new Map<string, string[]>(); for (const d of left) by.set(d.table, [...by.get(d.table) ?? [], d.id]);
  const parts = [...by].map(([t, ids]) => /^P\d-\d{2}$/.test(t) ? `${t} ${ids.length}행` : `${t} ${ids.slice(0, 6).join('·')}${ids.length > 6 ? ` 외 ${ids.length - 6}행` : ''}`);
  let out = '';
  for (const [i, p] of parts.entries()) { const next = out ? `${out}, ${p}` : p; if (next.length > n) { out += ` 외 ${parts.length - i}개 표`; break; } out = next; }
  return out;
}
