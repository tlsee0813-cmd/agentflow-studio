/* Where a verb (or a count) sits on a routed line: on a straight run of its own polyline, never at a corner, and never where
 * another line passes under it. Pure geometry; the app places the chips and measures their size. */
import type { Point } from './map-layout.js';

export type Rect = { x: number; y: number; w: number; h: number };
/** Corner radius of a drawn line (map-layout's rounded): a chip keeps this far from each corner. */
const CORNER = 8;

/** Candidate rectangles for a chip of w×h along a polyline, best first. 'long': the longest horizontal run first (a verb reads
 * along the flow), then shorter runs, then beside a vertical run. 'end' / 'start': the runs nearest that end first (a verb at
 * rest sits by the part its line points to). A run too short to hold the chip clear of both corners gives no spot.
 * pad: free line the chip keeps along its run on each side past the corners' clearance (a verb at rest keeps 8px), so it
 * never reads squeezed between two bends. */
export function labelSpots(pts: Point[], w: number, h: number, prefer: 'long' | 'end' | 'start' = 'long', pad = 0): Rect[] {
  type Seg = { a: Point; b: Point; horiz: boolean; len: number; idx: number };
  const segs: Seg[] = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!, horiz = Math.abs(a.y - b.y) < 0.5, len = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    if (len > 1) segs.push({ a, b, horiz, len, idx: i });
  }
  const n = pts.length - 1;
  // Room a chip needs along the run: its own length that way plus the corners at both ends (a first or last run has a port
  // at one end instead of a corner, which needs no clearance).
  const need = (s: Seg) => (s.horiz ? w : h) + (s.idx > 1 ? CORNER : 0) + (s.idx < n ? CORNER : 0) + 4 + pad * 2;
  const ok = segs.filter(s => s.len >= need(s));
  ok.sort((p, q) => {
    if (prefer === 'long') return Number(q.horiz) - Number(p.horiz) || q.len - p.len;
    const dp = prefer === 'end' ? n - p.idx : p.idx - 1, dq = prefer === 'end' ? n - q.idx : q.idx - 1;
    return dp - dq || Number(q.horiz) - Number(p.horiz) || q.len - p.len;
  });
  const out: Rect[] = [];
  for (const s of ok) {
    // Along the run: its middle, then towards the preferred end, kept clear of the corners.
    const forward = s.horiz ? s.b.x > s.a.x : s.b.y > s.a.y;
    // Clearance at the run's low end and high end (in x or y): the corner at a or at b, whichever lies there.
    const cA = s.idx > 1 ? CORNER : 0, cB = s.idx < n ? CORNER : 0, cLo = forward ? cA : cB, cHi = forward ? cB : cA;
    const span = s.horiz ? w : h, lo = cLo + 2 + pad + span / 2, hi = s.len - cHi - 2 - pad - span / 2;
    const ts = prefer === 'end' ? [0.5, 0.65, 0.8, 0.35, 0.2] : prefer === 'start' ? [0.5, 0.35, 0.2, 0.65, 0.8] : [0.5, 0.35, 0.65, 0.2, 0.8];
    for (const t of ts) {
      // Distance from a to the chip's centre, along the run, in the run's own direction.
      const d = Math.round(lo + (hi - lo) * (forward ? t : 1 - t));
      if (s.horiz) out.push({ x: Math.min(s.a.x, s.b.x) + d - w / 2, y: s.a.y - h / 2, w, h });
      else { const y = Math.min(s.a.y, s.b.y) + d - h / 2; out.push({ x: s.a.x + 4, y, w, h }, { x: s.a.x - w - 4, y, w, h }); }
    }
  }
  return out;
}
/** Beside a line just short of the part it points to (its end port), when no run of it holds the chip: above and below a last
 * run that arrives level, on either side of one that arrives upright, the chip's near edge gap from the tip (clear of the
 * arrowhead). The caller keeps only places clear of parts, other lines and the line itself. */
export function portSpots(pts: Point[], w: number, h: number, gap = 12): Rect[] {
  const n = pts.length; if (n < 2) return [];
  const tip = pts[n - 1]!, prev = pts[n - 2]!;
  if (Math.abs(tip.y - prev.y) < 0.5) {
    const x = tip.x > prev.x ? tip.x - gap - w : tip.x + gap;
    return [{ x, y: tip.y - h - 3, w, h }, { x, y: tip.y + 3, w, h }];
  }
  const y = tip.y > prev.y ? tip.y - gap - h : tip.y + gap;
  return [{ x: tip.x + 4, y, w, h }, { x: tip.x - w - 4, y, w, h }];
}
/** Whether a polyline passes through a rectangle grown by margin on every side. */
export function polylineHitsRect(pts: Point[], r: Rect, margin = 2): boolean {
  const x0 = r.x - margin, y0 = r.y - margin, x1 = r.x + r.w + margin, y1 = r.y + r.h + margin;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!;
    if (Math.max(a.x, b.x) < x0 || Math.min(a.x, b.x) > x1 || Math.max(a.y, b.y) < y0 || Math.min(a.y, b.y) > y1) continue;
    return true;
  }
  return false;
}
/** Restore (spec-cards-v2 §7 'Conditional relations'): where a text-free cue mark of s×s sits ON a line, its centre on the line
 * itself, at the places a badge would take from the line's start ('start' runs first, clear of the corners): each candidate chip
 * spot snapped back onto the nearest point of the polyline, one point per place. */
export function cuePoints(pts: Point[], s: number, prefer: 'long' | 'end' | 'start' = 'start'): Point[] {
  const out: Point[] = [];
  for (const r of labelSpots(pts, s, s, prefer)) {
    const p = nearestOn(pts, { x: r.x + r.w / 2, y: r.y + r.h / 2 });
    if (p && !out.some(q => Math.abs(q.x - p.x) < 0.5 && Math.abs(q.y - p.y) < 0.5)) out.push(p);
  }
  return out;
}
/** The point of a polyline nearest a given point (null for a polyline of fewer than two points). */
export function nearestOn(pts: Point[], q: Point): Point | null {
  let best: Point | null = null, bd = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!, dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / l2)) : 0;
    const p = { x: a.x + dx * t, y: a.y + dy * t }, d = (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
