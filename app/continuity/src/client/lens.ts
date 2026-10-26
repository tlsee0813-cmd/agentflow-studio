/* Where a reading surface (the selection lens, or the change comparison) sits: beside what it is about, never over it.
 * One decision per selection from a fixed list of places beside the part's own group; when none is clear, the surface docks
 * along the bottom of the map (a stable reading strip next to the map, not a floating panel). A later pan or zoom moves it
 * with its part in the arrangement chosen; nothing here moves the camera. */
export interface Rect { x: number; y: number; w: number; h: number }
export type LensSide = 'right' | 'left' | 'below' | 'above' | 'dock';
/** dy: the top relative to the part's top when placed beside (right and left); h: the height it was given; w: a docked
 * surface's width (it reads near its part, as wide as its content needs). */
export interface LensPlace { side: LensSide; x: number; y: number; h: number; dy: number; w?: number }

export const overlap = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const GAP = 14;
/** The least height a surface may be given beside its part before its body scrolls instead of the place being refused. */
const MIN_H = 240;

/** The docked place: the bottom of the map area, its full width. */
export const dockPlace = (h: number, area: Rect): { x: number; y: number } => ({ x: area.x, y: area.y + area.h - h });
/** Where the surface goes after the camera moved (or the part was dragged), in the arrangement chosen for this selection. */
export function follow(place: LensPlace, part: Rect, beside: Rect, w: number, h: number, area: Rect): { x: number; y: number } {
  if (place.side === 'dock') return dockPlace(h, area);
  if (place.side === 'below') return { x: beside.x, y: beside.y + beside.h + GAP };
  if (place.side === 'above') return { x: beside.x, y: beside.y - GAP - h };
  return { x: place.side === 'right' ? beside.x + beside.w + GAP : beside.x - GAP - w, y: part.y + place.dy };
}

/**
 * part: the selected part (or the parts a change touches) on screen. beside: what the surface stands next to: the group the
 * part sits in, so its own group stays readable. protect: the part, its group, the other ends of its lines and the scope's
 * title. Places are tried in order: right, then left of the group (at the part's height, under a protected head above it, or
 * at the top), then below or above the group. The whole height wins first; else the tallest clear place beside it, down to
 * MIN_H (its body scrolls). others: every other part on screen; a place that would hide one of them is not clear.
 * Otherwise the dock.
 */
export function placeLens(part: Rect, beside: Rect, protect: Rect[], size: { w: number; h: number }, area: Rect, others: Rect[] = []): LensPlace {
  // Clear: covers nothing protected, and hides no other part on the map whole (most of it under the surface).
  const hides = (r: Rect) => others.some(q => q.w * q.h > 0 && overlap(r, q) > q.w * q.h * 0.6);
  const bottom = area.y + area.h, clear = (r: Rect) => protect.every(q => overlap(r, q) < 1) && !hides(r);
  const inArea = (r: Rect) => r.x >= area.x - 0.5 && r.y >= area.y - 0.5 && r.x + r.w <= area.x + area.w + 0.5 && r.y + r.h <= bottom + 0.5;
  const above = protect.filter(q => q.y + q.h <= part.y + 1 && q.x < part.x + part.w && part.x < q.x + q.w).map(q => q.y + q.h + 8);
  const tops = [...new Set([part.y - 6, ...above, area.y].map(y => Math.max(area.y, Math.round(y))))];
  let best: LensPlace | null = null;
  for (const side of ['right', 'left'] as const) {
    const x = side === 'right' ? beside.x + beside.w + GAP : beside.x - GAP - size.w;
    if (x < area.x - 0.5 || x + size.w > area.x + area.w + 0.5) continue;
    for (const y of tops) {
      const h = Math.min(size.h, bottom - y);
      if (h < Math.min(size.h, MIN_H) || !clear({ x, y, w: size.w, h })) continue;
      if (h >= size.h) return { side, x, y, h, dy: y - part.y };
      if (!best || h > best.h) best = { side, x, y, h, dy: y - part.y };
    }
  }
  if (best) return best;
  const x = Math.min(Math.max(beside.x, area.x), area.x + area.w - size.w);
  for (const [side, y] of [['below', beside.y + beside.h + GAP], ['above', beside.y - GAP - size.h]] as const) {
    const r = { x, y, w: size.w, h: size.h };
    if (inArea(r) && clear(r)) return { side, x, y, h: size.h, dy: y - part.y };
  }
  return { side: 'dock', x: area.x, y: area.y, h: 0, dy: 0 };
}
