/* v13 (review of v12: 13 ◇ marks at 1280 whose 24px target met a card): the further places a line's mark (◇, 선택's ring, ···) may take
 * when the places near its port are all taken: every 3 screen px along its own line (from its port, short of its head's last run), then
 * just beside the line (10, 13 and 16 screen px off it, either side, the nearer first). A mark beside its line still reads as its own (it
 * is the line's hover and opens the line); one on a card read as the card's. Pure: the line is given as a point-at-length function. */
export interface Pt { x: number; y: number }
export interface Spot { x: number; y: number; w: number; h: number }
/** How far short of its end a mark stays (screen px): the head's run (the head 9–10px and its gap). */
export const CUE_HEAD_RUN = 16;
/** The offsets beside the line (screen px), nearer first. */
export const CUE_BESIDE = [10, 13, 16] as const;
/** at: the line's point at a length (map units); len: its length (map units); inv: map units per screen px; s: the mark's height and
 * w its width (map units). Each spot is the mark's box, its centre on the place. */
export function cueSpots(at: (d: number) => Pt, len: number, inv: number, s: number, w: number): { along: Spot[]; beside: Spot[] } {
  const along: Spot[] = [], beside: Spot[] = [], step = 3 * inv, end = len - CUE_HEAD_RUN * inv;
  const box = (p: Pt): Spot => ({ x: p.x - s / 2, y: p.y - s / 2, w, h: s });
  for (let d = 6 * inv; d <= end; d += step) along.push(box(at(d)));
  for (const off of CUE_BESIDE) for (let d = 6 * inv; d <= end; d += 2 * step) {
    const a = at(Math.max(0, d - inv)), b = at(Math.min(len, d + inv)), dx = b.x - a.x, dy = b.y - a.y, n = Math.hypot(dx, dy); if (n < 1e-6) continue;
    const p = at(d), nx = -dy / n, ny = dx / n;
    for (const sg of [1, -1]) beside.push(box({ x: p.x + sg * nx * off * inv, y: p.y + sg * ny * off * inv }));
  }
  return { along, beside };
}
/** v13 merge (the opening waited 3.5 s on umami: a mark's further places asked the browser for a point at every 3px of its line, each ask
 * walking the whole path): a drawn line's points read from its own path data once (M, L and Q, each curve flattened to 8 chords), its
 * point at a length found on that walk. null for a path written with any other command (the caller asks the browser then). */
export function pathWalk(d: string): { len: number; at: (s: number) => Pt } | null {
  const toks = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g); if (!toks || !toks.length) return null;
  const pts: Pt[] = []; let i = 0, cmd = '';
  const num = () => Number(toks[i++]);
  while (i < toks.length) {
    if (/[A-Za-z]/.test(toks[i]!)) cmd = toks[i++]!;
    if (cmd === 'M' || cmd === 'L') { const x = num(), y = num(); if (!Number.isFinite(x) || !Number.isFinite(y)) return null; pts.push({ x, y }); }
    else if (cmd === 'Q') {
      const p0 = pts.at(-1); if (!p0) return null;
      const cx = num(), cy = num(), x = num(), y = num(); if (![cx, cy, x, y].every(Number.isFinite)) return null;
      for (let k = 1; k <= 8; k++) { const t = k / 8, u = 1 - t; pts.push({ x: u * u * p0.x + 2 * u * t * cx + t * t * x, y: u * u * p0.y + 2 * u * t * cy + t * t * y }); }
    } else return null;
  }
  if (!pts.length) return null;
  const cum = [0]; for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1]! + Math.hypot(pts[k]!.x - pts[k - 1]!.x, pts[k]!.y - pts[k - 1]!.y));
  const len = cum.at(-1)!;
  const at = (s: number): Pt => {
    const d0 = Math.max(0, Math.min(len, s)); let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m]! <= d0) lo = m; else hi = m; }
    const a = pts[lo]!, b = pts[hi] ?? a, span = cum[hi]! - cum[lo]!, t = span > 0 ? (d0 - cum[lo]!) / span : 0;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  };
  return { len, at };
}
