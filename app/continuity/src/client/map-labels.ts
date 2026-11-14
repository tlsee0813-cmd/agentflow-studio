/* Where a verb (or a count) sits on a routed line: on a straight run of its own polyline, never at a corner, and never where
 * another line passes under it. Pure geometry; the app places the chips and measures their size. */
import type { Point } from './map-layout.js';

export type Rect = { x: number; y: number; w: number; h: number };
/** A place beside a vertical run rather than on a level one (map hygiene H4: a verb at rest reads along a level run first). */
export type Spot = Rect & { beside?: true };
/** Corner radius of a drawn line (map-layout's rounded): a chip keeps this far from each corner. */
const CORNER = 8;

/** Candidate rectangles for a chip of w×h along a polyline, best first. 'long': the longest horizontal run first (a verb reads
 * along the flow), then shorter runs, then beside a vertical run. 'end' / 'start': the runs nearest that end first (a verb at
 * rest sits by the part its line points to). A run too short to hold the chip clear of both corners gives no spot.
 * pad: free line the chip keeps along its run on each side past the corners' clearance (a verb at rest keeps 8px), so it
 * never reads squeezed between two bends. */
export function labelSpots(pts: Point[], w: number, h: number, prefer: 'long' | 'end' | 'start' = 'long', pad = 0): Spot[] {
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
  const out: Spot[] = [];
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
      else { const y = Math.min(s.a.y, s.b.y) + d - h / 2; out.push({ x: s.a.x + 4, y, w, h, beside: true }, { x: s.a.x - w - 4, y, w, h, beside: true }); }
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
/** v9 (review of v8: a condition left the map at 1280 where its line ran between cards with no run free for it): places beside a run
 * rather than on it, its near edge gap off the line: above and below a level run, right and left of an upright one, from the run's start
 * in steps of a third of the chip (at least 6), every run long enough to hold the chip beside it; 'start' takes the runs nearest the
 * line's start first (a condition reads by the port it branches from), 'long' the longest first. The caller keeps only places clear of
 * the line itself, the parts and the other labels. */
export function besideSpots(pts: Point[], w: number, h: number, gap: number, prefer: 'long' | 'start' = 'start'): Rect[] {
  const runs: { a: Point; b: Point; horiz: boolean; len: number; idx: number }[] = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!, horiz = Math.abs(a.y - b.y) < 0.5, upright = Math.abs(a.x - b.x) < 0.5, len = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    if ((horiz || upright) && len >= (horiz ? w : h)) runs.push({ a, b, horiz, len, idx: i });
  }
  runs.sort((p, q) => (prefer === 'start' ? p.idx - q.idx : q.len - p.len));
  const out: Rect[] = [];
  for (const r of runs) {
    const span = r.horiz ? w : h, step = Math.max(6, span / 3), n = Math.floor((r.len - span) / step);
    for (let i = 0; i <= n; i++) {
      // From the run's own start, along its direction.
      const d = i * step, fwd = r.horiz ? r.b.x >= r.a.x : r.b.y >= r.a.y;
      if (r.horiz) { const x = fwd ? r.a.x + d : r.a.x - d - w; out.push({ x, y: r.a.y - gap - h, w, h }, { x, y: r.a.y + gap, w, h }); }
      else { const y = fwd ? r.a.y + d : r.a.y - d - h; out.push({ x: r.a.x + gap, y, w, h }, { x: r.a.x - gap - w, y, w, h }); }
    }
  }
  return out;
}
/** v14 fix 2 (verify of v14 fix 1: umami's 수집 API → 분배 계층 and shapez's Savegame → ReadWriteProxy, main flow lines, landed with no
 * word: each runs a few pixels between two cards, too short for a label on it or beside a stretch of it): places centred on each level or
 * upright run's middle, gap off it (above and below a level run, right and left of an upright one), however short the run, the longest run
 * first. The caller keeps only places clear of the line, the parts, the heads and the other labels. */
export function midSpots(pts: Point[], w: number, h: number, gap: number): Rect[] {
  const runs: { a: Point; b: Point; horiz: boolean; len: number }[] = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!, horiz = Math.abs(a.y - b.y) < 0.5, upright = Math.abs(a.x - b.x) < 0.5, len = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    if ((horiz || upright) && len >= 2) runs.push({ a, b, horiz, len });
  }
  runs.sort((p, q) => q.len - p.len);
  const out: Rect[] = [];
  for (const r of runs) {
    const mx = (r.a.x + r.b.x) / 2, my = (r.a.y + r.b.y) / 2;
    if (r.horiz) out.push({ x: mx - w / 2, y: my - gap - h, w, h }, { x: mx - w / 2, y: my + gap, w, h });
    else out.push({ x: mx + gap, y: my - h / 2, w, h }, { x: mx - gap - w, y: my - h / 2, w, h });
  }
  return out;
}
/** v10 (review of v9: labels sat on arrowheads): the room a line's end marks take, in map units at zoom k: a head of headPx screen pixels
 * at its last point (back along its last run, as wide as it is long), a start mark of startPx at its first point (0: none drawn), each
 * with 3px more on every side, so a label set clear of it never touches it. */
export function endZones(pts: Point[], headPx: number, startPx: number, k: number): Rect[] {
  const out: Rect[] = [], n = pts.length; if (n < 2) return out;
  const zone = (tip: Point, prev: Point, px: number) => {
    const s = px / k, m = 3 / k, dx = Math.sign(tip.x - prev.x), dy = Math.sign(tip.y - prev.y);
    // The mark runs back from the tip along the run (its own length) and half its width to each side.
    const x0 = dx ? Math.min(tip.x, tip.x - dx * s) : tip.x - s / 2, y0 = dy ? Math.min(tip.y, tip.y - dy * s) : tip.y - s / 2;
    out.push({ x: x0 - m, y: y0 - m, w: s + 2 * m, h: s + 2 * m });
  };
  if (headPx > 0) zone(pts[n - 1]!, pts[n - 2]!, headPx);
  if (startPx > 0) zone(pts[0]!, pts[1]!, startPx);
  return out;
}
/** v10 (review of v9: at 1280 two maps kept a one-line top sentence with 80px free under them): how far the map may move down (screen
 * pixels) before anything of it (content: its cards, lines, labels and title as drawn) comes within gap of what sits at the window's
 * bottom over it (obstacles: the tools, the first view's line, the legend chip; each only over the columns it covers) or of the window's
 * bottom itself; never below 0. */
export function dockSlack(content: readonly Rect[], obstacles: readonly Rect[], bottom: number, gap = 8): number {
  if (!content.length) return 0;
  let room = bottom - gap - Math.max(...content.map(c => c.y + c.h));
  for (const o of obstacles) for (const c of content) if (c.x < o.x + o.w && o.x < c.x + c.w) room = Math.min(room, o.y - gap - (c.y + c.h));
  return Math.max(0, room);
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
