/* v13 (spec 2): the camera's long jumps and the hand's drag, as motion that comes only from the person's own act.
 * - A long jump (a search hit, a list item, a scene far off) flies: out and back in along the smooth path of van Wijk & Nuij (2003,
 *   "Smooth and efficient zooming and panning"), 500–800 ms, and any key, press, wheel or touch stops it where it is.
 * - A drag that is let go keeps its speed and slows by DECAY each frame (about 16.7 ms), stopping on any input.
 * - Short moves keep the plain eased move (styles: .world.animate); reduced motion jumps.
 * Pure math here (no DOM) so it is tested in node; the runners take their frame function and their clock. */

export interface Cam { x: number; y: number; k: number }
/** A view as the path reads it: its centre in map units and its width in map units. */
export interface ViewW { cx: number; cy: number; w: number }

export const FLIGHT_MIN_MS = 500, FLIGHT_MAX_MS = 800;
/** van Wijk & Nuij's ρ: how far out the path goes for a given distance (√2, the paper's and d3's choice). */
export const RHO = Math.SQRT2;
/** Inertia: the speed kept per 16.7 ms frame, and the speed (px per ms) under which it stops. */
export const DECAY = 0.92, INERTIA_MIN = 0.02, INERTIA_START = 0.25;

/** Camera (screen = map · k + (x, y)) in a viewport of size vw × vh → the view the path reads. */
export const viewOf = (c: Cam, vw: number, vh: number): ViewW => ({ cx: (vw / 2 - c.x) / c.k, cy: (vh / 2 - c.y) / c.k, w: vw / c.k });
/** And back. */
export const camOf = (v: ViewW, vw: number, vh: number): Cam => { const k = vw / v.w; return { k, x: vw / 2 - v.cx * k, y: vh / 2 - v.cy * k }; };

/** The van Wijk & Nuij path from a to b: its length S (in the paper's units) and the view at t ∈ [0, 1]. */
export function zoomPath(a: ViewW, b: ViewW, rho = RHO): { S: number; at: (t: number) => ViewW } {
  const rho2 = rho * rho, rho4 = rho2 * rho2, dx = b.cx - a.cx, dy = b.cy - a.cy, d2 = dx * dx + dy * dy;
  if (d2 < 1e-12) {
    const S = Math.log(b.w / a.w) / rho;
    return { S: Math.abs(S), at: t => ({ cx: a.cx + t * dx, cy: a.cy + t * dy, w: a.w * Math.exp(rho * t * S) }) };
  }
  const d1 = Math.sqrt(d2), b0 = (b.w * b.w - a.w * a.w + rho4 * d2) / (2 * a.w * rho2 * d1), b1 = (b.w * b.w - a.w * a.w - rho4 * d2) / (2 * b.w * rho2 * d1);
  const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0), r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1), S = (r1 - r0) / rho;
  return { S, at: t => {
    if (t >= 1) return { ...b };
    const s = t * S, c0 = Math.cosh(r0), u = (a.w / (rho2 * d1)) * (c0 * Math.tanh(rho * s + r0) - Math.sinh(r0));
    return { cx: a.cx + u * dx, cy: a.cy + u * dy, w: (a.w * c0) / Math.cosh(rho * s + r0) };
  } };
}
/** How long a flight of path length S takes: the paper's speed, held between FLIGHT_MIN_MS and FLIGHT_MAX_MS. */
export const flightMs = (S: number): number => Math.round(Math.min(FLIGHT_MAX_MS, Math.max(FLIGHT_MIN_MS, Math.abs(S) * 420)));
/** A long jump: the target's centre more than half the viewport's shorter side away on screen, or the zoom changing by more than 1.6×. A
 * short move is the plain eased move. */
export function longJump(from: Cam, to: Cam, vw: number, vh: number): boolean {
  const a = viewOf(from, vw, vh), b = viewOf(to, vw, vh), dist = Math.hypot(b.cx - a.cx, b.cy - a.cy) * from.k, z = Math.max(to.k / from.k, from.k / to.k);
  return dist > Math.min(vw, vh) * 0.5 || z > 1.6;
}
/** Ease in and out (the path's own speed is even in its units; the ends ease so the move starts and lands softly). */
export const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** A flight: the camera at time ms after it starts (null once it has landed). */
export function flightAt(from: Cam, to: Cam, vw: number, vh: number): { ms: number; at: (ms: number) => Cam | null } {
  const p = zoomPath(viewOf(from, vw, vh), viewOf(to, vw, vh)), ms = flightMs(p.S);
  return { ms, at: t => (t >= ms ? null : camOf(p.at(easeInOut(Math.max(0, t) / ms)), vw, vh)) };
}

/** The hand's speed when it lets go (px per ms), from its last moves (within the last 100 ms); still when it paused before letting go. */
export function releaseSpeed(samples: readonly { t: number; x: number; y: number }[], now: number): { vx: number; vy: number } {
  const recent = samples.filter(s => now - s.t <= 100);
  if (recent.length < 2) return { vx: 0, vy: 0 };
  const a = recent[0]!, b = recent.at(-1)!, dt = b.t - a.t;
  if (dt < 8 || now - b.t > 60) return { vx: 0, vy: 0 };
  return { vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt };
}
/** One inertia step: the move for dt ms at speed v, and the speed after it (DECAY per 16.7 ms frame). */
export function inertiaStep(v: { vx: number; vy: number }, dt: number): { dx: number; dy: number; vx: number; vy: number } {
  const f = Math.pow(DECAY, dt / (1000 / 60));
  return { dx: v.vx * dt, dy: v.vy * dt, vx: v.vx * f, vy: v.vy * f };
}
export const moving = (v: { vx: number; vy: number }, min = INERTIA_MIN): boolean => Math.hypot(v.vx, v.vy) >= min;

/** The inputs that stop any motion the person did not ask to keep (a flight, a glide, the opening). */
export const STOP_EVENTS = ['pointerdown', 'wheel', 'keydown', 'touchstart'] as const;
/** Listens once for any of STOP_EVENTS on the window (capture), and gives back the way to stop listening. */
export function onAnyInput(fn: (e: Event) => void, target: Pick<Window, 'addEventListener' | 'removeEventListener'> = window): () => void {
  const h = (e: Event) => { off(); fn(e); };
  const off = () => { for (const t of STOP_EVENTS) target.removeEventListener(t, h, true); };
  for (const t of STOP_EVENTS) target.addEventListener(t, h, { capture: true, passive: true } as AddEventListenerOptions);
  return off;
}

/** The camera's motion controller: what the screen shows now (a flight's frame, a glide's), the flight in the air and the glide on the go.
 * write: puts a camera on the screen (the world's transform only). The app's applyCamera asks take() before writing: a long animated move
 * starts a flight (then the flight writes the frames, and land() runs once it lands); any other move stops a flight or glide in the way. */
export interface MotionHost {
  write(c: Cam): void; size(): { w: number; h: number }; reduced(): boolean; land(): void;
  now?(): number; frame?(cb: (t: number) => void): number; cancel?(id: number): void; listen?(fn: (e: Event) => void): () => void;
}
export function createMotion(host: MotionHost) {
  const now = host.now ?? (() => performance.now()), frame = host.frame ?? ((cb: (t: number) => void) => requestAnimationFrame(cb)), cancel = host.cancel ?? ((id: number) => cancelAnimationFrame(id)), listen = host.listen ?? ((fn: (e: Event) => void) => onAnyInput(fn));
  let shown: Cam | null = null, fly: { id: number; to: Cam; at: (ms: number) => Cam | null; start: number; ms: number; off: () => void } | null = null;
  let glide: { id: number; off: () => void } | null = null, ownMove = false;
  const put = (c: Cam) => { shown = { ...c }; host.write(c); };
  function stopFlight(): Cam | null {
    if (!fly) return null;
    const f = fly; fly = null; cancel(f.id); f.off();
    const c = f.at(now() - f.start) ?? f.to; shown = { ...c }; return c;
  }
  function stopGlide() { if (!glide) return; const g = glide; glide = null; cancel(g.id); g.off(); }
  return {
    /** The camera on screen (a flight's current frame while it flies). */
    shown: (): Cam | null => (shown ? { ...shown } : null),
    flying: (): boolean => !!fly, gliding: (): boolean => !!glide,
    /** The flight's length (0 when none). */
    ms: (): number => fly?.ms ?? 0,
    /** Before the app writes camera c: true when a flight now carries it there (the app must not write the transform). */
    take(c: Cam, animate: boolean, mayFly = true): boolean {
      // The same target as the flight in the air: it keeps flying (another sync of the same camera).
      if (fly && Math.abs(fly.to.x - c.x) < 0.01 && Math.abs(fly.to.y - c.y) < 0.01 && Math.abs(fly.to.k - c.k) < 1e-6) return true;
      stopFlight(); if (!ownMove) stopGlide();
      const from = shown, { w, h } = host.size();
      if (!animate || !mayFly || !from || host.reduced() || !w || !h || !longJump(from, c, w, h)) { shown = { ...c }; return false; }
      stopGlide();
      const f = flightAt(from, c, w, h), start = now();
      const step = (t: number) => {
        if (!fly) return;
        const at = fly.at(t - fly.start);
        if (!at) { const done = fly; fly = null; done.off(); put(done.to); host.land(); return; }
        put(at); fly.id = frame(step);
      };
      fly = { id: 0, to: { ...c }, at: f.at, start, ms: f.ms, off: listen(() => { const c2 = stopFlight(); if (c2) { host.write(c2); host.land(); } }) };
      fly.id = frame(step);
      return true;
    },
    /** A let-go drag keeps its speed and slows (inertiaStep); move(dx, dy) moves the camera by screen pixels; any input stops it. */
    glide(v: { vx: number; vy: number }, move: (dx: number, dy: number) => void, done: () => void = () => {}) {
      stopGlide(); stopFlight();
      if (host.reduced() || !moving(v, INERTIA_START)) return false;
      let speed = { ...v }, last = now();
      const step = (t: number) => {
        if (!glide) return;
        const dt = Math.min(48, Math.max(1, t - last)); last = t;
        const s = inertiaStep(speed, dt); speed = { vx: s.vx, vy: s.vy };
        ownMove = true; try { move(s.dx, s.dy); } finally { ownMove = false; }
        if (!moving(speed)) { const g = glide; glide = null; g.off(); done(); return; }
        glide.id = frame(step);
      };
      glide = { id: 0, off: listen(() => { const g = glide; if (!g) return; glide = null; cancel(g.id); done(); }) };
      glide.id = frame(step);
      return true;
    },
  };
}
export type Motion = ReturnType<typeof createMotion>;
