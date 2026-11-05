/* Polish round fixes 1 (spec-cards-v2 §1, §3): the record's own row IDs (D08, B03, X01, LN13, B03:S02) are its bookkeeping, not
 * words a reader takes: on the map's labels, its tips, the pane's rows and the detail view's ports they read as noise and spend
 * the few characters a cut label has. Display only: the stored words are never changed, and the evidence view (원문) keeps them
 * as written. No DOM.
 * Polish round fixes 2: an ID that stands for something the record names (a data item, a part, a condition, a variant) is said by
 * that name wherever it stands (「질의 → D07」 → 「질의 → 검색 결과」, a step's 「B04」 → 「configurator.py」); one it names nothing for
 * is left off with its arrow; and only IDs the record itself defines are touched (「FP16 가중치」, 「X11 디스플레이」 stay). */
import type { StudioView } from '../shared/studio.js';
import type { Project } from '../shared/types.js';
import { isMapReading } from '../shared/types.js';
import { readRecordTables } from '../shared/record-table.js';

/** The record's row-ID prefixes (v5 table definitions: B, GR, LN, L, S, D, CD, X, K, F, …). A token of another shape that happens to be
 * two capitals and two digits (FP16, BF16, TF32) is a technical name, never a row ID. */
const PREFIX = 'B|GR|LN|L|SM|WD|ST|CK|S|D|CD|CH|CO|RU|N|X|K|IS|GT|UN|DB|F|E|P';
/** One record row ID: a known prefix and two digits (a lower letter for an alternative, a step or loop after a colon), never three or
 * more digits (「H100 GPU」, 「A100」 stay) and never one digit (「V8」). */
const ID = String.raw`(?:${PREFIX})\d{2}(?!\d)[a-z]?(?::[A-Z]{1,2}\d{1,3}[a-z]?)?`;
const NOT_WORD_BEFORE = String.raw`(?<![A-Za-z0-9_.])`, NOT_WORD_AFTER = String.raw`(?![A-Za-z0-9_])`;
/** The ID at the start of a text, of a list item (after 「,」 「·」 「;」 「/」) or of a bracket, followed by its words. */
const LEAD = new RegExp(String.raw`(^|[,·;/]\s*|[→←]\s*|[(（]\s*)(${ID})\s*[:：]?\s+(?=\S)`, 'g');
/** An ID right before an opening bracket: 「D01(요청 인터셉터 …)」 reads its bracket's words. */
const BRACKETED = new RegExp(String.raw`${NOT_WORD_BEFORE}(${ID})\s*[(（]([^()（）]*)(?:[)）]|$)`, 'g');
/** An ID that is all its bracket holds: 「run(B03)」. */
const IN_BRACKET = new RegExp(String.raw`[(（]\s*(${ID})\s*[)）]`, 'g');
/** Any other ID standing alone, with what joins it to the words before (an arrow, 「와」·「과」·「및」, a list mark). */
const ALONE = new RegExp(String.raw`(\s*(?:→|->|←|와|과|및|,|·)\s*|\s+|^)${NOT_WORD_BEFORE}(${ID})${NOT_WORD_AFTER}(?=$|[\s,·;)）。.]|[가-힣])`, 'g');

/** What the record's row IDs stand for: the IDs it defines (a row's first cell) and the name it gives some of them. */
export interface IdGloss { ids: ReadonlySet<string> | null; names: ReadonlyMap<string, string> }
const NO_GLOSS: IdGloss = { ids: null, names: new Map() };
const head = (id: string) => id.split(':')[0]!;
const defined = (id: string, g: IdGloss) => !g.ids || g.ids.has(id) || g.ids.has(head(id)) || g.names.has(id);

/** A text without the record row IDs that lead its words (「D08 wandb.log」 → 「wandb.log」, 「input.txt · D01 train.bin」 →
 * 「input.txt · train.bin」); an ID elsewhere said by its name when the gloss has one (「→ D07」 → 「→ 검색 결과」), else left off with
 * its arrow or joining word; an ID that is all there is stays (nothing else names the thing), or reads its name. */
export function plainIds(t: string, g: IdGloss = NO_GLOSS): string {
  if (!t) return t;
  const alone = new RegExp(String.raw`^\s*(${ID})\s*$`).exec(t);
  if (alone) return g.names.get(alone[1]!) ?? t;
  const out = t
    .replace(LEAD, (all, pre: string, id: string) => (defined(id, g) ? pre : all))
    .replace(IN_BRACKET, (all, id: string) => (defined(id, g) ? (g.names.get(id) ? `(${g.names.get(id)})` : '') : all))
    .replace(BRACKETED, (all, id: string, words: string) => (defined(id, g) ? (g.names.get(id) && !words.trim() ? g.names.get(id)! : words.trim() || all) : all))
    .replace(ALONE, (all: string, pre: string, id: string, at: number, whole: string) => {
      if (!defined(id, g)) return all;
      const name = g.names.get(id);
      if (name) return `${pre}${name}`;
      // A particle right after it (「D07의」) needs the ID to stand: it stays when nothing names it.
      if (/[가-힣]/.test(whole[at + all.length] ?? '')) return all;
      // Nothing names it: the arrow or joining word goes with it; a bare ID after words leaves only the words.
      return /[→←>]/.test(pre) || /^\s*(?:와|과|및|,|·)\s*$/.test(pre) ? '' : pre.replace(/\S+/g, '');
    })
    .replace(/\s{2,}/g, ' ').replace(/\s+([,;)）])/g, '$1').replace(/[(（]\s*[)）]/g, '').trim();
  return out || t;
}
/** The text is nothing but one record row ID (a condition written as 「CD06」: it points at another row and says nothing itself). */
export const idOnly = (t: string): boolean => new RegExp(String.raw`^\s*${ID}\s*$`).test(t);

/** A variant's name: the part that implements it, as its C-VARIANT row names it (the gloss reads 「implementer · condition」), without
 * the bracket after the name. */
export function variantName(id: string, gloss: ReadonlyMap<string, string>): string | null {
  const g = gloss.get(id); if (!g) return null;
  const name = g.split(' · ')[0]!.replace(/\s*[(（][^)）]*[)）]?\s*$/, '').trim();
  return name || null;
}
/** A text with each variant ID it names said by the variant's name, once (「변형 X01」 and 「X01(… · …)」 read 「변형 ‘다중 에이전트 그래프’」);
 * an ID the gloss does not know stays as written. */
export function nameVariants(text: string, gloss: ReadonlyMap<string, string>): string {
  if (!gloss.size) return text;
  return text.replace(/(변형\s*)?\b(X\d{1,3})\b(\s*[(（](?:[^()（）]|[(（][^()（）]*[)）])*[)）])?/g, (all, _v: string | undefined, id: string) => {
    const n = variantName(id, gloss); return n ? `변형 ‘${n}’` : all;
  });
}

const ROW_ID = /^[A-Z]{1,2}\d{2,3}[a-z]?(?::[A-Z]{1,2}\d{1,3}[a-z]?)?$/;
const glossCache = new WeakMap<Project, IdGloss>();
/** The project's record row IDs and the names the record gives them: a C-DATA row by its 이름, a C-PART row by the part's name on the
 * map, a C-COND row by its condition's words, a C-VARIANT row by its implementer. ids: every row's first cell in the records the
 * project holds (pasted), so only an ID the record defines is ever left off. partName: the map's name for an area. */
export function projectIdGloss(p: Project, partName: (areaId: string) => string | null, variants: ReadonlyMap<string, string> = new Map()): IdGloss {
  const hit = glossCache.get(p); if (hit) return hit;
  const ids = new Set<string>(), names = new Map<string, string>();
  for (const r of p.pasted ?? []) for (const t of readRecordTables(r.text).tables) for (const row of t.rows) {
    const c = (row.byColumn['행 ID'] ?? row.cells[0]?.text ?? '').trim(); if (ROW_ID.test(c)) ids.add(c);
  }
  for (const r of p.readings) if (isMapReading(r)) {
    for (const a of r.artifacts ?? []) if (a.recordRef && a.name) names.set(a.recordRef, a.name);
    for (const x of r.parts) {
      const n = x.recordRef ? partName(x.areaId) ?? x.created?.name ?? null : null; if (x.recordRef && n) names.set(x.recordRef, n);
      for (const l of x.loops ?? []) if (l.recordRef) names.set(l.recordRef, l.unit ? `‘${l.unit}’ 반복` : '반복');
      for (const c of x.conditions ?? []) { const m = /^\|\s*([A-Z]{1,2}\d{2,3})\s*\|/.exec(c.quote?.quote ?? ''); if (m && c.when) names.set(m[1]!, c.when); }
    }
  }
  for (const id of variants.keys()) { const n = variantName(id, variants); if (n) names.set(id, `변형 ‘${n}’`); }
  for (const id of names.keys()) ids.add(id);
  const out: IdGloss = { ids: ids.size ? ids : null, names }; glossCache.set(p, out); return out;
}

/** The map's view with the parts' port names said without their row IDs (inputs, outputs and the port-map rows that name them, so a
 * line still finds its port). A copy: the view studioView built is left as it is. */
export function plainView(v: StudioView, g: IdGloss = NO_GLOSS): StudioView {
  const strip = (xs: readonly string[]) => [...new Set(xs.map(x => plainIds(x, g)))];
  return { ...v, parts: v.parts.map(p => (p.reading ? { ...p, reading: { ...p.reading, inputs: strip(p.reading.inputs), outputs: strip(p.reading.outputs),
    ...(p.reading.portMap ? { portMap: p.reading.portMap.map(m => ({ ...m, port: plainIds(m.port, g) })) } : {}) } } : p)) };
}
