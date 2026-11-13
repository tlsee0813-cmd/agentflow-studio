/* Studio: read-only projection of a saved project (project.7) into map parts and recent records, plus the small
 * studio.1 contract the server forwards to DeepSeek. Nothing here writes to a project. */
import type { Project, Source, RelationKind } from './types.js';
import { areaOf, isReturnTask, areaDescription } from './domain.js';
import { parseResultFile, sourceText } from './validation.js';
import { partUnderstanding, type PartUnderstanding } from './map-reading.js';

export type PartStatus = 'plan' | 'active' | 'reported' | 'check';
/** Observations only: 'active' means a request is recorded and no report came back, not that work is running. */
export const STATUS_LABEL: Record<PartStatus, string> = { plan: '구상', active: '요청 있음 · 보고 없음', reported: '보고 받음', check: '확인 필요' };
/** Same meaning, short enough for a map node. */
export const STATUS_SHORT: Record<PartStatus, string> = { plan: '구상', active: '요청만 있음', reported: '보고 받음', check: '확인 필요' };
export type RecordKind = 'request' | 'report' | 'evidence' | 'answer' | 'decision';
export const RECORD_LABEL: Record<RecordKind, string> = { request: '요청', report: '작업 보고', evidence: '확인 자료', answer: '답변', decision: '결정' };

export interface RecordView {
  /** The stored Source id: every record is an existing source, never a made-up one. */
  id: string; kind: RecordKind; at: string; partId: string | null; taskId: string;
  /** External text as received (return files without the app's own label prefix) or the user's own words. */
  text: string; origin: string | null;
}
export interface PartView {
  id: string; name: string; note: string; parentId: string | null; depth: number; childIds: string[];
  status: PartStatus; lastAt: string | null; recordIds: string[];
  /** Current organised description from a received return.2 (valid only), else null. */
  summary: string | null; changes: string[]; origin: string | null; proposal: string | null;
  /** What map readings understood about this part (project.9), apart from note and summary; null when none said anything. */
  reading: PartUnderstanding | null;
}
export interface RelationView { id: string; from: string; to: string; kind: RelationKind; note: string }
export interface StudioView { parts: PartView[]; roots: string[]; relations: RelationView[]; records: RecordView[] }

const KIND: Record<Source['kind'], RecordKind | null> = {
  request: 'request', report: 'report', evidence: 'evidence', answer: 'answer', manual_decision: 'decision', test_answer: null
};


export function studioView(p: Project): StudioView {
  const active = p.space.areas.filter(a => !a.archived), ids = new Set(active.map(a => a.id));
  const parentOf = (id: string) => { const parent = p.space.containment.parents[id]; return parent && ids.has(parent) ? parent : null; };
  const tasks = new Map(p.tasks.map(t => [t.id, t]));
  const records: RecordView[] = [];
  for (const s of p.sources) {
    const kind = KIND[s.kind], t = tasks.get(s.taskId); if (!kind || !t) continue;
    const area = areaOf(p, t), u = t.resultFile ? parseResultFile(t.resultFile.rawText).understanding : null;
    records.push({ id: s.id, kind, at: s.at, partId: area && ids.has(area) ? area : null, taskId: t.id, text: sourceText([t], s), origin: kind === 'report' ? u?.origin ?? null : null });
  }
  records.sort((a, b) => b.at.localeCompare(a.at));
  const parts: PartView[] = active.map(a => {
    let depth = 0; for (let x = parentOf(a.id), guard = 0; x && guard < 64; x = parentOf(x), guard++) depth++;
    const own = records.filter(r => r.partId === a.id);
    const requests = p.tasks.filter(t => t.areaId === a.id && !isReturnTask(p, t));
    const latest = requests.at(-1);
    const returned = latest ? p.tasks.some(t => t.parentTaskId === latest.id && isReturnTask(p, t)) : false;
    const d = areaDescription(p, a.id), cur = d.current?.valid ? d.current : null;
    const status: PartStatus = d.held.length && !cur ? 'check' : !latest ? 'plan' : returned ? 'reported' : 'active';
    return { id: a.id, name: a.name, note: a.note, parentId: parentOf(a.id), depth, childIds: active.filter(c => parentOf(c.id) === a.id).map(c => c.id),
      status, lastAt: own[0]?.at ?? null, recordIds: own.map(r => r.id),
      summary: cur?.summary ?? null, changes: cur?.changes ?? [], origin: cur?.origin ?? null, proposal: cur?.proposal ?? null, reading: partUnderstanding(p, a.id) };
  });
  // A part with no request of its own reads its inside: the most pressing status among its descendants (check > active > reported).
  const rank: PartStatus[] = ['plan', 'reported', 'active', 'check'], byId = new Map(parts.map(x => [x.id, x]));
  const inner = (x: PartView, guard = 0): PartStatus => x.status !== 'plan' || guard > 64 ? x.status
    : x.childIds.map(id => inner(byId.get(id)!, guard + 1)).reduce<PartStatus>((a, b) => rank.indexOf(b) > rank.indexOf(a) ? b : a, 'plan');
  const aggregated = parts.map(x => inner(x));
  parts.forEach((x, i) => { x.status = aggregated[i]!; });
  return {
    parts, roots: parts.filter(x => x.parentId === null).map(x => x.id),
    relations: p.space.relations.filter(r => ids.has(r.from) && ids.has(r.to)).map(r => ({ id: r.id, from: r.from, to: r.to, kind: r.kind, note: r.note })),
    records
  };
}
/** Records of a part and everything inside it, newest first. */
export function subtreeRecords(v: StudioView, partId: string): RecordView[] {
  const inside = new Set<string>(), stack = [partId];
  while (stack.length) { const id = stack.pop()!; if (inside.has(id)) continue; inside.add(id); stack.push(...(v.parts.find(x => x.id === id)?.childIds ?? [])); }
  return v.records.filter(r => r.partId !== null && inside.has(r.partId));
}
export function partPath(v: StudioView, partId: string): PartView[] {
  const out: PartView[] = []; let cur = v.parts.find(x => x.id === partId);
  while (cur && out.length < 64) { out.unshift(cur); cur = cur.parentId ? v.parts.find(x => x.id === cur!.parentId) : undefined; }
  return out;
}

/* ---------- studio.1: ask about one part. Stateless: the browser sends the part's material, the server forwards it. ---------- */
export const STUDIO_SCHEMA = 'studio.1' as const;
export const ASK_BYTES = 65536;
export const ASK_RECORDS = 14;
export const RECORD_CHARS = 2400;
export type AskIntent = 'summary' | 'next' | 'question';
export interface AskRecord { ref: string; kind: RecordKind; at: string; part: string; text: string; cut: boolean }
export interface StudioAsk {
  version: typeof STUDIO_SCHEMA; intent: AskIntent; question: string | null;
  project: { name: string; purpose: string | null };
  part: { name: string; note: string; path: string[]; children: { name: string; status: PartStatus }[];
    links: { other: string; direction: 'to' | 'from'; kind: RelationKind; note: string }[] };
  current: { summary: string | null; changes: string[] };
  records: AskRecord[];
  coverage?: AskCoverage;
}
export interface StudioReply { headline: string; situation: string[]; changes: string[]; next: string[]; answer: string | null; refs: string[] }
/** The question box after an answer to `sent` arrived: emptied only when it still holds that question (spaces aside). Text
 * written since, e.g. a new question typed while an earlier one failed and was then retried, stays unsent and in place. */
export const draftAfterAnswer = (draft: string, sent: string): string => (draft.trim() === sent.trim() ? '' : draft);

/** What part of the material went out: newest records first, within ASK_BYTES of UTF-8 JSON. Optional on input, so a
 * request from an older open tab (no coverage) is still accepted. */
export interface AskCoverage { records: { total: number; sent: number; cut: number }; links: { total: number; sent: number }; children: { total: number; sent: number } }
const encoder = new TextEncoder();
export const askBytes = (v: unknown) => encoder.encode(JSON.stringify(v)).length;
/** Cut to at most n UTF-16 units without leaving half of a surrogate pair. */
export function clip(text: string, n: number): string {
  if (text.length <= n) return text;
  const code = text.charCodeAt(n - 1);
  return text.slice(0, code >= 0xd800 && code <= 0xdbff ? n - 1 : n);
}
/** The plan words (the set of map-identity PLANNED, kept apart: the two modules import each other): a description holding one says
 * something is not built yet. v9 (review of v8: a top sentence lost 「… README에서 폐기(…) 안내」): also the words that say it is no
 * longer kept (폐기 · 사용 중단 · 중단), which a cut keeps the same way; map-identity PLANNED stays the plan words only (a retired part is
 * not an unbuilt one). */
export const PLAN_WORD = /계획|예정|하기로|할\s*것|나중에|아직|폐기|사용\s*중단|중단/;
/** Recipe .53 (ruling F6 Q1): a description that ends on a plan word (「…색인하도록 계획된 처리다.」, 「…(예정)」) keeps that ending
 * when it is cut: the words from the one holding the plan word on (within PLAN_TAIL_CHARS of the end, measured by widthOf: recipe .54, the
 * same unit the cut's room is measured in), else null. Review of .54 (finding 3): a reading aid only; clipKeepPlan no longer stops at
 * this distance. */
export const PLAN_TAIL_CHARS = 14;
const charCount = (t: string) => [...t].length;
/** The last plan word (PLAN_WORD) of a folded text: its place and length, or null. */
function lastPlanWord(t: string): { at: number; len: number } | null {
  const re = new RegExp(PLAN_WORD.source, 'g'); let last: { at: number; len: number } | null = null;
  for (let m = re.exec(t); m; m = re.exec(t)) last = { at: m.index, len: m[0].length };
  return last;
}
export function planTail(text: string, widthOf: (t: string) => number = charCount): string | null {
  const t = text.replace(/\s+/g, ' ').trim(), w = lastPlanWord(t);
  if (!w) return null;
  const start = t.lastIndexOf(' ', w.at) + 1, tail = t.slice(start);
  return widthOf(tail) <= PLAN_TAIL_CHARS ? tail : null;
}
/** A clause boundary: a comma or semicolon, or the space after a joining ending (하고 · 되고 · 이고 · 하며 · 되며 · 이며 · 으며). */
const CLAUSE_BOUNDARY = /[,，;；]\s*|(?<=(?:하고|되고|이고|하며|되며|이며|으며))\s+/g;
/** The end of the last clause boundary in t[from, before), or `from` for none. */
function clauseStart(t: string, from: number, before: number): number {
  const re = new RegExp(CLAUSE_BOUNDARY.source, 'g'); re.lastIndex = from; let end = from;
  for (let m = re.exec(t); m && m.index < before; m = re.exec(t)) if (m.index + m[0].length <= before) end = m.index + m[0].length;
  return end;
}
/** Recipe .54 (review of .53): the clause of one sentence that holds its last plan word: the words after the last clause boundary before
 * that word, to the sentence's end. Null when the sentence has no plan word or no boundary before it (the clause would be the whole
 * sentence). Always words of the sentence itself, never another's. */
export function planClause(sentence: string): string | null {
  const t = sentence.replace(/\s+/g, ' ').trim(), w = lastPlanWord(t); if (!w) return null;
  const end = clauseStart(t, 0, w.at), clause = end > 0 ? t.slice(end).trim() : '';
  return clause && clause !== t ? clause : null;
}
/** v8 (review of v7: the top sentence cut 「… 2025-11 README에…」, 「… 운영자는 CLI·웹…」): where a sentence may be cut, longest first: at its
 * clause boundaries (a comma or semicolon, which goes with the cut; a joining ending: 하고 · 이고 · 하며 · 이며 · 돌리며 · 하거나 · 하지만 ·
 * 하는데 · 하면서; a sentence's end, which keeps its period and takes 「 …」), each with one 「…」; then at its spaces (whole words), longest
 * first. A text holding a plan word (PLAN_WORD) has only the cuts that keep its last one (none: the caller keeps clipKeepPlan's cut).
 * A cut keeps at least 8 characters. The whole text stays in its box's hover. */
/** Words ending in 고 that are nouns, not a verb's joining ending (the word alone, or its last two syllables after a noun: 「실행 보고」,
 * 「자료 창고」, 「결과 참고」). */
const NOUN_GO = /(?:^|[\s(·,])(?:[가-힣]*(?:보고|창고|광고|참고|경고|재고|최고|사고|신고|원고|금고|잔고|공고|투고|기고|예고|권고|충고|노고|선고|고고))$/;
export function clauseCuts(text: string): { clauses: string[]; words: string[] } {
  const t = text.replace(/\s+/g, ' ').trim(), w = lastPlanWord(t), keep = w ? w.at + w.len : 0;
  const ends = new Set<number>(), spaces = new Set<number>();
  for (const m of t.matchAll(/[,，;；](?= )|[.!?。](?= )|(?<=[가-힣](?:며|고|거나|지만|는데|면서))(?= )/g)) {
    // A 「…고」 joins clauses as a verb's joining ending (「넣고」 「돌리고」 「하고」), never as a noun that ends so (「보고」 is a report, 「창고」 a
    // store: NOUN_GO); 「…며」 「…거나」 「…지만」 「…는데」 「…면서」 always do. v9 (review of v8: 「…넣고 자체…」 was cut mid-clause).
    if (/고$/.test(t.slice(0, m.index! + m[0].length)) && NOUN_GO.test(t.slice(0, m.index! + m[0].length))) continue;
    ends.add(m.index! + m[0].length);
  }
  for (const m of t.matchAll(/ /g)) spaces.add(m.index!);
  const make = (i: number): string | null => {
    let head = t.slice(0, i).trimEnd(); if (i >= t.length || head.length < 8 || head.length < keep) return null;
    if (/[.!?。]$/.test(head)) return `${head} …`;
    // Nor ending on a mark that promises more (「,」 「·」 「:」) or an arrow pointing at what was cut (「… ckpt.pt) →」).
    // A bracket the cut leaves open keeps only the words before it.
    for (const [o, c] of [['(', ')'], ['[', ']'], ['{', '}'], ['「', '」']] as const) { const at = head.lastIndexOf(o); if (at >= 0 && head.indexOf(c, at) < 0) head = head.slice(0, at); }
    head = head.replace(/(?:\s*[,，;；·\-–—:→←↔⇒])+$/, '').trimEnd();
    return head.length >= 8 && head.length >= keep ? `${head}…` : null;
  };
  const list = (xs: Iterable<number>) => [...new Set([...xs].sort((a, b) => b - a).map(make).filter((x): x is string => !!x))];
  return { clauses: list(ends), words: list(spaces) };
}
/** A width in Korean characters: a Hangul or other wide character is 1, anything else 0.6 (a card line holds about 15). */
export const textWidth = (t: string): number => [...t].reduce((n, ch) => n + (/[ᄀ-ᇿ⺀-꓏가-힣豈-﫿＀-￯]/.test(ch) ? 1 : 0.6), 0);
/** The head of a folded text that fits `room` by widthOf (trailing space dropped). */
const headFit = (t: string, room: number, widthOf: (t: string) => number) => { let head = ''; for (const ch of t) { if (widthOf(head + ch) > room) break; head += ch; } return head.trimEnd(); };
/** Whether a plain cut of the folded text to n would leave out its last plan word: the text is wider than n and that word is not whole in
 * the head a plain cut keeps. */
export function planCutNeeded(text: string, n: number, widthOf: (t: string) => number = charCount): boolean {
  const t = text.replace(/\s+/g, ' ').trim(); if (widthOf(t) <= n) return false;
  const w = lastPlanWord(t); return !!w && headFit(t, n - 1, widthOf).length < w.at + w.len;
}
/** Cut to at most n characters (or, with widthOf, n by that width) with 「…」. Whitespace is folded first. Review of .54 (finding 3): a
 * cut never leaves out the text's last plan word (PLAN_WORD), wherever it sits. A plain cut that keeps it whole stays a plain cut;
 * otherwise the text keeps its head and, after 「…」, the first of these spans that fits (each the text's own words, a trailing 「…」 marking
 * what is cut after it): the clause holding the plan word (from the last clause boundary of its sentence before the word) to the
 * sentence's end; the words from the one holding the plan word to the sentence's end; that clause up to the end of the word holding the
 * plan word; that word with the word before it (in the same sentence); that word with the word after it; that word alone. First with a
 * head of at least two characters, then with none (「… span」); when even 「… word」 does not fit, the text stays uncut: never a plain cut
 * that drops the plan word, never a word the text does not have. */
/** v9 (review of v8: the top sentence kept its plan word after 「… OpenAI GPT-2 가…」): the head of a folded text that fits room, ending on a
 * whole word (never inside one, nor on a mark that promises more, nor inside a bracket it opens); '' when no whole word fits. */
function wordHead(t: string, room: number, widthOf: (t: string) => number): string {
  let head = headFit(t, room, widthOf); if (head === t) return head;
  if (t[head.length] !== ' ') head = head.slice(0, Math.max(0, head.lastIndexOf(' ')));
  for (const [o, c] of [['(', ')'], ['[', ']'], ['{', '}'], ['「', '」']] as const) { const at = head.lastIndexOf(o); if (at >= 0 && head.indexOf(c, at) < 0) head = head.slice(0, at); }
  return head.replace(/(?:\s*[,，;；·\-–—:→←↔⇒])+$/, '').trimEnd();
}
export function clipKeepPlan(text: string, n: number, widthOf: (t: string) => number = charCount, words = false): string {
  const t = text.replace(/\s+/g, ' ').trim(); if (widthOf(t) <= n) return t;
  const plain = headFit(t, n - 1, widthOf), w = lastPlanWord(t);
  if (!w || plain.length >= w.at + w.len) return `${plain}…`;
  // The sentence holding the plan word: after the last sentence end before it, to the first sentence end after it (or the text's end).
  let s0 = 0; for (const m of t.slice(0, w.at).matchAll(/[.!?。](?= )/g)) s0 = m.index! + 2;
  const endM = /[.!?。](?= |$)/.exec(t.slice(w.at + w.len)), s1 = endM ? w.at + w.len + endM.index + 1 : t.length;
  const c0 = clauseStart(t, s0, w.at);
  // The word (eojeol) holding the plan word, the one before it and the one after it.
  const e0 = t.lastIndexOf(' ', w.at) + 1, sp = t.indexOf(' ', w.at + w.len), e1 = sp < 0 ? t.length : sp;
  const p0 = e0 > s0 ? Math.max(s0, t.lastIndexOf(' ', e0 - 2) + 1) : e0;
  const sp2 = e1 < t.length ? t.indexOf(' ', e1 + 1) : -1, n1 = e1 < t.length ? (sp2 < 0 ? t.length : sp2) : e1;
  const spans: [number, number][] = [];
  const add = (a: number, b: number) => { if (a < b && !spans.some(([x, y]) => x === a && y === b)) spans.push([a, b]); };
  if (c0 > 0) add(c0, s1);
  add(e0, s1); if (c0 > 0) add(c0, e1); add(p0, e1); add(e0, n1); add(e0, e1);
  const render = (a: number, b: number, withHead: boolean): string | null => {
    const seg = t.slice(a, b).trim(), more = t.slice(b).trim() ? (/[.!?。]$/.test(seg) ? ' …' : '…') : '', before = t.slice(0, a).trimEnd();
    const fit = (out: string) => (widthOf(out) <= n ? out : null);
    if (!before) return fit(`${seg}${more}`);
    if (!withHead) return fit(`… ${seg}${more}`);
    // words (the top line, v9): the head ends on a whole word.
    const head = (words ? wordHead : headFit)(before, n - widthOf(`… ${seg}${more}`), widthOf);
    if ([...head].length < 2) return null;
    return fit(head === before ? `${t.slice(0, b).trim()}${more}` : `${head}… ${seg}${more}`);
  };
  for (const withHead of [true, false]) for (const [a, b] of spans) { const out = render(a, b, withHead); if (out) return out; }
  return t;
}
/** Room kept for the coverage counts, which are filled in last. */
const COVERAGE_ROOM = 256, META_BYTES = 32768, MIN_EXCERPT_BYTES = 600;

export function buildAsk(p: Project, v: StudioView, partId: string, intent: AskIntent, question: string | null): { ask: StudioAsk; refs: Map<string, string>; coverage: AskCoverage } {
  const part = v.parts.find(x => x.id === partId); if (!part) throw new Error('PART_MISSING');
  const name = (id: string) => clip(v.parts.find(x => x.id === id)?.name ?? '', 60);
  const allLinks = v.relations.filter(r => r.from === partId || r.to === partId).map(r => ({ other: name(r.from === partId ? r.to : r.from), direction: r.from === partId ? 'to' as const : 'from' as const, kind: r.kind, note: clip(r.note, 300) }));
  const allChildren = part.childIds.map(id => ({ name: name(id), status: v.parts.find(x => x.id === id)!.status }));
  const ask: StudioAsk = {
    version: STUDIO_SCHEMA, intent, question: intent === 'question' ? question : null,
    project: { name: clip(p.name, 120), purpose: p.space.brief ? clip(p.space.brief.text, 2000) : null },
    part: { name: clip(part.name, 60), note: clip(part.note, 2000), path: partPath(v, partId).map(x => clip(x.name, 60)).slice(-64),
      children: allChildren.slice(0, 200), links: allLinks.slice(0, 200) },
    current: { summary: part.summary ? clip(part.summary, 2000) : null, changes: part.changes.slice(0, 6).map(c => clip(c, 300)) },
    records: []
  };
  // Structure first, but bounded: relations and children shrink from the end, keeping at least one of each.
  while (askBytes(ask) > META_BYTES && ask.part.links.length > 1) ask.part.links.pop();
  while (askBytes(ask) > META_BYTES && ask.part.children.length > 1) ask.part.children.pop();
  const budget = ASK_BYTES - COVERAGE_ROOM, refs = new Map<string, string>(), all = subtreeRecords(v, partId);
  let cut = 0;
  // Newest first. A record that does not fit whole goes as a marked excerpt if a useful part fits; the rest are left out.
  for (const r of all) {
    if (ask.records.length >= ASK_RECORDS) break;
    const ref = `R${ask.records.length + 1}`, rec: AskRecord = { ref, kind: r.kind, at: r.at, part: name(r.partId!), text: clip(r.text, RECORD_CHARS), cut: r.text.length > RECORD_CHARS };
    ask.records.push(rec);
    if (askBytes(ask) <= budget) { refs.set(ref, r.id); if (rec.cut) cut++; continue; }
    rec.text = ''; const room = budget - askBytes(ask);
    if (room < MIN_EXCERPT_BYTES) { ask.records.pop(); break; }
    let lo = 0, hi = Math.min(r.text.length, RECORD_CHARS);
    while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); rec.text = clip(r.text, mid); if (askBytes(ask) <= budget) lo = mid; else hi = mid - 1; }
    rec.text = clip(r.text, lo); rec.cut = true;
    if (!rec.text.trim()) { ask.records.pop(); break; }
    refs.set(ref, r.id); cut++; break;
  }
  const coverage: AskCoverage = { records: { total: all.length, sent: ask.records.length, cut },
    links: { total: allLinks.length, sent: ask.part.links.length }, children: { total: allChildren.length, sent: ask.part.children.length } };
  ask.coverage = coverage;
  return { refs, ask, coverage };
}

export class StudioError extends Error { constructor(code: string) { super(code); this.name = 'StudioError'; } }
const fail = (code = 'INVALID_INPUT'): never => { throw new StudioError(code); };
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
function keys(v: unknown, allowed: string[], code?: string): Record<string, unknown> {
  if (!isObj(v)) fail(code); const o = v as Record<string, unknown>;
  if (Object.keys(o).length !== allowed.length || !allowed.every(k => k in o)) fail(code);
  return o;
}
function str(v: unknown, max: number, empty = false, code?: string): string {
  if (typeof v !== 'string' || v.length > max || (!empty && !v.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)) fail(code);
  return v as string;
}
function arr(v: unknown, max: number, code?: string): unknown[] { if (!Array.isArray(v) || v.length > max) fail(code); return v as unknown[]; }
const STATUSES = ['plan', 'active', 'reported', 'check'], KINDS = ['request', 'report', 'evidence', 'answer', 'decision'], RELS = ['flow', 'needs', 'shares', 'related'];

export function validateAsk(v: unknown): StudioAsk {
  const base = ['version', 'intent', 'question', 'project', 'part', 'current', 'records'];
  const o = keys(v, isObj(v) && 'coverage' in v ? [...base, 'coverage'] : base);
  if (o.version !== STUDIO_SCHEMA) fail('UNSUPPORTED_VERSION');
  if (!['summary', 'next', 'question'].includes(o.intent as string)) fail();
  if (o.intent === 'question') str(o.question, 1000); else if (o.question !== null) fail();
  const pr = keys(o.project, ['name', 'purpose']); str(pr.name, 120); if (pr.purpose !== null) str(pr.purpose, 2000);
  const pa = keys(o.part, ['name', 'note', 'path', 'children', 'links']); str(pa.name, 60); str(pa.note, 2000, true);
  for (const x of arr(pa.path, 64)) str(x, 60);
  for (const c of arr(pa.children, 200)) { const x = keys(c, ['name', 'status']); str(x.name, 60); if (!STATUSES.includes(x.status as string)) fail(); }
  for (const l of arr(pa.links, 200)) { const x = keys(l, ['other', 'direction', 'kind', 'note']); str(x.other, 60); if (!['to', 'from'].includes(x.direction as string) || !RELS.includes(x.kind as string)) fail(); str(x.note, 300, true); }
  const cu = keys(o.current, ['summary', 'changes']); if (cu.summary !== null) str(cu.summary, 2000); for (const c of arr(cu.changes, 6)) str(c, 300);
  const seen = new Set<string>();
  for (const r of arr(o.records, ASK_RECORDS)) {
    const x = keys(r, ['ref', 'kind', 'at', 'part', 'text', 'cut']);
    if (typeof x.ref !== 'string' || !/^R\d{1,2}$/.test(x.ref) || seen.has(x.ref)) fail(); seen.add(x.ref as string);
    if (!KINDS.includes(x.kind as string) || typeof x.cut !== 'boolean') fail();
    str(x.at, 30); str(x.part, 60); str(x.text, RECORD_CHARS);
  }
  if ('coverage' in o) {
    const c = keys(o.coverage, ['records', 'links', 'children']), n = (x: unknown) => Number.isSafeInteger(x) && (x as number) >= 0;
    const rc = keys(c.records, ['total', 'sent', 'cut']), lc = keys(c.links, ['total', 'sent']), cc = keys(c.children, ['total', 'sent']);
    const records = o.records as { cut: boolean }[];
    if (![rc.total, rc.sent, rc.cut, lc.total, lc.sent, cc.total, cc.sent].every(n) || rc.sent !== records.length || rc.cut !== records.filter(r => r.cut).length
      || (rc.total as number) < (rc.sent as number) || lc.sent !== (pa.links as unknown[]).length || (lc.total as number) < (lc.sent as number)
      || cc.sent !== (pa.children as unknown[]).length || (cc.total as number) < (cc.sent as number)) fail();
  }
  return structuredClone(o) as unknown as StudioAsk;
}
/** The model's reply: exact keys, bounded strings, and refs only to records that were actually sent. */
export function validateReply(v: unknown, ask: StudioAsk): StudioReply {
  const code = 'INVALID_RESPONSE';
  const o = keys(v, ['headline', 'situation', 'changes', 'next', 'answer', 'refs'], code);
  const headline = str(o.headline, 160, false, code).trim();
  const list = (x: unknown, max: number, min = 0) => { const a = arr(x, max, code).map(s => str(s, 400, false, code).trim()); if (a.length < min) fail(code); return a; };
  const situation = list(o.situation, 4, ask.intent === 'summary' ? 1 : 0), changes = list(o.changes, 4), next = list(o.next, 3);
  const answer = o.answer === null ? null : str(o.answer, 1600, false, code).trim();
  if (ask.intent === 'question' && answer === null) fail(code);
  const known = new Set(ask.records.map(r => r.ref)), refs = arr(o.refs, ASK_RECORDS, code).map(r => str(r, 4, false, code));
  if (refs.some(r => !known.has(r)) || new Set(refs).size !== refs.length) fail(code);
  return { headline, situation, changes, next, answer, refs };
}
