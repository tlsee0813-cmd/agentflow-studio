/* Cards v2 (spec cards v2 §2, §3, §7): the map's one hover surface. Pure: its timing and its placement, no DOM.
 * - Highlight at once; the reading popup opens after HOVER_OPEN_MS of dwell and closes HOVER_GRACE_MS after the pointer leaves
 *   both the target and the popup (WCAG 1.4.13: hoverable, dismissable with Esc, persistent while hovered); keyboard focus opens
 *   the same content. Never while dragging, panning or zooming.
 * - Anchored near the target: beside a card (never over its name), at a line's midpoint off the line's two end cards; it does not
 *   follow the pointer and keeps its side while it stays on one target. */

export const HOVER_OPEN_MS = 400;
export const HOVER_GRACE_MS = 150;
/** The rest of the map steps back only after the popup's dwell (passing over cards never flickers). */
export const DIM_AFTER_MS = HOVER_OPEN_MS;

export interface Rect { x: number; y: number; w: number; h: number }
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (a: Rect, b: Rect) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
export type TipSide = 'right' | 'left' | 'below' | 'above';
/** Where the popup goes for a target (all in one coordinate space): 'beside' a box (right, left, below, above: the first that fits
 * inside bounds and covers nothing in avoid), or at a 'point' (a line's midpoint: below-right, above-right, below-left, above-left
 * of it, off avoid). prefer: the side it took last time on this target (kept while it still fits). Clamped into bounds. */
/** soft (polish round fixes 2): what the popup should rather not cover (every other card in view): kept off when a place allows it,
 * else given up before anything in avoid (the line's own end cards and the names stay hard obstacles: spec §7). */
export function placeTip(target: Rect, size: { w: number; h: number }, bounds: Rect, mode: 'beside' | 'point', avoid: readonly Rect[] = [], prefer: TipSide | null = null, gap = 8, soft: readonly Rect[] = []): { x: number; y: number; side: TipSide } {
  const { w, h } = size;
  const at: Record<TipSide, Rect> = mode === 'beside'
    ? { right: { x: target.x + target.w + gap, y: target.y, w, h }, left: { x: target.x - gap - w, y: target.y, w, h },
      below: { x: target.x, y: target.y + target.h + gap, w, h }, above: { x: target.x, y: target.y - gap - h, w, h } }
    : { below: { x: target.x + gap, y: target.y + gap, w, h }, above: { x: target.x + gap, y: target.y - gap - h, w, h },
      right: { x: target.x + gap, y: target.y + gap, w, h }, left: { x: target.x - gap - w, y: target.y + gap, w, h } };
  const order: TipSide[] = mode === 'beside' ? ['right', 'left', 'below', 'above'] : ['below', 'above', 'left', 'right'];
  if (prefer) order.unshift(...order.splice(order.indexOf(prefer), 1));
  const clamp = (r: Rect) => ({ x: Math.max(bounds.x, Math.min(r.x, bounds.x + bounds.w - w)), y: Math.max(bounds.y, Math.min(r.y, bounds.y + bounds.h - h)) });
  const self = mode === 'beside' ? [target] : [];
  // Review: beside a box the popup may also slide along that side (still sharing at least 24px with it), so a lit neighbour or a
  // name right beside the card does not push it over another card's name.
  const slides = (side: TipSide): Rect[] => {
    const r = at[side]; if (mode !== 'beside') return [r];
    const vertical = side === 'right' || side === 'left', lo = vertical ? -(h - 24) : -(w - 24), hi = vertical ? target.h - 24 : target.w - 24, out = [r];
    for (let s = 32; s <= Math.max(-lo, hi); s += 32) for (const d of [s, -s]) if (d >= lo && d <= hi) out.push(vertical ? { ...r, y: r.y + d } : { ...r, x: r.x + d });
    return out;
  };
  const hard = [...avoid, ...self], all = [...hard, ...soft];
  for (const list of soft.length ? [all, hard] : [hard]) {
    for (const side of order) for (const r of slides(side)) if (inside(r, bounds) && !list.some(a => overlap(r, a))) return { ...clamp(r), side };
    for (const side of order) for (const r of slides(side)) { const c = clamp(r), cr = { ...c, w, h }; if (!list.some(a => overlap(cr, a))) return { ...c, side }; }
  }
  // Nothing clear (review): the side that covers the least of what it should avoid (the target itself counts most), clamped.
  const area = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  let best = order[0]!, least = Infinity;
  for (const side of order) {
    const c = clamp(at[side]), cr = { ...c, w, h };
    const cost = avoid.reduce((s, a) => s + 10 * area(cr, a), 0) + self.reduce((s, a) => s + 40 * area(cr, a), 0) + soft.reduce((s, a) => s + area(cr, a), 0);
    if (cost < least) { least = cost; best = side; }
  }
  return { ...clamp(at[best]), side: best };
}

/** The dwell machine: one target at a time, one surface. Timers are injected (tests run them by hand). */
export interface HoverTimers { set(fn: () => void, ms: number): number; clear(id: number): void }
export interface HoverEvents<T> { show(t: T): void; hide(): void }
export interface HoverMachine<T> {
  /** the pointer (or the focus) came to a target; immediate: keyboard focus or a target already confirmed shows without the dwell */
  enter(t: T, immediate?: boolean): void;
  /** the pointer left the target (the popup closes after the grace unless the pointer reaches the popup or the target again) */
  leave(): void;
  /** the pointer is on the popup itself: it stays */
  tipEnter(): void; tipLeave(): void;
  /** Esc, a drag, a pan or a zoom: close at once (and forget the target) */
  dismiss(): void;
  readonly target: T | null; readonly shown: boolean;
}
export function hoverMachine<T>(ev: HoverEvents<T>, timers: HoverTimers, openMs = HOVER_OPEN_MS, graceMs = HOVER_GRACE_MS): HoverMachine<T> {
  let target: T | null = null, shown = false, openT = 0, closeT = 0, onTip = false;
  const stopOpen = () => { if (openT) timers.clear(openT); openT = 0; }, stopClose = () => { if (closeT) timers.clear(closeT); closeT = 0; };
  const close = () => { stopOpen(); stopClose(); if (shown) ev.hide(); shown = false; target = null; onTip = false; };
  return {
    get target() { return target; }, get shown() { return shown; },
    enter(t, immediate = false) {
      stopClose();
      if (t === target && (shown || openT)) return;
      // A new target: the popup moves to it at once when one is already open (one surface, no second dwell), else after the dwell.
      stopOpen(); target = t;
      if (shown || immediate) { shown = true; ev.show(t); return; }
      openT = timers.set(() => { openT = 0; if (target === t) { shown = true; ev.show(t); } }, openMs);
    },
    leave() {
      stopOpen();
      if (!shown) { target = null; return; }
      stopClose(); closeT = timers.set(() => { closeT = 0; if (!onTip) close(); }, graceMs);
    },
    tipEnter() { onTip = true; stopClose(); },
    tipLeave() { onTip = false; if (shown) { stopClose(); closeT = timers.set(() => { closeT = 0; close(); }, graceMs); } },
    dismiss: close,
  };
}
