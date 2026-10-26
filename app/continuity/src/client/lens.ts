/* Where the selection lens sits: beside the selected part, never over what the selection is about. One decision per selection
 * from a fixed list of places; when none is clear the lens takes the one fixed reading place at the right edge of the map. A
 * later pan or zoom moves the lens with its part, keeping the arrangement chosen for this selection; nothing here moves the
 * camera. */
export interface Rect { x: number; y: number; w: number; h: number }
export type LensSide = 'right' | 'left' | 'below' | 'fixed';
/** dy: the lens's top relative to the anchor's top when it was placed (right and left); h: the height it was given. */
export interface LensPlace { side: LensSide; x: number; y: number; h: number; dy: number }

const overlap = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const GAP = 14;
/** The least height a lens may be given before its body scrolls instead of the place being refused. */
const MIN_H = 240;

/** The fixed reading place: top right of the map area. */
export const fixedPlace = (w: number, area: Rect): { x: number; y: number } => ({ x: area.x + area.w - w, y: area.y });
/** Where the lens goes for this anchor on the side chosen earlier (the camera moved, or the part was dragged). */
export function follow(place: LensPlace, anchor: Rect, w: number, area: Rect): { x: number; y: number } {
  if (place.side === 'fixed') return fixedPlace(w, area);
  if (place.side === 'below') return { x: anchor.x, y: anchor.y + anchor.h + GAP };
  return { x: place.side === 'right' ? anchor.x + anchor.w + GAP : anchor.x - GAP - w, y: anchor.y + place.dy };
}

/**
 * anchor: the selected part on screen. protect: what must stay readable (the part, the other ends of its lines, the head
 * above it). Places are tried in order: right, then left, at the part's top or just under the protected head above it or at
 * the top of the map; then below the part. The first that fits the area and covers nothing wins; a tall lens may be given
 * less height (its body scrolls) down to MIN_H. Otherwise the fixed reading place.
 */
export function placeLens(anchor: Rect, protect: Rect[], size: { w: number; h: number }, area: Rect): LensPlace {
  const bottom = area.y + area.h, clear = (r: Rect) => protect.every(q => overlap(r, q) < 1);
  const above = protect.filter(q => q.y + q.h <= anchor.y + 1 && q.x < anchor.x + anchor.w && anchor.x < q.x + q.w).map(q => q.y + q.h + 8);
  const tops = [...new Set([anchor.y - 6, ...above, area.y].map(y => Math.max(area.y, Math.round(y))))];
  // Whole height first (right, then left); else the tallest clear place beside the part.
  let best: LensPlace | null = null;
  for (const side of ['right', 'left'] as const) {
    const x = side === 'right' ? anchor.x + anchor.w + GAP : anchor.x - GAP - size.w;
    if (x < area.x - 0.5 || x + size.w > area.x + area.w + 0.5) continue;
    for (const y of tops) {
      const h = Math.min(size.h, bottom - y);
      if (h < Math.min(size.h, MIN_H) || !clear({ x, y, w: size.w, h })) continue;
      if (h >= size.h) return { side, x, y, h, dy: y - anchor.y };
      if (!best || h > best.h) best = { side, x, y, h, dy: y - anchor.y };
    }
  }
  if (best) return best;
  const x = Math.min(Math.max(anchor.x, area.x), area.x + area.w - size.w), y = anchor.y + anchor.h + GAP, h = Math.min(size.h, bottom - y);
  if (h >= Math.min(size.h, MIN_H) && clear({ x, y, w: size.w, h })) return { side: 'below', x, y, h, dy: y - anchor.y };
  const f = fixedPlace(size.w, area);
  return { side: 'fixed', ...f, h: Math.min(size.h, area.h), dy: 0 };
}
