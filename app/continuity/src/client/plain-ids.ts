/* Polish round fixes 1 (spec-cards-v2 §1, §3): the record's own row IDs (D08, B03, X01, LN13, B03:S02) are its bookkeeping, not
 * words a reader takes: on the map's labels, its tips, the pane's rows and the detail view's ports they read as noise and spend
 * the few characters a cut label has. Display only: the stored words are never changed, and the evidence view (원문) keeps them
 * as written. No DOM. */
import type { StudioView } from '../shared/studio.js';

/** One leading record row ID: one or two capitals and two digits (a lower letter for an alternative, a step or loop after a colon),
 * never three or more digits (「H100 GPU」, 「A100」 stay) and never one digit (「V8」). */
const ID = String.raw`[A-Z]{1,2}\d{2}(?!\d)[a-z]?(?::[A-Z]{1,2}\d{1,3}[a-z]?)?`;
/** The ID at the start of a text, of a list item (after 「,」 「·」 「;」 「/」) or of a bracket, followed by its words. */
const LEAD = new RegExp(String.raw`(^|[,·;/]\s*|[→←]\s*|[(（]\s*)${ID}\s*[:：]?\s+(?=\S)`, 'g');
/** A text without the record row IDs that lead its words (「D08 wandb.log」 → 「wandb.log」, 「input.txt · D01 train.bin」 →
 * 「input.txt · train.bin」); an ID that is all there is stays (nothing else names the thing). */
export function plainIds(t: string): string {
  const out = t.replace(LEAD, '$1').replace(/\s{2,}/g, ' ').trim();
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

/** The map's view with the parts' port names said without their row IDs (inputs, outputs and the port-map rows that name them, so a
 * line still finds its port). A copy: the view studioView built is left as it is. */
export function plainView(v: StudioView): StudioView {
  const strip = (xs: readonly string[]) => [...new Set(xs.map(plainIds))];
  return { ...v, parts: v.parts.map(p => (p.reading ? { ...p, reading: { ...p.reading, inputs: strip(p.reading.inputs), outputs: strip(p.reading.outputs),
    ...(p.reading.portMap ? { portMap: p.reading.portMap.map(m => ({ ...m, port: plainIds(m.port) })) } : {}) } } : p)) };
}
