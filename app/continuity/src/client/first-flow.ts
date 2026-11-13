/* The first screen's focus (beauty v5, ruling F6 Q2): the record's own sentence at the top of the canvas, and 「먼저 볼 연결」, the lines to
 * read first, chosen by fixed rules in a fixed order (the first that applies):
 * 0. the person's earlier choice for this map (kept in the first view's record; 「전체 관계」 is a choice too): 「선택한 보기 · …」;
 * 1. a scenario reading, in paste order (its path's relations still on the map): 「기록된 시나리오 · 이름」;
 * 2. the record's C-SUMMARY core-flow sentence (its second sentence): 「요약에 나온 연결」, or 「기록이 설명한 흐름」 only when the sentence
 *    itself states the order of actions (arrows, 다음 · 그 뒤 wording);
 * 3. the same with each C-HEAD 「첫 구조 줄」 line: 「기록의 첫 구조」;
 * 4. a recorded entry point (C-ENTRY of a starting kind): its part and the lines the record draws out of it: 「기록된 시작」;
 * 5. none: no lines picked, the first screen as it was.
 * Name order is only the order the sentence is read in, never a direction or an order of execution: a sentence's parts are read into
 * steps (parts listed as alternatives in one step, joined by · 、 / 또는 or 「… 중 하나」, are never paired with each other), and a line is
 * picked only where the map already has one running from a step to the next, in its own direction; a gap stays a gap (never bridged, never
 * a shortest path, never a reference line read as a step), and a sentence whose only lines run against it gives nothing. A word is read as
 * a part first by the record's own words for its B rows (C-PART names, C-ENTRY entry points, C-STEP functions and names, C-SRC files) bound
 * to the map's parts by the row ledger and the C-IDENT rows, and the parts' earlier official names; then by the map's names. A word two
 * parts hold picks none. Among several candidates of one rule, the one with the most drawn lines goes first (evidence, not centrality),
 * then the record's order. No 「시작」 or 「결과」 is ever put on the first or last named part: only a C-ENTRY row (기록된 시작) and a scenario's
 * recorded start and end are said, and a branch only in the record's plain words (never a row ID).
 * Pure: no DOM, no storage. */
import { norm, nameStem, STARTING_ENTRIES, type FvLoop, type FvPart } from './first-view.js';
import { hasRowId } from './plain-ids.js';
import { COND_UNSAID, tokenFit } from './line-grammar.js';
import { isMapReading, type Channel, type Project } from '../shared/types.js';
import { v5Folds } from '../shared/record-excerpt.js';
import { rowLedger, rowBindings } from '../shared/row-ledger.js';
import { identityState, canonicalPart, partAliases } from '../shared/map-identity.js';
import type { FoldRow } from '../shared/record-table.js';

export type FlowRule = 'scenario' | 'summary' | 'head' | 'entry';
export const FLOW_RULES: readonly FlowRule[] = ['scenario', 'summary', 'head', 'entry'];
/** The control's one name, and what each source is called under it (ruling F6 Q2). */
export const FLOW_CONTROL = '먼저 볼 연결';
export const FLOW_SOURCE: Readonly<Record<FlowRule | 'all' | 'kept' | 'ordered', string>> = Object.freeze({ scenario: '기록된 시나리오', summary: '요약에 나온 연결',
  ordered: '기록이 설명한 흐름', head: '기록의 첫 구조', entry: '기록된 시작', all: '전체 관계', kept: '선택한 보기' });
/** A recorded start with more lines out than this is drawn at the context weight (a fan is no flow). */
export const ENTRY_SOFT_OVER = 3;

/** A part as the flow reads it: the first view's part with its C-ENTRY rows (name and hand-run order) for the start's note. */
export interface FlowPart extends FvPart { entryRows?: readonly { kind: string | null; name: string; order: number | null; ref?: string | null }[] }
/** A relation on the map: its ends, its channel, what it hands over (C-LINK payload) and its condition as the map says it. */
export interface FlowLine { id: string; from: string; to: string; channel: Channel | null; payload?: string | null; when?: string | null }
/** A scenario reading as resolved on the map now: its id, its name, its visits' parts in visit order (on the map only), its links in row
 * order (the relation each cites when it is still on the map, its kind and condition), and its heads' texts. */
export interface FlowScenario {
  id: string; name: string; parts: readonly string[];
  links: readonly { from: string | null; to: string | null; relation: string | null; kind: string; condition?: string | null }[];
  start?: string | null; end?: string | null;
}
/** A word of the record's own for a map part (recordWords). */
export interface RecordWord { word: string; part: string }
/** The person's choice kept for the map: a rule's candidate by its key, or 「전체 관계」 (all: no lines picked). */
export interface FlowChoice { rule: FlowRule | 'all'; key: string }
export interface FlowInput {
  parts: readonly FlowPart[]; lines: readonly FlowLine[]; loops?: readonly FvLoop[];
  scenarios?: readonly FlowScenario[];
  /** The newest record's C-SUMMARY core-flow sentence (its second), as written. */
  summaryFlow?: string | null;
  /** The newest C-HEAD 「첫 구조 줄」 row's lines, as written (headLines). */
  headLines?: readonly string[];
  kept?: FlowChoice | null;
  /** The relations the view draws now (a candidate needs one drawn line); every one when absent. */
  drawn?: ReadonlySet<string> | null;
  /** The record's own words for the parts (recordWords), read before the map's names. */
  words?: readonly RecordWord[];
  /** A note's words as the map may show them (the labels' row-ID guard); null: nothing plain is left. Without it, a text with a row ID
   * is dropped whole. */
  plain?: ((t: string) => string | null) | null;
  /** The card a part is drawn on now (a part inside a folded group is drawn on its group; null: not drawn): the switcher names the drawn
   * cards and never a line drawn inside one card. Each part is its own card when absent. */
  rep?: ((id: string) => string | null) | null;
}
export interface FlowNote { part: string; text: string | null }
export interface FlowCandidate {
  rule: FlowRule; key: string;
  /** Its source as the switcher says it (FLOW_SOURCE), its own name (a scenario's), and the record's words it stands on (the sentence
   * or line; null for a scenario or an entry). */
  source: string; name: string; text: string | null;
  /** The named parts in the record's order, read into steps (alternatives share a step), the lines picked (each from a step to the next,
   * in its own direction), and the consecutive steps no line joins (a gap: drawn as nothing). */
  parts: string[]; steps: string[][]; lines: string[]; gaps: [string, string][];
  /** The context: a line going back between its parts (a loop or a return) and a conditional line leaving the view from one of its parts
   * whose picked line is conditional (the other exits of that decision). */
  context: string[];
  /** Drawn at the context weight (a recorded start with more than ENTRY_SOFT_OVER lines out). */
  soft: boolean;
  /** Notes said only from the record: a C-ENTRY start or a scenario's recorded start and end; never a first or last named part's. */
  start: FlowNote | null; end: FlowNote | null;
  /** The first and the last named part a drawn line of it touches. */
  ends: [string, string];
  /** The drawn lines' largest connected run as layers in their own direction (the switcher's words), and how many drawn lines lie outside
   * it. */
  chain: string[][]; more: number;
  /** How many of its lines are drawn now (the order among candidates of one rule). */
  drawnLines: number;
  /** At most one branch said: the first conditional line among its drawn lines and context whose condition reads plain. */
  branch: { line: string; part: string; text: string } | null;
}
export interface FirstFlow {
  /** The rule that gave the lines; 'all' when the person chose 「전체 관계」; null when no rule applies (rule 5). */
  rule: FlowRule | 'all' | null;
  /** Whether it is the person's kept choice (rule 0). */
  kept: boolean;
  /** The candidates of the rule that applies (the switcher's 보기 1/N), the shown one's index, and the shown one (null: none or 전체 관계). */
  candidates: FlowCandidate[]; index: number; flow: FlowCandidate | null;
}

const cut = (t: string, n: number): string => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);

/* ---------- the record's words ---------- */
/** A record's evidence group closing a sentence: 「(F01+E03)」. */
const CITES = /\s*[(（]\s*(?:[FE]\d{1,3}|추정|모름)(?:\s*\+\s*(?:[FE]\d{1,3}|추정|모름))*\s*[)）]/;
/** The sentences of a C-SUMMARY body as written: a sentence ends at a full stop after 다 · 요 · 함 · 됨 · 음 or after a closing bracket (the
 * evidence group), followed by a space or the end, and at a line break right after an evidence group (review: 「…(F01)⏎다음 문장」); a dot
 * inside a file name (train.py) ends nothing. */
export function summarySentences(body: string): string[] {
  const out: string[] = [];
  for (const chunk of body.split(new RegExp(`(?<=${CITES.source})[ \\t]*\\r?\\n`))) {
    const t = chunk.replace(/\s*\n\s*/g, ' ').trim();
    let start = 0;
    for (const m of t.matchAll(/[.。](?=\s|$)/g)) {
      const before = t.slice(start, m.index);
      if (!/(?:다|요|함|됨|음|[)）])\s*$/.test(before)) continue;
      const s = t.slice(start, m.index + 1).trim(); if (s) out.push(s); start = m.index + 1;
    }
    const rest = t.slice(start).trim(); if (rest) out.push(rest);
  }
  return out;
}
/** A record's file tag in prose: 「[파일: src/collect.py]」. */
const FILE_TAG = /\s*[[［]\s*파일\s*[:：][^\]］]*[\]］]/g;
/** A sentence as the top line shows it: the record's words without its bookkeeping, every evidence group (「(F01)」 「(F02+E01)」, at the
 * end or inside) and every file tag left to the hover (the words themselves are never changed; row IDs go through the labels' guard in
 * the app). */
export const shownSentence = (s: string): string => s.replace(new RegExp(CITES.source, 'g'), '').replace(FILE_TAG, '').replace(/\s{2,}/g, ' ').replace(/\s+([.。,，])/g, '$1').trim();
/** The top sentence and the core-flow sentence of the newest record that has a C-SUMMARY body (records oldest first, each with its
 * C-SUMMARY body lines and where they stand): the first sentence, whole (cites kept, for the hover), the one shown, the second
 * sentence (the core flow), and the record and line it comes from. null when no record has one (then nothing is shown: never the
 * model's summary, never the person's brief). */
export interface SummarySource { record: string; first: string; shown: string; flow: string | null; quote: string; from: number }
/** Polish 5 (ruling F6 Q1): records in paste order, the one the map describes now last: a record about a later target time (its 기준 시점,
 * map-reading pastedTargets) stands after one about an earlier time whatever order they were pasted in (a backlog record pasted late never
 * speaks for the map). Polish 6: a total order. A record with no date is about a time not known, so it never outranks a dated one: the
 * undated stand first, in paste order, then the dated by their date; paste order decides only among the undated and among equal dates. */
export function byTarget<T extends { target?: string | null }>(records: readonly T[]): T[] {
  const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  return records.map((r, i) => ({ r, i }))
    .sort((a, b) => Number(!!a.r.target) - Number(!!b.r.target) || (a.r.target && b.r.target ? cmp(a.r.target, b.r.target) : 0) || a.i - b.i)
    .map(x => x.r);
}
export function summarySource(records: readonly { id: string; target?: string | null; body: readonly { text: string; from: number }[] }[]): SummarySource | null {
  const ordered = byTarget(records);
  for (let i = ordered.length - 1; i >= 0; i--) {
    const r = ordered[i]!, lines = r.body.map(b => b.text.trim()).filter(Boolean); if (!lines.length) continue;
    const ss = summarySentences(lines.join('\n')), first = ss[0]; if (!first) continue;
    const line = r.body.find(b => b.text.trim()) ?? r.body[0]!;
    return { record: r.id, first, shown: shownSentence(first), flow: ss[1] ?? null, quote: line.text.trim(), from: line.from };
  }
  return null;
}
/** The 「첫 구조 줄」 value as its lines: split at its own numbering (① ②, 「1) 2)」) or, without one, at a spaced slash or a semicolon
 * (「data/{dataset}/」 is no split). */
export function headLines(value: string): string[] {
  const v = value.trim(); if (!v) return [];
  const parts = /[①-⑳]/.test(v) ? v.split(/[①-⑳]/) : /(?:^|\s)\d{1,2}\)\s/.test(v) ? v.split(/(?:^|\s)\d{1,2}\)\s/) : v.split(/\s+\/\s+|\s*;\s*/);
  return parts.map(x => x.trim()).filter(Boolean);
}
/** An order word that opens a clause or joins two (「…, 그 다음 …」, 「…하고 이어서 …」), and 차례로 · 순서대로 only at a clause's start or
 * after a list it orders (「…를 차례로」); never a bare 「다음에」 (「다음에 쓸 값」), a word's own 「…순으로」 (「날짜순으로」, 「오래된 순으로」),
 * 「…에서 차례로」 (one by one out of a place) or 「…하면 차례로」 (in turn, under a condition) (review of v5 focus 3, A6). */
const ORDER_WORD = /(?:(?:^|[,，;:]\s*)(?:그\s*다음(?:에|으로)?|그\s*뒤(?:에)?|그\s*후(?:에)?|이어서|차례로|순서대로)|(?:고|며|면|(?<!에)서|뒤|후)\s+(?:그\s*다음(?:에|으로)?|그\s*뒤(?:에)?|그\s*후(?:에)?|이어서)|(?:를|을)\s+(?:차례로|순서대로))(?=[\s,，]|$)/;
/** Whether a sentence states the order of actions itself: then its lines are 「기록이 설명한 흐름」; otherwise only 「요약에 나온 연결」. Only an
 * arrow, a clause-opening or joining 그 다음 · 그 뒤 · 이어서 · 차례로 · 순서대로, or 「…순으로」 right after a list of two or more of the
 * map's names (read with the parts given; without them no 「순으로」 counts). */
export function statesOrder(t: string, inp?: Pick<FlowInput, 'parts' | 'loops' | 'words'>): boolean {
  if (/→|->|⇒/.test(t) || ORDER_WORD.test(t)) return true;
  if (!inp || !/순으로/.test(t)) return false;
  const sp = namedSpans(t, inp.parts, inp.loops ?? [], inp.words ?? []), idx = normIndex(t); if (!idx || sp.length < 2) return false;
  const end = (x: Span) => idx[x.e - 1]! + 1, start = (x: Span) => idx[x.s]!;
  return sp.some((x, i) => i > 0 && /^\s*(?:의\s*)?순으로/.test(t.slice(end(x))) && end(sp[i - 1]!) <= start(x) && /^\s*(?:[,，、·/]|와|과|그리고|,\s*그리고)\s*$/.test(t.slice(end(sp[i - 1]!), start(x))));
}

/** A token of the record's code words (a path, a file, a function): ASCII, a letter, and a sign of code (/ . _ : a digit or a
 * camelCase joint), four characters or more. Plain words (fetch, POST, Kafka) are no such token: names say those. */
export const codeLike = (t: string): boolean => t.length >= 4 && /^[\x21-\x7e]+$/.test(t) && /[A-Za-z]/.test(t) && (/[/._:\d]/.test(t) || /[a-z][A-Z]/.test(t));
const codeTokens = (cell: string): string[] => cell.split(/[\s,，、·;]+/).map(t => t.replace(/^[`'"「(]+|[`'"」),.]+$/g, '').replace(/\(\)$/, '')).filter(codeLike);
const ONE_B = /(?<![A-Za-z0-9])B\d{1,3}(?!\d)/g;
const oneB = (t: string): string | null => { const m = [...new Set(t.match(ONE_B) ?? [])]; return m.length === 1 ? m[0]! : null; };
/** The record's own words for the map's parts (ruling F6 Q2, review of v5 D): of the record a pasted text belongs to, each B row's words
 * for the part that row is bound to (the row ledger's binding, else a reflected C-IDENT row, else the reading of that record that placed
 * the row), and each part's earlier official names. Two tiers: what a row owns (its C-PART 이름, its C-ENTRY entry points' code words, its
 * C-SRC files' names and their stems of five or more letters) before what a step only uses (its C-STEP functions and names of four or more
 * characters: a step may call another part's function); a word of the second tier the first holds is left to the first. A word two parts
 * hold in its tier is left out (it picks none). */
export function recordWords(p: Pick<Project, 'readings' | 'pasted' | 'space'>, paste: string): RecordWord[] {
  const folds = v5Folds(p.pasted), f = folds.find(x => x.pastes.some(y => y.id === paste));
  const live = (id: string) => p.space.areas.some(a => a.id === id && !a.archived), s = identityState(p);
  type Held = Map<string, { word: string; parts: Set<string> }>;
  const owns: Held = new Map(), uses: Held = new Map();
  const into = (out: Held) => (word: string, part: string | null | undefined) => {
    const w = word.trim(), k = norm(w); if (!part || k.length < 2 || /^\d+$/.test(k)) return;
    const x = out.get(k) ?? { word: w, parts: new Set<string>() }; x.parts.add(part); out.set(k, x);
  };
  const put = into(owns), use = into(uses);
  if (f) {
    const bound = new Map<string, string>(), maps = p.readings.filter(isMapReading);
    for (const [k, v] of rowBindings(rowLedger(p, folds), live)) { const [rec, , b] = k.split('\u0000'); if (rec === f.key && b) bound.set(b, canonicalPart(s, v)); }
    for (const r of maps) for (const e of r.identity ?? []) if (e.record === f.key && e.state === 'reflected' && e.part && e.areaId && live(e.areaId) && !bound.has(e.part)) bound.set(e.part, canonicalPart(s, e.areaId));
    const own = new Set(f.pastes.map(x => x.id));
    for (const r of maps) if (r.records.length && r.records.every(x => own.has(x.id))) for (const x of r.parts) if (x.recordRef && live(x.areaId) && !bound.has(x.recordRef)) bound.set(x.recordRef, canonicalPart(s, x.areaId));
    const rows = (t: string): FoldRow[] => f.fold.rows.get(t) ?? [], cell = (r: FoldRow, c: string) => (r.row.byColumn[c] ?? '').trim();
    for (const r of rows('C-PART')) put(cell(r, '이름'), bound.get(r.id));
    for (const r of rows('C-ENTRY')) { const b = oneB(cell(r, '소유 부분')); for (const t of codeTokens(cell(r, '진입점'))) put(t, b ? bound.get(b) : null); }
    for (const r of rows('C-STEP')) {
      const b = /^(B\d{1,3}):/.exec(r.id)?.[1], part = b ? bound.get(b) : null;
      for (const t of codeTokens(cell(r, '쓰는 함수'))) use(t, part);
      const nm = cell(r, '단계 이름'); if (norm(nm).length >= 4) use(nm, part);
    }
    for (const x of f.fold.ledger.files.values()) {
      const b = oneB(x.part ?? ''), part = b ? bound.get(b) : null, base = x.path.split(/[\\/]/).filter(Boolean).at(-1) ?? '', stem = base.replace(/\.[A-Za-z0-9]+$/, '');
      if (!codeLike(base) || !base.includes('.')) continue;
      put(base, part); if (stem !== base && (codeLike(stem) || /^[A-Za-z]{5,}$/.test(stem))) put(stem, part);
    }
  }
  for (const a of p.space.areas) if (!a.archived) for (const x of partAliases(p, a.id)) put(x.name, canonicalPart(s, a.id));
  // A record word never takes another part's own name (「Kafka」 from a file kafka.ts names the part 「Kafka 브로커」, not the file's owner).
  const names = p.space.areas.filter(a => !a.archived).map(a => ({ id: canonicalPart(s, a.id), n: norm(a.name) }));
  const one = (m: Held) => [...m].filter(([k, x]) => x.parts.size === 1 && !names.some(o => o.id !== [...x.parts][0] && o.n.includes(k))).map(([, x]) => ({ word: x.word, part: [...x.parts][0]! }));
  return [...one(owns), ...one(new Map([...uses].filter(([k]) => !owns.has(k))))];
}

/* ---------- one flow from the record's words ---------- */
/** The words by which the record's prose names a part besides its whole name (each normalized, as norm reads them): an ASCII piece of its
 * name of four or more characters (train.py, GameCore, intake, Kafka), and a name of several words without its last word (「npm 게시 작업」
 * as 「npm 게시」), four or more characters left, and a Hangul word of its name of four or more syllables (「미들웨어」); each only when no
 * other part's name holds it. Never a shorter Hangul word alone (「저장소」 names many things in prose), never a count (2개) or a number. */
export function nameTokens(parts: readonly FvPart[]): Map<string, { word: string; ascii: boolean }[]> {
  const whole = parts.map(p => ({ id: p.id, n: norm(p.name) })), out = new Map<string, { word: string; ascii: boolean }[]>();
  const own = (id: string, k: string) => !whole.some(o => o.id !== id && o.n.includes(k));
  for (const p of parts) {
    const ws: { word: string; ascii: boolean }[] = [], full = norm(p.name);
    for (const t of new Set(p.name.split(/[\s·,，/()（）[\]{}「」<>]+/).map(x => x.trim()).filter(Boolean))) {
      const k = norm(t), ascii = ASCII.test(t);
      if (!(ascii ? k.length >= 4 : /^[가-힣]{4,}$/.test(t)) || /^\d+$/.test(k) || k === full || !own(p.id, k)) continue;
      ws.push({ word: t, ascii });
    }
    const words = p.name.trim().split(/\s+/);
    if (words.length >= 2) { const lead = words.slice(0, -1).join(' '), k = norm(lead); if (k.length >= 4 && k !== full && !/^\d+$/.test(k) && own(p.id, k)) ws.push({ word: lead, ascii: false }); }
    if (ws.length) out.set(p.id, ws);
  }
  return out;
}
const ASCII = /^[\x21-\x7e]+$/;
const escRe = (t: string): string => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** What norm drops (kept in step with first-view.ts norm). */
const NORM_DROP = /[\s·_\-.,:;'"`()[\]{}「」『』<>‘’“”]/;
/** Each normalized character's place in the text (null when the two readings disagree: then no step is read as alternatives). */
function normIndex(text: string): number[] | null {
  const idx: number[] = []; let out = '';
  for (let i = 0; i < text.length; i++) { const c = text[i]!; if (NORM_DROP.test(c)) continue; const l = c.toLowerCase(); out += l; for (let k = 0; k < l.length; k++) idx.push(i); }
  return out === norm(text) ? idx : null;
}
interface Span { part: string; s: number; e: number }
/** Where the text names each part (normalized places, the first naming of each part), in tiers: the record's own words, whole names and
 * stems, row IDs, state names, then the parts' own words (nameTokens); a later tier never takes a place an earlier one holds. */
function namedSpans(text: string, parts: readonly FvPart[], loops: readonly FvLoop[], words: readonly RecordWord[]): Span[] {
  const n = norm(text), taken: Span[] = [], first = new Map<string, Span>(), known = new Set(parts.map(p => p.id));
  const take = (part: string, s: number, e: number) => {
    if (taken.some(t => s < t.e && t.s < e)) return;
    const x = { part, s, e }; taken.push(x); if (!first.has(part) || first.get(part)!.s > s) first.set(part, x);
  };
  const ascii = (w: string): [number, number][] => [...text.matchAll(new RegExp(`(?<![A-Za-z0-9_./-])${escRe(w)}(?![A-Za-z0-9_/-])`, 'gi'))].map(m => { const s = norm(text.slice(0, m.index)).length; return [s, s + norm(w).length]; });
  const plain = (k: string): [number, number][] => { const r: [number, number][] = []; for (let i = n.indexOf(k); i >= 0 && k; i = n.indexOf(k, i + 1)) r.push([i, i + k.length]); return r; };
  const find = (w: string): [number, number][] => (ASCII.test(w) ? ascii(w) : plain(norm(w)));
  // 1. The record's own words, longest first.
  for (const w of [...words].filter(x => known.has(x.part)).sort((a, b) => norm(b.word).length - norm(a.word).length)) for (const [s, e] of find(w.word)) take(w.part, s, e);
  // A key two parts hold (two parts of one name, a stem or a state name they share) picks none: it is only held, so no later tier reads it.
  const held = (keys: { id: string; k: string }[]) => {
    const by = new Map<string, Set<string>>(); for (const { id, k } of keys) by.set(k, (by.get(k) ?? new Set()).add(id));
    return [...by].map(([k, ids]) => ({ k, id: ids.size === 1 ? [...ids][0]! : null })).sort((a, b) => b.k.length - a.k.length);
  };
  const hold = (k: string) => { for (const [s, e] of plain(k)) if (!taken.some(t => s < t.e && t.s < e)) taken.push({ part: '', s, e }); };
  // 2. Whole names, then a Korean name read as the work it names (its last syllable off, three or more characters left), longest first.
  // A whole name and a stem never share one pool (review of v5 focus 3, A1): a whole name one part holds wins over another part's stem
  // that reads the same (「스케줄러」 beside 「스케줄러 큐」, 「수집기」 beside 「수집기록」); a stem counts only where no whole name reads so.
  const wholes = parts.map(p => ({ id: p.id, k: norm(p.name) })).filter(x => x.k.length >= 2), wholeKeys = new Set(wholes.map(x => x.k));
  const stems = parts.flatMap(p => { const st = nameStem(p.name); return st ? [{ id: p.id, k: norm(st) }] : []; }).filter(x => x.k.length >= 2 && !wholeKeys.has(x.k));
  const byName = held([...wholes, ...stems]);
  for (const { id, k } of byName) if (id) { for (const [s, e] of plain(k)) take(id, s, e); } else hold(k);
  // 3. Record IDs as written (B03, B03:L01); never a piece of a longer token.
  for (const m of text.matchAll(/(?<![A-Za-z0-9])(B\d{1,3})(?::(L\d{1,3}))?(?![\dA-Za-z])/g)) {
    const s = norm(text.slice(0, m.index)).length, e = s + norm(m[0]).length;
    const owner = m[2] ? loops.find(x => x.ref === `${m[1]}:${m[2]}`)?.owner : parts.find(x => x.ref === m[1])?.id;
    if (owner) take(owner, s, e);
  }
  // 4. A C-STATE name the text repeats; 5. a part's own word.
  for (const { id, k } of held(parts.flatMap(p => [...new Set((p.states ?? []).map(norm))].filter(k => k.length >= 2).map(k => ({ id: p.id, k }))))) if (id) { for (const [s, e] of plain(k)) take(id, s, e); } else hold(k);
  for (const [id, ws] of nameTokens(parts)) for (const w of ws) for (const [s, e] of (w.ascii ? ascii(w.word) : plain(norm(w.word)))) take(id, s, e);
  return [...first.values()].sort((a, b) => a.s - b.s);
}
/** Two names joined as alternatives in one step: 「A·B」, 「A、B」, 「A/B」, 「A 또는 B」, 「A나 B」 (and 「A, B 중 하나」, below). */
const ALT_JOIN = /^\s*(?:[·、/|]|또는|혹은|이나|나|or)\s*$/i;
const ONE_OF = /^\s*(?:[가-힣]{0,2}\s*)?중\s*(?:하나|한\s|택)/;
/** The parts a sentence or line names, in its order, read into steps: consecutive names joined only as alternatives share a step. */
export function flowSteps(text: string, parts: readonly FvPart[], loops: readonly FvLoop[] = [], words: readonly RecordWord[] = []): string[][] {
  const sp = namedSpans(text, parts, loops, words), idx = normIndex(text), steps: string[][] = [];
  const between = (a: Span, b: Span) => (idx && a.e > 0 && b.s < idx.length && idx[a.e - 1]! < idx[b.s]! ? text.slice(idx[a.e - 1]! + 1, idx[b.s]) : null);
  const after = (a: Span) => (idx && a.e > 0 ? text.slice(idx[a.e - 1]! + 1, idx[a.e - 1]! + 12) : '');
  sp.forEach((x, i) => {
    const prev = sp[i - 1], gap = prev ? between(prev, x) : null;
    // A comma joins alternatives only in a run the text closes with 「중 하나」.
    let alt = gap !== null && ALT_JOIN.test(gap);
    if (!alt && gap !== null && /^\s*[,，]\s*$/.test(gap)) {
      let j = i; while (j + 1 < sp.length) { const g = between(sp[j]!, sp[j + 1]!); if (g === null || !(ALT_JOIN.test(g) || /^\s*[,，]\s*$/.test(g))) break; j++; }
      alt = ONE_OF.test(after(sp[j]!));
    }
    if (alt && steps.length) steps.at(-1)!.push(x.part); else steps.push([x.part]);
  });
  return steps;
}
/** The parts a sentence or line names, in its order (flowSteps flattened). */
export const flowParts = (text: string, parts: readonly FvPart[], loops: readonly FvLoop[] = [], words: readonly RecordWord[] = []): string[] => flowSteps(text, parts, loops, words).flat();
/** The lines a sentence or line names: from each step to the next, only a line the map has running that way (never the other way, never
 * between two alternatives of one step, never over a step); the gaps where none does. null when it names under two steps, or no line runs
 * along it, or none of them is drawn. */
export function namedFlow(text: string, inp: Pick<FlowInput, 'parts' | 'lines' | 'loops' | 'drawn' | 'words'>): { parts: string[]; steps: string[][]; lines: string[]; gaps: [string, string][] } | null {
  const steps = flowSteps(text, inp.parts, inp.loops ?? [], inp.words ?? []); if (steps.length < 2) return null;
  const lines: string[] = [], gaps: [string, string][] = [];
  for (let i = 1; i < steps.length; i++) {
    // A reference line (uses) is never a step: a pair joined only by one is a gap.
    const a = steps[i - 1]!, b = steps[i]!, here = inp.lines.filter(l => !isRef(l) && a.includes(l.from) && b.includes(l.to) && l.from !== l.to).map(l => l.id);
    if (here.length) lines.push(...here.filter(id => !lines.includes(id))); else gaps.push([a[0]!, b[0]!]);
  }
  return lines.length && drawnSome(lines, inp) ? { parts: steps.flat(), steps, lines, gaps } : null;
}
/** A reference line (channel uses): what a part consults, never a step of a flow or its context. */
const isRef = (l: Pick<FlowLine, 'channel'>): boolean => l.channel === 'uses';
/** A part's first starting entry (by its hand-run order, then its row ID N01 < N02). */
const entryNo = (ref: string | null | undefined): number => Number(/\d+/.exec(ref ?? '')?.[0] ?? 1e9);
function startEntry(p: FlowPart): { kind: string | null; name: string; order: number | null; ref?: string | null } | null {
  return [...(p.entryRows ?? [])].filter(e => !!e.kind && STARTING_ENTRIES.has(e.kind)).sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || entryNo(a.ref) - entryNo(b.ref))[0] ?? null;
}
/** Whether any of the lines is drawn in the view now (every line counts when the caller says nothing of what is drawn). */
const drawnSome = (ids: readonly string[], inp: { drawn?: ReadonlySet<string> | null | undefined }): boolean => !inp.drawn || ids.some(id => inp.drawn!.has(id));
const isDrawn = (id: string, inp: { drawn?: ReadonlySet<string> | null | undefined }): boolean => !inp.drawn || inp.drawn.has(id);
/** A note's words: the record's text through the labels' row-ID guard; null when nothing plain is left. */
function noteWords(t: string | null | undefined, inp: Pick<FlowInput, 'plain'>): string | null {
  const w = (t ?? '').replace(/\s+/g, ' ').trim(); if (!w) return null;
  const p = inp.plain ? inp.plain(w) : hasRowId(w) ? null : w;
  const r = (p ?? '').trim(); return r && !hasRowId(r) ? r : null;
}
/** When a scenario gives the lines, the basis is that scenario record's own heads (its trigger, the result it wants, what the design
 * produces), each through the row-ID guard, never the map record's sentence; null when it wrote none in plain words (then the app says
 * there is none: SCENARIO_NO_BASIS). */
export const SCENARIO_NO_BASIS = '이 시나리오 기록에는 요약이 없어요';
export function scenarioBasis(heads: readonly { label: string; text: string | null | undefined }[], inp: Pick<FlowInput, 'plain'> = {}): string | null {
  const said = heads.flatMap(x => { const t = (x.text ?? '').trim(); if (!t || t === '모름' || t === '없음') return []; const w = noteWords(t, inp); return w ? [`${x.label} ${w}`] : []; });
  return said.length ? said.join(' · ') : null;
}
/** A branch's words: only a condition the record wrote in plain words (never 「조건의 글자는 기록에 없음」, never a variant's name alone, never
 * a row ID: through the guard, dropped when nothing plain is left). */
export function branchWords(t: string | null | undefined, inp: Pick<FlowInput, 'plain'> = {}): string | null {
  // A condition the record wrote whole in brackets reads without them (「(validateStatus(status))」).
  let w = (t ?? '').trim(); if (/^[(（][^()（）]*(?:[(（][^()（）]*[)）][^()（）]*)*[)）]$/.test(w)) w = w.slice(1, -1).trim();
  if (!w || w === COND_UNSAID || /^[「『]?\s*변형(?:\s|[‘'「X]|$)/.test(w)) return null;
  return noteWords(w, inp);
}
/** The drawn lines' largest connected run, as layers by their place in the record (each layer's lines run to the next one, in their own
 * direction), and how many drawn lines lie outside it. */
function chainOf(drawnLines: readonly FlowLine[], order0: ReadonlyMap<string, number>, rep: (id: string) => string | null): { chain: string[][]; more: number } {
  // On the cards drawn now: a line inside one card is drawn as nothing.
  const lines = drawnLines.flatMap(l => { const a = rep(l.from), b = rep(l.to); return a && b && a !== b ? [{ ...l, from: a, to: b }] : []; });
  const order = new Map<string, number>(); for (const [p, i] of order0) { const r = rep(p); if (r && (order.get(r) ?? 1e9) > i) order.set(r, i); }
  if (!lines.length) return { chain: [], more: 0 };
  const up = new Map<string, string>(), root = (x: string): string => { let r = x; while (up.get(r) && up.get(r) !== r) r = up.get(r)!; return r; };
  for (const l of lines) { for (const x of [l.from, l.to]) if (!up.has(x)) up.set(x, x); const a = root(l.from), b = root(l.to); if (a !== b) up.set(b, a); }
  const groups = new Map<string, FlowLine[]>(); for (const l of lines) { const r = root(l.from); groups.set(r, [...groups.get(r) ?? [], l]); }
  const at = (ls: FlowLine[]) => Math.min(...ls.flatMap(l => [order.get(l.from) ?? 1e9, order.get(l.to) ?? 1e9]));
  const best = [...groups.values()].sort((a, b) => b.length - a.length || at(a) - at(b))[0]!;
  const ps = [...new Set(best.flatMap(l => [l.from, l.to]))];
  // Layers along the lines' own direction: a part's depth is the longest run of drawn lines reaching it.
  const depth = new Map(ps.map(p => [p, 0]));
  for (let g = 0; g < ps.length; g++) for (const l of best) if (l.from !== l.to && depth.get(l.to)! < depth.get(l.from)! + 1 && depth.get(l.from)! + 1 < ps.length) depth.set(l.to, depth.get(l.from)! + 1);
  const chain: string[][] = [];
  for (const p of ps.sort((a, b) => depth.get(a)! - depth.get(b)! || (order.get(a) ?? 1e9) - (order.get(b) ?? 1e9))) (chain[depth.get(p)!] ??= []).push(p);
  return { chain: chain.filter(Boolean), more: lines.length - best.length };
}
/** The candidate with its context, notes and words. */
function dressed(rule: FlowRule, key: string, source: string, name: string, text: string | null, f: { parts: string[]; steps: string[][]; lines: string[]; gaps: [string, string][] }, inp: FlowInput,
  notes: { start?: string | null; startPart?: string; end?: string | null } = {}, branchLinks?: readonly { relation: string | null; from: string | null; condition?: string | null }[]): FlowCandidate {
  const order = new Map<string, number>(); f.steps.forEach((st, i) => st.forEach(p => { if (!order.has(p)) order.set(p, i); }));
  const on = new Set(f.lines), lineById = new Map(inp.lines.map(l => [l.id, l]));
  // The context: a line back between its parts (to an earlier step, or a part to itself: a loop or a return; never between two
  // alternatives of one step), and at a part whose picked line is conditional, that decision's other conditional exits leaving the view
  // (a conditional line to a later step skips a gap or bridges the view: no context).
  const decides = new Set(f.lines.map(id => lineById.get(id)).filter(l => !!l?.when && order.has(l.from)).map(l => l!.from));
  // A way back is context only inside one joined run: both its ends on picked lines, on the same side of every gap (a line back
  // between the two sides of a gap would bridge it). A reference line is never context.
  const run = new Map<string, number>(); let seg = 0;
  f.steps.forEach((st, i) => { if (i && f.gaps.some(([a, b]) => f.steps[i - 1]!.includes(a) && st.includes(b))) seg++; for (const p of st) if (!run.has(p)) run.set(p, seg); });
  const picked = new Set(f.lines.flatMap(id => { const l = lineById.get(id); return l ? [l.from, l.to] : []; }));
  const joined = (a: string, b: string) => picked.has(a) && picked.has(b) && run.get(a) === run.get(b);
  const context = rule === 'entry' ? [] : inp.lines.filter(l => !on.has(l.id) && !isRef(l) && order.has(l.from) && (
    (l.from === l.to && picked.has(l.from)) || (order.has(l.to) && order.get(l.to)! < order.get(l.from)! && joined(l.from, l.to)) || (!!l.when && decides.has(l.from) && !order.has(l.to)))).map(l => l.id);
  // Where it runs: from the lines drawn now only.
  const drawnLines = f.lines.filter(id => isDrawn(id, inp)), dl = drawnLines.map(id => lineById.get(id)).filter((l): l is FlowLine => !!l);
  const touched = new Set(dl.flatMap(l => [l.from, l.to]));
  const ends = f.parts.filter(p => touched.has(p)), first = ends[0] ?? f.parts[0]!, last = ends.at(-1) ?? f.parts.at(-1)!;
  let branch: FlowCandidate['branch'] = null;
  if (branchLinks) { for (const l of branchLinks) { const w = l.relation && l.from ? branchWords(l.condition, inp) : null; if (w) { branch = { line: l.relation!, part: l.from!, text: w }; break; } } }
  else for (const id of [...drawnLines, ...context.filter(id => isDrawn(id, inp))]) { const l = lineById.get(id), w = l && order.has(l.from) ? branchWords(l.when, inp) : null; if (w) { branch = { line: l!.id, part: l!.from, text: w }; break; } }
  const sp = notes.startPart ?? first, startText = 'start' in notes ? noteWords(notes.start, inp) : null, endText = 'end' in notes ? noteWords(notes.end, inp) : null;
  const { chain, more } = chainOf(dl, order, inp.rep ?? (id => id));
  return { rule, key, source, name, text, parts: f.parts, steps: f.steps, lines: f.lines, gaps: f.gaps, context, branch, ends: [first, last], chain, more, drawnLines: dl.length,
    soft: rule === 'entry' && f.lines.length > ENTRY_SOFT_OVER,
    // Only what the record says: a C-ENTRY row's start (its name, or the bare mark), a scenario's recorded start and end.
    start: rule === 'entry' ? { part: sp, text: startText } : rule === 'scenario' && startText ? { part: first, text: startText } : null,
    end: rule === 'scenario' && endText ? { part: last, text: endText } : null };
}
/** Why a card is the view's one start card: a recorded start's C-ENTRY part, a scenario's recorded start, or the first step of a view the
 * record describes in order. */
export type StartWhy = 'entry' | 'scenario' | 'ordered';
/** The view's one start card (craft spec 위계: a light accent face and a 2px accent edge), only where the record backs a start: a recorded
 * start's own part (기록된 시작), a scenario's recorded start, or the first step of a view whose source is 「기록이 설명한 흐름」 when that step
 * is one part and a drawn line of the view leaves it. Never the first named part of a view that states no order (ruling F6: name order is
 * no order), never a part promoted for its lines (no hub is a start). null: no start card. */
export function startCard(c: FlowCandidate | null): { part: string; why: StartWhy } | null {
  if (!c || !c.drawnLines) return null;
  if (c.rule === 'entry') return c.start ? { part: c.start.part, why: 'entry' } : null;
  if (c.rule === 'scenario') return c.start?.text ? { part: c.start.part, why: 'scenario' } : null;
  if (c.rule === 'summary' && c.source === FLOW_SOURCE.ordered) {
    const st = c.steps[0];
    return st && st.length === 1 && c.ends[0] === st[0] ? { part: st[0]!, why: 'ordered' } : null;
  }
  return null;
}
/** Evidence first: the candidate with the most drawn lines, then the record's order. */
const byEvidence = (cs: FlowCandidate[]): FlowCandidate[] => cs.map((c, i) => ({ c, i })).sort((a, b) => b.c.drawnLines - a.c.drawnLines || a.i - b.i).map(x => x.c);
/** Every candidate of one rule (a scenario's in paste order; the others by evidence, then the record's order). */
export function flowCandidates(rule: FlowRule, inp: FlowInput): FlowCandidate[] {
  if (rule === 'scenario') {
    const known = new Set(inp.lines.map(l => l.id)), parts = new Set(inp.parts.map(p => p.id));
    return (inp.scenarios ?? []).flatMap(s => {
      const lines = [...new Set(s.links.map(l => l.relation).filter((r): r is string => !!r && known.has(r)))]; if (!lines.length || !drawnSome(lines, inp)) return [];
      const ps = [...new Set(s.parts.filter(p => parts.has(p)))];
      const gaps = s.links.filter(l => (!l.relation || !known.has(l.relation)) && l.from && l.to).map(l => [l.from!, l.to!] as [string, string]);
      return [dressed('scenario', s.id, FLOW_SOURCE.scenario, s.name, null, { parts: ps, steps: ps.map(p => [p]), lines, gaps }, inp, { start: s.start ?? null, end: s.end ?? null }, s.links.filter(l => l.kind === 'branch'))];
    });
  }
  if (rule === 'summary') {
    const t = inp.summaryFlow?.trim(), f = t ? namedFlow(t, inp) : null;
    return f && t ? [dressed('summary', `summary:${t}`, statesOrder(t, inp) ? FLOW_SOURCE.ordered : FLOW_SOURCE.summary, '기록 요약', t, f, inp)] : [];
  }
  if (rule === 'head') {
    const ls = inp.headLines ?? [];
    return byEvidence(ls.flatMap(t => { const f = namedFlow(t, inp); return f ? [dressed('head', `head:${t}`, FLOW_SOURCE.head, '첫 구조 줄', t, f, inp)] : []; }));
  }
  // A recorded start: a part with a starting C-ENTRY (by its hand-run order, then the map's order) and the relations out of it.
  const starts = inp.parts.map((p, i) => ({ p, i, e: startEntry(p) })).filter(x => !!x.e)
    .sort((a, b) => (a.e!.order ?? 1e9) - (b.e!.order ?? 1e9) || entryNo(a.e!.ref) - entryNo(b.e!.ref) || a.i - b.i);
  return byEvidence(starts.flatMap(({ p, e }) => {
    const out = inp.lines.filter(l => l.from === p.id && l.to !== p.id); if (!out.length || !drawnSome(out.map(l => l.id), inp)) return [];
    const to = [...new Set(out.map(l => l.to))];
    return [dressed('entry', `entry:${p.id}`, FLOW_SOURCE.entry, FLOW_SOURCE.entry, null, { parts: [p.id, ...to], steps: [[p.id], to], lines: out.map(l => l.id), gaps: [] }, inp, { start: e!.name, startPart: p.id })];
  }));
}
/** The first screen's lines (see the head of this file). */
export function firstFlow(inp: FlowInput): FirstFlow {
  const none: FirstFlow = { rule: null, kept: false, candidates: [], index: -1, flow: null };
  const k = inp.kept;
  const firstRule = (): { rule: FlowRule; cs: FlowCandidate[] } | null => { for (const r of FLOW_RULES) { const cs = flowCandidates(r, inp); if (cs.length) return { rule: r, cs }; } return null; };
  if (k && k.rule === 'all') { const f = firstRule(); return { rule: 'all', kept: true, candidates: f?.cs ?? [], index: -1, flow: null }; }
  if (k && k.rule !== 'all') { const rule: FlowRule = k.rule, cs = flowCandidates(rule, inp), i = cs.findIndex(c => c.key === k.key); if (i >= 0) return { rule, kept: true, candidates: cs, index: i, flow: cs[i]! }; }
  const f = firstRule(); if (!f) return none;
  return { rule: f.rule, kept: false, candidates: f.cs, index: 0, flow: f.cs[0]! };
}

/* ---------- the hub fold ---------- */
/** The cards of the view whose drawn lines off the view number six or more: each folds those lines behind one chip (「다른 연결 N개」).
 * lines: each drawn line's ends and whether it belongs to the view (its picked lines, its context, a line between two of its parts: never
 * folded); cards: the view's cards that may fold (never a recorded start's own card). */
export const HUB_FOLD_MIN = 6;
export function hubFolds(cards: readonly string[], lines: readonly { key: string; from: string; to: string; flow: boolean }[]): Map<string, string[]> {
  const hubs = [...new Set(cards)];
  const off = new Map(hubs.map(c => [c, lines.filter(l => !l.flow && (l.from === c || l.to === c))] as const));
  const busy = hubs.filter(c => off.get(c)!.length >= HUB_FOLD_MIN), would = new Set(busy.flatMap(c => off.get(c)!.map(l => l.key)));
  // Never a line whose other end would be left with no line shown: a card whose every drawn line would fold keeps them all (it would
  // read as unconnected otherwise).
  const ends = new Map<string, string[]>(); for (const l of lines) for (const x of new Set([l.from, l.to])) ends.set(x, [...ends.get(x) ?? [], l.key]);
  const bare = new Set([...ends].filter(([, ks]) => ks.every(k => would.has(k))).map(([x]) => x));
  const out = new Map<string, string[]>();
  for (const c of busy) {
    // What is left after that rule folds only while it is still HUB_FOLD_MIN or more (review of v5 focus 3, A4): fewer is no hub.
    const fold = off.get(c)!.filter(l => !bare.has(l.from === c ? l.to : l.from)).map(l => l.key);
    if (fold.length >= HUB_FOLD_MIN) out.set(c, fold);
  }
  return out;
}
/** What the folds hide with some hubs open: a line stays folded only while every hub holding it is folded; each folded hub's chip counts
 * exactly the lines opening it would bring back (an open hub's: none, its chip says 「접기」). */
export function foldedLines(folds: ReadonlyMap<string, readonly string[]>, open: ReadonlySet<string>): { hide: Set<string>; byHub: Map<string, string[]> } {
  const shown = new Set([...folds].filter(([c]) => open.has(c)).flatMap(([, ks]) => ks));
  const hide = new Set([...folds].filter(([c]) => !open.has(c)).flatMap(([, ks]) => ks).filter(k => !shown.has(k)));
  return { hide, byHub: new Map([...folds].map(([c, ks]) => [c, open.has(c) ? [] : ks.filter(k => hide.has(k))])) };
}
/** The chip's words: folded, how many; open, 「접기」. */
export const foldWord = (n: number, open: boolean): string => (open ? '접기' : `다른 연결 ${n}개`);
type Box = { x: number; y: number; w: number; h: number };
/** A hub chip's places (w × hh each), in order, without those over a card's text (2 units of room; v10, review of v9: every text the card
 * shows, its old name too, never only its title) and, given its card, without those that do not touch it (v10: a chip one gap under its card
 * read as nobody's when the card was off the window); when every place meets a text, all the touching ones (the chip still stands at its
 * card). */
export function chipSpots(spots: readonly { x: number; y: number }[], w: number, hh: number, titles: readonly Box[], card?: Box): { x: number; y: number }[] {
  const own = card ? spots.filter(p => touchesCard({ x: p.x, y: p.y, w, h: hh }, card)) : [...spots];
  const clear = own.filter(p => !titles.some(t => p.x < t.x + t.w + 2 && t.x < p.x + w + 2 && p.y < t.y + t.h + 2 && t.y < p.y + hh + 2));
  return clear.length ? clear : own.length ? own : [...spots];
}
/** Whether a chip touches its card: it overlaps the card or meets its edge (within 3 units: a hair off the card's text), along a side. */
export const touchesCard = (r: Box, c: Box, eps = 3): boolean => r.x <= c.x + c.w + eps && c.x <= r.x + r.w + eps && r.y <= c.y + c.h + eps && c.y <= r.y + r.h + eps;
/** v10 (review of v9: 「다른 연결 21개」 stood alone under the top bar, its card hidden above): whether a card is seen on screen: at least a
 * min × min of it inside the view and under none of the covers (the top box, the bars); a chip of a card not seen is not shown. */
export function cardSeen(card: Box, view: Box, covers: readonly Box[], min = 12): boolean {
  const x0 = Math.max(card.x, view.x), y0 = Math.max(card.y, view.y), x1 = Math.min(card.x + card.w, view.x + view.w), y1 = Math.min(card.y + card.h, view.y + view.h);
  if (x1 - x0 < min || y1 - y0 < min) return false;
  const step = 3, need = Math.ceil(min / step) ** 2; let free = 0;
  for (let y = y0 + step / 2; y < y1; y += step) for (let x = x0 + step / 2; x < x1; x += step) {
    if (!covers.some(c => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) && ++free >= need) return true;
  }
  return false;
}
/** The source the switcher says: a kept choice 「선택한 보기 · …」, a scenario with its name. */
export function sourceText(f: FirstFlow): string | null {
  const c = f.flow; if (!c) return f.rule === 'all' ? FLOW_SOURCE.all : null;
  const own = c.rule === 'scenario' ? `${c.source} · ${cut(c.name, 24)}` : c.source;
  return f.kept ? `${FLOW_SOURCE.kept} · ${own}` : own;
}
/** The switcher line: 「먼저 볼 연결: <the drawn lines in their own direction> · <its source> · 보기 i/N」 (the count only when there are
 * more: it numbers the candidates, never steps). A recorded start says where its lines leave. */
export function switcherText(f: FirstFlow, name: (id: string) => string = id => id): string | null {
  const c = f.flow; if (!c) return null;
  // v9 (review of v8: 「WebSocketManage…」, 「{out_dir}…」): each name cut between its units, as a label is (line-grammar tokenFit).
  const at = (id: string) => tokenFit(name(id), 16);
  let what: string;
  if (c.rule === 'entry') what = `${at(c.parts[0]!)}에서 나가는 연결 ${c.drawnLines}개`;
  else {
    const ls = c.chain.map(l => l.map(at).join(', ')), shown = ls.length > 4 ? [ls[0]!, ls[1]!, '…', ls.at(-1)!] : ls;
    what = `${shown.join(' → ')}${c.more ? ` 외 연결 ${c.more}개` : ''}`;
  }
  return `${FLOW_CONTROL}: ${what} · ${sourceText(f)}${f.candidates.length > 1 ? ` · 보기 ${f.index + 1}/${f.candidates.length}` : ''}`;
}
