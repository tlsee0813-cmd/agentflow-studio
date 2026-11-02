/* Where a verb (or a count) sits on a routed line: on a straight run of its own polyline, never at a corner, and never where
 * another line passes under it. Pure geometry; the app places the chips and measures their size. */
import type { Point } from './map-layout.js';

export type Rect = { x: number; y: number; w: number; h: number };
/** Corner radius of a drawn line (map-layout's rounded): a chip keeps this far from each corner. */
const CORNER = 8;

/** Candidate rectangles for a chip of w×h along a polyline, best first. 'long': the longest horizontal run first (a verb reads
 * along the flow), then shorter runs, then beside a vertical run. 'end' / 'start': the runs nearest that end first (a verb at
 * rest sits by the part its line points to). A run too short to hold the chip clear of both corners gives no spot. */
export function labelSpots(pts: Point[], w: number, h: number, prefer: 'long' | 'end' | 'start' = 'long'): Rect[] {
  type Seg = { a: Point; b: Point; horiz: boolean; len: number; idx: number };
  const segs: Seg[] = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!, horiz = Math.abs(a.y - b.y) < 0.5, len = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    if (len > 1) segs.push({ a, b, horiz, len, idx: i });
  }
  const n = pts.length - 1;
  // Room a chip needs along the run: its own length that way plus the corners at both ends (a first or last run has a port
  // at one end instead of a corner, which needs no clearance).
  const need = (s: Seg) => (s.horiz ? w : h) + (s.idx > 1 ? CORNER : 0) + (s.idx < n ? CORNER : 0) + 4;
  const ok = segs.filter(s => s.len >= need(s));
  ok.sort((p, q) => {
    if (prefer === 'long') return Number(q.horiz) - Number(p.horiz) || q.len - p.len;
    const dp = prefer === 'end' ? n - p.idx : p.idx - 1, dq = prefer === 'end' ? n - q.idx : q.idx - 1;
    return dp - dq || Number(q.horiz) - Number(p.horiz) || q.len - p.len;
  });
  const out: Rect[] = [];
  for (const s of ok) {
    // Along the run: its middle, then towards the preferred end, kept clear of the corners.
    const span = s.horiz ? w : h, lo = (s.idx > 1 ? CORNER : 0) + 2 + span / 2, hi = s.len - (s.idx < n ? CORNER : 0) - 2 - span / 2;
    const ts = prefer === 'end' ? [0.5, 0.65, 0.8, 0.35, 0.2] : prefer === 'start' ? [0.5, 0.35, 0.2, 0.65, 0.8] : [0.5, 0.35, 0.65, 0.2, 0.8];
    const forward = s.horiz ? s.b.x > s.a.x : s.b.y > s.a.y;
    for (const t of ts) {
      // Distance from a to the chip's centre, along the run, in the run's own direction.
      const d = Math.round(lo + (hi - lo) * (forward ? t : 1 - t));
      if (s.horiz) out.push({ x: Math.min(s.a.x, s.b.x) + d - w / 2, y: s.a.y - h / 2, w, h });
      else { const y = Math.min(s.a.y, s.b.y) + d - h / 2; out.push({ x: s.a.x + 4, y, w, h }, { x: s.a.x - w - 4, y, w, h }); }
    }
  }
  return out;
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
