/* A card's name as its face says it (polish 7, F7 Q3), shared by the card, the pane's title and the growth view (review of v7: a scene,
 * a list, the guide and a group title name a part exactly as its card does).
 * An identifier the record wrote in brackets after a card's plain-language name (「소비 폴더 (CONSUMPTION_DIR)」) is the card's second
 * name: the face reads the plain name, and the identifier reads as written under the pane's title and in the card's hover. It stays on the
 * face when it alone tells two same-named cards apart. A name that is only code keeps it. A bracket of plain words (「문서 소비기(Consumer)」,
 * 「OCR 도구(pyocr 첫 도구)」) is part of the name. */
import { codeToken } from './line-grammar.js';

const NAME_IDENT = /^(.*[가-힣].*?)\s*\(([^()\s]+)\)$/;
/** A token that reads as code in a name: codeToken's marks, never a bare capitalised word (「PostgreSQL」, 「GitHub」, 「StateManager」 are
 * names as much as code: they stay in the name's own type). */
// A word in brackets is a gloss, not a call (「Karpathy(karpathy)」, 「(tobspr)」), and a bracket the token only closes or opens is the
// name's own (a tag line's 「Base)」 of 「런처(Pocket Base)」): the token is read without them.
export const nameCode = (t: string): boolean => {
  let u = t.replace(/\([A-Za-z][A-Za-z0-9 .-]*\)/g, '');
  if ((u.match(/\(/g) ?? []).length !== (u.match(/\)/g) ?? []).length) u = u.replace(/^\(+|\)+$/g, '');
  return /^[\x21-\x7e]+$/.test(u) && codeToken(u) && !/^[A-Z][A-Za-z0-9]*$/.test(u); };
/** A name's plain words and its bracketed identifier, when the bracket holds code (else null: the name is read whole). */
export const nameSplit = (name: string): { plain: string; ident: string } | null => { const m = NAME_IDENT.exec(name.trim()); return m && nameCode(m[2]!) ? { plain: m[1]!.trim(), ident: m[2]! } : null; };
/** How many names of a set read as a word (a name whole, or its plain words): what tells two cards apart. */
export function faceCounts(names: readonly string[]): Map<string, number> {
  const count = new Map<string, number>();
  for (const n of names) { const s = nameSplit(n); for (const k of new Set([n.trim(), s?.plain ?? ''])) if (k) count.set(k, (count.get(k) ?? 0) + 1); }
  return count;
}
/** A name as the face says it among the names of the same map: its plain words and its identifier apart, unless the plain words are
 * another card's too (then whole, identifier none). */
export function faceSplit(name: string, counts: ReadonlyMap<string, number>): { name: string; ident: string | null } {
  const s = nameSplit(name);
  return s && (counts.get(s.plain) ?? 0) <= 1 ? { name: s.plain, ident: s.ident } : { name: name.trim(), ident: null };
}
/** The face's words of a name among others (the map's names; the name itself may be among them). */
export const facePlain = (name: string, names: readonly string[] = []): string => faceSplit(name, faceCounts(names.includes(name) ? names : [...names, name])).name;
