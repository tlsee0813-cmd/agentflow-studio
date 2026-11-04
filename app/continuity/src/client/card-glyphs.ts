/* A card's glyph (map design v3 3.2): one inline SVG per kind on a 16×16 viewBox, drawn with a 1.5 stroke, round caps and joins
 * and no fill, on a 20px tile. The glyph names the kind; the tile's low-chroma colour names the family and is the only colour a
 * card carries (styles.css .glyph-tile). Kinds stay apart in greyscale: every kind has its own shape, and the kind word is always
 * written beside it. The composition badge is a capability (a part with an inside), drawn as a small badge on the tile, never in
 * place of the part's own glyph. Strings only: no DOM. */
import type { PartType } from '../shared/types.js';

/** A glyph's key: a part type, the neutral square for a part with no type word, or the composition badge. */
export type GlyphKey = PartType | 'neutral' | 'composition';

/** The SVG body of each glyph (the shapes inside a 16×16 viewBox). */
export const GLYPH: Record<GlyphKey, string> = {
  person: '<circle cx="8" cy="5.5" r="2.5"/><path d="M3.5 13.5c.6-2.6 2.4-4 4.5-4s3.9 1.4 4.5 4"/>',
  session: '<rect x="2" y="3" width="12" height="10" rx="2"/><path d="M5 7l2 1.5L5 10M8.5 10.5h2.5"/>',
  external: '<rect x="2.5" y="5" width="8.5" height="8.5" rx="1.5"/><path d="M9 2.5h4.5V7M13.5 2.5 8 8"/>',
  loop: '<path d="M12.5 8a4.5 4.5 0 1 1-1.3-3.2"/><path d="M11.6 2.3v2.6H9"/>',
  store: '<rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/><path d="M5 2.5v11M7.5 6h4M7.5 9h4"/>',
  ai: '<path d="M8 2.5l1.4 3.6L13 7.5l-3.6 1.4L8 12.5l-1.4-3.6L3 7.5l3.6-1.4z"/>',
  timer: '<circle cx="8" cy="8.5" r="5"/><path d="M8 6v2.7l1.8 1.1M6.5 2h3"/>',
  compute: '<path d="M10.5 3h-1a2 2 0 0 0-2 2v6.5a2 2 0 0 1-2 2h-1M5 7.5h5"/>',
  collector: '<path d="M2.5 9.5h3l1 2h3l1-2h3M2.5 9.5 4 4h8l1.5 5.5v3.5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z"/>',
  actor: '<path d="M2.5 8h11M10.5 5l3 3-3 3M7 3.5v9"/>',
  neutral: '<rect x="3.5" y="3.5" width="9" height="9" rx="2"/>',
  composition: '<rect x="2.5" y="2.5" width="11" height="11" rx="2"/><rect x="5" y="5" width="3" height="3" rx=".6"/><rect x="8.5" y="8.5" width="2.5" height="2.5" rx=".6"/>'
};

/** The whole <svg> of a glyph, sized by its container (CSS), hidden from assistive technology (the kind word says it). */
export function glyphSvg(key: GlyphKey): string {
  return `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${GLYPH[key]}</svg>`;
}
