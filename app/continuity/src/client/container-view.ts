/* Loop containers on the map (map design v3 4), the client's pure part. A container is a capability, never a family: a card whose
 * reading records a loop AND recorded steps draws them inside a well — its loop's unit and stop as badges, up to five of its steps
 * (the visible budget), a decorative open rail beside them, and a separate compartment for the state it keeps. Nothing of it is
 * made from a part's name or from step names alone: no loop field, no container (a type word 'loop' with steps but no loop row
 * keeps its card and its inner line); the rail is a bracket, never a line, so it joins no port and no step.
 * - Budget (4.3): the first and the last row, a step the loop's stop names, a step a condition's then or else names (a failure
 *   branch) and a step a model portMap row ties are always kept; the budget grows with them up to 8; past that the kept middle
 *   reads as one '분기 단계 N' row. The rest fold as '중간 단계 N 접힘' (one per run of hidden rows, in the record's order), and
 *   nothing crosses a fold: it is a summary, not a link between the steps around it.
 * - Depth (4.3): a container inside a container on the map shows its steps; one deeper reads as '내부 반복 · 단계 N ›'.
 * - Explicit inner expansion (4.5): only the person's 펼치기 changes a container's size. Its top-left edge stays; only siblings that
 *   overlap the grown box (with a 24px margin) move, the least way right or down (makeRoom); collapsing drops those moves and the
 *   places held for it, so every box returns where it was. No DOM. */

/** A step as the well reads it (map-reading.9; program: cut from the 3절 chain by the program). */
export interface WellStep { name: string; program?: boolean }
export interface WellLoop { unit: string | null; stop: string | null; resume: string | null }
export interface WellCondition { then: string; else: string | null }
/** Why a row is always kept (budget rule), for its tip. */
export type KeepWhy = 'first' | 'last' | 'stop' | 'branch' | 'port';
export type WellRow =
  | { kind: 'step'; index: number; name: string; program: boolean; keep: KeepWhy[] }
  | { kind: 'fold'; count: number; from: number; to: number }
  | { kind: 'branches'; count: number }
  | { kind: 'nested'; count: number };
export interface Well {
  /** The loop's own words (badges): its unit and its stop, each null when the record left it out (a '?' slot then). */
  unit: string | null; stop: string | null; resume: string | null;
  rows: WellRow[];
  /** Steps the well holds and how many are folded now. */
  steps: number; folded: number;
  /** The state compartment: how many kept states the record names, and how many of them carry their own line (none can before
   * the contract stores one per item, S9: they read as one '유지 상태 N · 항목 근거 미연결' line). */
  state: { count: number; linked: number } | null;
  /** Explicitly expanded (every step shown). */
  open: boolean }

/** The visible budget and its ceiling (4.3). */
export const WELL_BUDGET = 5, WELL_MAX = 8;
/** A container on the map: the reading records a loop and at least one step of its own (not only the program's). */
export function isContainer(steps: readonly WellStep[], loop: WellLoop | null | undefined): boolean {
  return !!loop && steps.some(s => s.program !== true);
}
/** Whether a text names a step: the step's whole name in it (two characters at least, so a one-letter name never matches). */
const names = (text: string | null | undefined, name: string) => !!text && name.trim().length >= 2 && text.includes(name.trim());
/** The well of a container: its rows within the budget (all of them when open), or the nested summary row past depth 2. */
export function containerBody(steps: readonly WellStep[], loop: WellLoop, opts: { conditions?: readonly WellCondition[]; portSteps?: readonly string[]; stateVars?: number; open?: boolean; depth?: number; budget?: number } = {}): Well {
  const n = steps.length, cond = opts.conditions ?? [], ports = new Set(opts.portSteps ?? []), open = !!opts.open;
  const base = { unit: loop.unit, stop: loop.stop, resume: loop.resume, steps: n, state: opts.stateVars ? { count: opts.stateVars, linked: 0 } : null, open };
  if ((opts.depth ?? 1) > 2) return { ...base, rows: [{ kind: 'nested', count: n }], folded: n };
  const why = steps.map((s, i) => {
    const w: KeepWhy[] = [];
    if (i === 0) w.push('first'); if (i === n - 1 && n > 1) w.push('last');
    if (names(loop.stop, s.name)) w.push('stop');
    if (cond.some(c => names(c.then, s.name) || names(c.else, s.name))) w.push('branch');
    if (ports.has(s.name)) w.push('port');
    return w;
  });
  const step = (i: number): WellRow => ({ kind: 'step', index: i, name: steps[i]!.name, program: steps[i]!.program === true, keep: why[i]! });
  if (open || n <= (opts.budget ?? WELL_BUDGET)) return { ...base, rows: steps.map((_, i) => step(i)), folded: 0 };
  const kept = why.map((w, i) => (w.length ? i : -1)).filter(i => i >= 0);
  if (kept.length > WELL_MAX) {
    // Too many to keep: the first and last rows stay, the kept middle reads as one row, the rest fold round it.
    const mid = kept.filter(i => i !== 0 && i !== n - 1);
    return { ...base, rows: [step(0), { kind: 'branches', count: mid.length }, { kind: 'fold', count: n - 2 - mid.length, from: 1, to: n - 2 }, step(n - 1)], folded: n - 2 };
  }
  const budget = Math.max(opts.budget ?? WELL_BUDGET, kept.length), shown = new Set(kept);
  for (let i = 0; i < n && shown.size < budget; i++) shown.add(i);
  const rows: WellRow[] = [];
  for (let i = 0; i < n; i++) {
    if (shown.has(i)) { rows.push(step(i)); continue; }
    const last = rows[rows.length - 1];
    if (last?.kind === 'fold') { last.count++; last.to = i; } else rows.push({ kind: 'fold', count: 1, from: i, to: i });
  }
  return { ...base, rows, folded: n - shown.size };
}
/** A fold row's words (4.3) and a nested row's (4.3, depth past 2). */
export const foldText = (n: number) => `중간 단계 ${n} 접힘`;
export const nestedText = (n: number) => `내부 반복 · 단계 ${n} ›`;
export const branchText = (n: number) => `분기 단계 ${n}`;
export const STATE_UNLINKED = '항목 근거 미연결';
export const stateText = (s: { count: number; linked: number }) => `유지 상태 ${s.count}${s.linked < s.count ? ` · ${STATE_UNLINKED}` : ''}`;

/* ---------- heights (on the card's 8px grid; card-family adds them in place of the inner line) ---------- */
/** The well's padding, its head (the badges), a row, and the state compartment. */
export const WELL_PAD = 8, WELL_HEAD = 24, WELL_ROW = 20, WELL_STATE = 26, WELL_GAP = 8;
export function wellHeight(w: Well): number {
  return WELL_GAP + WELL_PAD + WELL_HEAD + w.rows.length * WELL_ROW + (w.state ? WELL_STATE : 0) + WELL_PAD;
}

/* ---------- explicit inner expansion: making room (4.5) ---------- */
export interface RoomBox { id: string; x: number; y: number; w: number; h: number }
/** The least moves (right or down) that clear the grown box of its siblings by margin: a sibling overlapping the grown box (grown
 * by margin) moves by the smaller of the two; one that the moved ones now overlap moves after them, the same way, until none
 * overlaps (at most as many rounds as siblings). A sibling that overlaps nothing never moves. */
export function makeRoom(grown: RoomBox, siblings: readonly RoomBox[], margin = 24): Map<string, { dx: number; dy: number }> {
  const at = new Map(siblings.filter(s => s.id !== grown.id).map(s => [s.id, { ...s }])), moved = new Map<string, { dx: number; dy: number }>();
  const hit = (a: RoomBox, b: RoomBox) => a.x < b.x + b.w + margin && b.x < a.x + a.w + margin && a.y < b.y + b.h + margin && b.y < a.y + a.h + margin;
  let pushers: RoomBox[] = [grown];
  for (let round = 0; round <= at.size && pushers.length; round++) {
    const next: RoomBox[] = [];
    for (const p of pushers) for (const s of at.values()) {
      if (s.id === p.id || !hit(p, s)) continue;
      const dx = p.x + p.w + margin - s.x, dy = p.y + p.h + margin - s.y;
      // Only right or down, by the smaller (a box already right of the pusher's left edge goes right, else down when shorter).
      const goRight = s.x >= p.x && (dx <= dy || s.y < p.y);
      const m = goRight ? { dx: Math.max(0, dx), dy: 0 } : { dx: 0, dy: Math.max(0, dy) };
      if (!m.dx && !m.dy) continue;
      s.x += m.dx; s.y += m.dy;
      const prev = moved.get(s.id) ?? { dx: 0, dy: 0 }; moved.set(s.id, { dx: prev.dx + m.dx, dy: prev.dy + m.dy });
      if (!next.includes(s)) next.push(s);
    }
    pushers = next;
  }
  return moved;
}
