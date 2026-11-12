/* The first screen's focus (beauty v5): the record's own sentence at the top of the canvas, and 「먼저 보는 흐름」, one flow to follow
 * first, chosen by fixed rules in a fixed order (the first that applies):
 * 0. the person's earlier choice for this map (kept in the first view's record; 「전체 관계」 is a choice too);
 * 1. a scenario reading, in paste order (its path's relations still on the map);
 * 2. the record's C-SUMMARY core-flow sentence (its second sentence): the parts it names, in its own order (namedParts), drawn only along
 *    relations that exist on the map directly between two consecutive named parts; a gap stays a gap, never bridged by another line or a
 *    new one; it needs two named parts and one such relation;
 * 3. the same with each C-HEAD 「첫 구조 줄」 line (the row as written, split at its own numbering);
 * 4. a recorded entry point (C-ENTRY of a starting kind): its part and the lines the record draws out of it, nothing further;
 * 5. none: no flow, the first screen as it was.
 * Never by degree, centrality, path length, the computed spine or anyone's idea of the core: only what the record wrote and the map holds.
 * Pure: no DOM, no storage. */
import { namedPartsAt, norm, STARTING_ENTRIES, type FvLoop, type FvPart } from './first-view.js';
import type { Channel } from '../shared/types.js';

export type FlowRule = 'scenario' | 'summary' | 'head' | 'entry';
export const FLOW_RULES: readonly FlowRule[] = ['scenario', 'summary', 'head', 'entry'];
/** How each rule is named where the switcher says what it shows. */
export const FLOW_RULE_WORD: Readonly<Record<FlowRule, string>> = Object.freeze({ scenario: '기록된 시나리오', summary: '기록 요약의 핵심 흐름', head: '기록의 첫 구조 줄', entry: '기록된 시작' });

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
/** The person's choice kept for the map: a rule's candidate by its key, or 「전체 관계」 (all: no flow drawn). */
export interface FlowChoice { rule: FlowRule | 'all'; key: string }
export interface FlowInput {
  parts: readonly FlowPart[]; lines: readonly FlowLine[]; loops?: readonly FvLoop[];
  scenarios?: readonly FlowScenario[];
  /** The newest record's C-SUMMARY core-flow sentence (its second), as written. */
  summaryFlow?: string | null;
  /** The newest C-HEAD 「첫 구조 줄」 row's lines, as written (headLines). */
  headLines?: readonly string[];
  kept?: FlowChoice | null;
  /** The relations the view draws now (a line of the flow must be among them: a flow needs one drawn line); every one when absent. */
  drawn?: ReadonlySet<string> | null;
}
export interface FlowNote { part: string; text: string | null }
export interface FlowCandidate {
  rule: FlowRule; key: string;
  /** Its short name in the switcher, and the record's words it stands on (the sentence or line; null for an entry). */
  name: string; text: string | null;
  /** The parts in the record's order, the relations drawn (each directly between two consecutive parts), and the consecutive pairs no
   * relation joins (drawn as nothing: a gap). */
  parts: string[]; lines: string[]; gaps: [string, string][];
  /** The flow's own context: a line going back between its parts (a loop or a return) and a conditional line leaving one of its parts. */
  context: string[];
  start: FlowNote | null; end: FlowNote | null;
  /** The first and the last named part a drawn line of the flow touches (where the switcher says it runs). */
  ends: [string, string];
  /** At most one branch said: the first conditional line among the flow and its context, from a flow part, with its condition. */
  branch: { line: string; part: string; text: string } | null;
}
export interface FirstFlow {
  /** The rule that gave the flow; 'all' when the person chose 「전체 관계」; null when no rule applies (rule 5). */
  rule: FlowRule | 'all' | null;
  /** Whether it is the person's kept choice (rule 0). */
  kept: boolean;
  /** The candidates of the rule that applies (the switcher's 1/N), the shown one's index, and the shown one (null: none or 전체 관계). */
  candidates: FlowCandidate[]; index: number; flow: FlowCandidate | null;
}

const cut = (t: string, n: number): string => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);

/* ---------- the record's words ---------- */
/** A record's evidence group closing a sentence: 「(F01+E03)」. */
const CITES = /\s*[(（]\s*(?:[FE]\d{1,3}|추정|모름)(?:\s*\+\s*(?:[FE]\d{1,3}|추정|모름))*\s*[)）]/;
/** The sentences of a C-SUMMARY body as written (its lines joined): a sentence ends at a full stop after 다 · 요 · 함 · 됨 · 음 or after a
 * closing bracket (the evidence group), followed by a space or the end; a dot inside a file name (train.py) ends nothing. */
export function summarySentences(body: string): string[] {
  const t = body.replace(/\s*\n\s*/g, ' ').trim(), out: string[] = [];
  let start = 0;
  for (const m of t.matchAll(/[.。](?=\s|$)/g)) {
    const before = t.slice(start, m.index);
    if (!/(?:다|요|함|됨|음|[)）])\s*$/.test(before)) continue;
    const s = t.slice(start, m.index + 1).trim(); if (s) out.push(s); start = m.index + 1;
  }
  const rest = t.slice(start).trim(); if (rest) out.push(rest);
  return out;
}
/** A sentence as the top line shows it: the record's words, its closing evidence group left to the hover (the words are never changed). */
export const shownSentence = (s: string): string => s.replace(new RegExp(`${CITES.source}(?=\\s*[.。]?\\s*$)`), '').trim();
/** The top sentence and the core-flow sentence of the newest record that has a C-SUMMARY body (records oldest first, each with its
 * C-SUMMARY body lines and where they stand): the first sentence, whole (cites kept, for the hover), the one shown, the second
 * sentence (the core flow), and the record and line it comes from. null when no record has one (then nothing is shown: never the
 * model's summary, never the person's brief). */
export interface SummarySource { record: string; first: string; shown: string; flow: string | null; quote: string; from: number }
export function summarySource(records: readonly { id: string; body: readonly { text: string; from: number }[] }[]): SummarySource | null {
  for (let i = records.length - 1; i >= 0; i--) {
    const r = records[i]!, lines = r.body.map(b => b.text.trim()).filter(Boolean); if (!lines.length) continue;
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
/** The parts a sentence or line names, in its order: namedParts (whole names, row IDs, loops, states), then a part it names only by one of
 * its own words (nameTokens: an ASCII word as a whole word, a leading phrase as namedParts reads a name). */
export function flowParts(text: string, parts: readonly FvPart[], loops: readonly FvLoop[] = []): string[] {
  const at = new Map(namedPartsAt(text, parts, loops).at), n = norm(text);
  for (const [id, ws] of nameTokens(parts)) {
    if (at.has(id)) continue;
    let best: number | null = null;
    for (const w of ws) {
      let pos = -1;
      if (w.ascii) { const m = new RegExp(`(?<![A-Za-z0-9])${escRe(w.word)}(?![A-Za-z0-9])`, 'i').exec(text); if (m) pos = norm(text.slice(0, m.index)).length; }
      else pos = n.indexOf(norm(w.word));
      if (pos >= 0 && (best === null || pos < best)) best = pos;
    }
    if (best !== null) at.set(id, best);
  }
  return [...at.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id);
}
/** The flow a sentence or line names: its parts in its order and the relations directly between consecutive ones (forward first; the
 * other way only when none runs forward), the gaps where none does. null when it names under two parts or no relation joins any pair. */
export function namedFlow(text: string, inp: Pick<FlowInput, 'parts' | 'lines' | 'loops' | 'drawn'>): { parts: string[]; lines: string[]; gaps: [string, string][] } | null {
  const parts = flowParts(text, inp.parts, inp.loops ?? []); if (parts.length < 2) return null;
  const lines: string[] = [], gaps: [string, string][] = [];
  for (let i = 1; i < parts.length; i++) {
    const a = parts[i - 1]!, b = parts[i]!;
    const fwd = inp.lines.filter(l => l.from === a && l.to === b), back = fwd.length ? [] : inp.lines.filter(l => l.from === b && l.to === a);
    const here = [...fwd, ...back].map(l => l.id);
    if (here.length) lines.push(...here.filter(id => !lines.includes(id))); else gaps.push([a, b]);
  }
  return lines.length && drawnSome(lines, inp) ? { parts, lines, gaps } : null;
}
/** A part's first starting entry (by its hand-run order, then its row ID N01 < N02). */
const entryNo = (ref: string | null | undefined): number => Number(/\d+/.exec(ref ?? '')?.[0] ?? 1e9);
function startEntry(p: FlowPart): { kind: string | null; name: string; order: number | null; ref?: string | null } | null {
  return [...(p.entryRows ?? [])].filter(e => !!e.kind && STARTING_ENTRIES.has(e.kind)).sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || entryNo(a.ref) - entryNo(b.ref))[0] ?? null;
}
/** Whether any of the lines is drawn in the view now (every line counts when the caller says nothing of what is drawn). */
const drawnSome = (ids: readonly string[], inp: { drawn?: ReadonlySet<string> | null | undefined }): boolean => !inp.drawn || ids.some(id => inp.drawn!.has(id));
/** The flow's context and its notes (start, at most one branch, end) from the map's lines. */
function dressed(rule: FlowRule, key: string, name: string, text: string | null, f: { parts: string[]; lines: string[]; gaps: [string, string][] }, inp: FlowInput,
  start?: string | null, end?: string | null, branchLinks?: readonly { relation: string | null; from: string | null; condition?: string | null }[]): FlowCandidate {
  const order = new Map(f.parts.map((p, i) => [p, i])), on = new Set(f.lines), byId = new Map(inp.parts.map(p => [p.id, p])), lineById = new Map(inp.lines.map(l => [l.id, l]));
  // The flow's own context: a line back between its parts (to an earlier one, or a part to itself: a loop or a return), and at a part
  // whose flow line out is conditional, that decision's other conditional exits (the branch it leaves). A forward line skipping a part
  // is no context (it would read as a bridge over a gap); a conditional line of a part the flow passes unconditionally is not either.
  const decides = new Set(f.lines.map(id => lineById.get(id)).filter(l => !!l?.when && order.has(l.from)).map(l => l!.from));
  const context = rule === 'entry' ? [] : inp.lines.filter(l => !on.has(l.id) && order.has(l.from) && (
    (order.has(l.to) && order.get(l.to)! <= order.get(l.from)!) || (!!l.when && decides.has(l.from)))).map(l => l.id);
  // The notes stand where the drawn flow starts and ends: the first and the last named part a drawn line of it touches (a named part
  // past a gap carries none: nothing reaches it).
  const touched = new Set(f.lines.flatMap(id => { const l = lineById.get(id); return l ? [l.from, l.to] : []; }));
  const ends = f.parts.filter(p => touched.has(p)), first = ends[0] ?? f.parts[0]!, last = ends.at(-1) ?? f.parts.at(-1)!;
  const part0 = byId.get(first), entry = part0 ? startEntry(part0) : null;
  // A note says only what the lines show: 「시작」 where a drawn line of the flow leaves its first part (or the part has a starting entry),
  // 「끝」 where one enters its last part, with what that line hands over; a line running against the record's order carries neither.
  const lastIn = [...f.lines].reverse().map(id => lineById.get(id)).find(l => !!l && l.to === last), leaves = f.lines.some(id => lineById.get(id)?.from === first);
  let branch: FlowCandidate['branch'] = null;
  if (branchLinks) { const b = branchLinks.find(l => l.relation && l.condition && l.from); if (b) branch = { line: b.relation!, part: b.from!, text: b.condition! }; }
  else for (const id of [...f.lines, ...context]) { const l = lineById.get(id); if (l?.when && order.has(l.from)) { branch = { line: l.id, part: l.from, text: l.when }; break; } }
  return { rule, key, name, text, parts: f.parts, lines: f.lines, gaps: f.gaps, context, branch, ends: [first, last],
    start: start !== undefined ? { part: first, text: start } : entry || leaves ? { part: first, text: entry ? entry.name : null } : null,
    end: rule === 'entry' ? null : end !== undefined ? { part: last, text: end } : lastIn ? { part: last, text: lastIn.payload ?? null } : null };
}
/** Every candidate of one rule, in the record's order. */
export function flowCandidates(rule: FlowRule, inp: FlowInput): FlowCandidate[] {
  if (rule === 'scenario') {
    const known = new Set(inp.lines.map(l => l.id)), parts = new Set(inp.parts.map(p => p.id));
    return (inp.scenarios ?? []).flatMap(s => {
      const lines = [...new Set(s.links.map(l => l.relation).filter((r): r is string => !!r && known.has(r)))]; if (!lines.length || !drawnSome(lines, inp)) return [];
      const ps = [...new Set(s.parts.filter(p => parts.has(p)))];
      const gaps = s.links.filter(l => (!l.relation || !known.has(l.relation)) && l.from && l.to).map(l => [l.from!, l.to!] as [string, string]);
      return [dressed('scenario', s.id, s.name, null, { parts: ps, lines, gaps }, inp, s.start ?? null, s.end ?? null, s.links.filter(l => l.kind === 'branch'))];
    });
  }
  if (rule === 'summary') {
    const t = inp.summaryFlow?.trim(), f = t ? namedFlow(t, inp) : null;
    return f && t ? [dressed('summary', `summary:${t}`, '기록 요약', t, f, inp)] : [];
  }
  if (rule === 'head') {
    const ls = inp.headLines ?? [];
    return ls.flatMap((t, i) => { const f = namedFlow(t, inp); return f ? [dressed('head', `head:${t}`, ls.length > 1 ? `첫 구조 줄 ${i + 1}` : '첫 구조 줄', t, f, inp)] : []; });
  }
  // A recorded start: a part with a starting C-ENTRY (by its hand-run order, then the map's order) and the relations out of it.
  const starts = inp.parts.map((p, i) => ({ p, i, e: startEntry(p) })).filter(x => !!x.e)
    .sort((a, b) => (a.e!.order ?? 1e9) - (b.e!.order ?? 1e9) || entryNo(a.e!.ref) - entryNo(b.e!.ref) || a.i - b.i);
  return starts.flatMap(({ p, e }) => {
    const out = inp.lines.filter(l => l.from === p.id && l.to !== p.id); if (!out.length || !drawnSome(out.map(l => l.id), inp)) return [];
    const parts = [p.id, ...new Set(out.map(l => l.to))];
    return [dressed('entry', `entry:${p.id}`, FLOW_RULE_WORD.entry, null, { parts, lines: out.map(l => l.id), gaps: [] }, inp, e!.name, null)];
  });
}
/** The first screen's flow (see the head of this file). */
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
/** The cards on the flow whose drawn lines off the flow number six or more: each folds those lines behind one chip (「다른 연결 N개」),
 * N counted from the lines drawn now. lines: each drawn line's ends and whether it is the flow's or its context; cards: the drawn cards
 * of the flow's parts. */
export const HUB_FOLD_MIN = 6;
export function hubFolds(cards: readonly string[], lines: readonly { key: string; from: string; to: string; flow: boolean }[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const c of new Set(cards)) {
    const other = lines.filter(l => !l.flow && (l.from === c || l.to === c)).map(l => l.key);
    if (other.length >= HUB_FOLD_MIN) out.set(c, other);
  }
  return out;
}
/** The chip's words: folded, how many; open, 「접기」. */
export const foldWord = (n: number, open: boolean): string => (open ? '접기' : `다른 연결 ${n}개`);
/** The switcher line: 「먼저 보는 흐름: <where it starts> → <where it ends> · <its source> · 1/N」 (the count only when there are more;
 * an entry's flow says only where it starts, a scenario its own name). */
export function switcherText(f: FirstFlow, name: (id: string) => string = id => id): string | null {
  const c = f.flow; if (!c) return null;
  const at = (id: string | undefined) => cut(id ? name(id) : '', 18);
  const what = c.rule === 'scenario' ? cut(c.name, 28) : c.rule === 'entry' ? `${at(c.ends[0])}에서` : `${at(c.ends[0])} → ${at(c.ends[1])}`;
  return `먼저 보는 흐름: ${what}${c.rule === 'scenario' ? '' : ` · ${c.name}`}${f.candidates.length > 1 ? ` · ${f.index + 1}/${f.candidates.length}` : ''}`;
}
