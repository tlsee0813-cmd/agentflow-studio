/* 동작 열기 (map spec 4): one action opens a part, and the app decides how far. The short expansion (짧은 펼침) opens the card
 * in place when its whole content, laid out beforehand at the default font size, fits within 420×280 CSS px, uses only the
 * card's own place and the empty space next to it, and covers no other part, label, meaningful line or group boundary: no other
 * box moves and the camera stays. Nothing is shrunk, left out, moved aside or rerouted to make it fit; when it does not fit, the
 * part opens in its own detail view (내부 상세). The three moves out of it stay apart (닫기, 이전 읽기 위치, 상위 구성), and which
 * part is open, and how, outlives a reload beside the map's folds and cameras. Pure: no DOM, so each rule is tested on its own. */

export type Rect = { x: number; y: number; w: number; h: number };
export type Point = { x: number; y: number };
export interface Size { w: number; h: number }

/** The short expansion's upper bound in CSS px at the default font size: the product's limit, not a study's value. */
export const SHORT_W = 420, SHORT_H = 280;
/** The clearance kept from every obstacle, and the inset kept inside the group the card sits in (its boundary stays visible). */
export const CLEAR = 3, INSET = 4;

const overlaps = (a: Rect, b: Rect, m = 0) => a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.h + m && b.y < a.y + a.h + m;
const inside = (a: Rect, b: Rect) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
const within = (p: Point, r: Rect, m = 0) => p.x > r.x - m && p.x < r.x + r.w + m && p.y > r.y - m && p.y < r.y + r.h + m;

/** Whether a drawn line passes through the rectangle anywhere outside the card's own place: a line that ends at the card is
 * covered only past the card's edge (its port and the run up to it stay as they are drawn). Sampled every 3px along each run. */
export function lineCovers(pts: Point[], r: Rect, place: Rect): boolean {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!, n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 3));
    for (let k = 0; k <= n; k++) {
      const p = { x: a.x + (b.x - a.x) * (k / n), y: a.y + (b.y - a.y) * (k / n) };
      if (within(p, r, CLEAR) && !within(p, place, CLEAR)) return true;
    }
  }
  return false;
}

/** Where the short expansion goes, or null when it does not fit. measured: the content's size laid out beforehand at one or
 * more widths (the card's own width first, wider after). place: the card's rectangle. free: the space the card may grow into
 * (the inside of the group it sits in, past its head; the open map for a card at the top). obstacles: every other part, group,
 * label, head and title. lines: the drawn lines' polylines. The expansion keeps one corner of the card where it is and grows
 * from it; it is never smaller than the card. */
export function placeExpansion(measured: Size | Size[], place: Rect, free: Rect[], obstacles: Rect[], lines: Point[][] = []): Rect | null {
  const sizes = Array.isArray(measured) ? measured : [measured];
  for (const s of sizes) {
    if (!(s.w > 0 && s.h > 0) || s.w > SHORT_W || s.h > SHORT_H) continue;
    const w = Math.max(place.w, s.w), h = Math.max(place.h, s.h);
    if (w > Math.max(SHORT_W, place.w) || h > Math.max(SHORT_H, place.h)) continue;
    const corners: Rect[] = [
      { x: place.x, y: place.y, w, h }, { x: place.x + place.w - w, y: place.y, w, h },
      { x: place.x, y: place.y + place.h - h, w, h }, { x: place.x + place.w - w, y: place.y + place.h - h, w, h },
    ];
    for (const r of corners) {
      if (!free.some(f => inside(r, f))) continue;
      if (obstacles.some(o => overlaps(r, o, CLEAR))) continue;
      if (lines.some(l => lineCovers(l, r, place))) continue;
      return r;
    }
  }
  return null;
}

/** The scale of 동작 열기: 'short' when the expansion fits in place (placeExpansion), else 'detail'. */
export function decideExpansion(measured: Size | Size[], place: Rect, free: Rect[], obstacles: Rect[], lines: Point[][] = []): 'short' | 'detail' {
  return placeExpansion(measured, place, free, obstacles, lines) ? 'short' : 'detail';
}

/** The free space of a card inside a group: the group's body under its head, kept INSET from its boundary. */
export const groupBody = (g: Rect & { head: number }): Rect => ({ x: g.x + INSET, y: g.y + g.head + INSET, w: Math.max(0, g.w - 2 * INSET), h: Math.max(0, g.h - g.head - 2 * INSET) });
/** The open map (a card at the top of a view): no boundary of its own. */
export const OPEN_MAP: Rect = { x: -1e6, y: -1e6, w: 2e6, h: 2e6 };

/* ---------- what opening shows ---------- */
/** A step a part records (map-reading.9 steps[]): its name, what it does (null: the row says nothing) and the files, functions or
 * models it uses. The order between steps is not read (no relation between steps): a list keeps the record's row order. */
export interface ActionStep { name: string; does: string | null; uses: string[]; program?: boolean }
/** How a part repeats (map-reading.9 loop): each of unit, stop and resume as written, null when the record does not say. */
export interface ActionLoop { unit: string | null; stop: string | null; resume: string | null }
/** A state a part keeps (map-reading.9 stateVars): where it holds and the steps or parts that read and change it. */
export interface ActionStateVar { name: string; scope: string | null; readBy: string[]; changedBy: string[] }
/** One section of an opened part, in reading order: the lists as the reading named them, each whole. cells: a ledger's fields
 * (one cell each); lines: one item per line (settings, the loop line, kept state); words: names in a row (ports); steps: a
 * numbered list, each step on one line (its name, then what it does in subs, the same index; null when the row says nothing;
 * programs: whether the program cut it from the 3절 chain, map-reading.14: it has no does then). */
/** total: how many the section stands for when its lines show fewer (분기 출구: the conditions behind a '+N' line). */
export interface ActionSection { key: 'inputs' | 'outputs' | 'loop' | 'steps' | 'exits' | 'stateVars' | 'fields' | 'config' | 'state'; title: string; kind: 'words' | 'cells' | 'lines' | 'steps'; items: string[]; subs?: (string | null)[]; programs?: boolean[]; total?: number }
/** A condition row of a part (map-reading.12 conditions[]): its condition, what follows when it holds and when not (null). */
export interface ActionCondition { when: string; then: string; else: string | null }
export interface ActionContent { inputs: string[]; outputs: string[]; fields: string[]; config: string[]; state: string | null; steps?: ActionStep[]; loop?: ActionLoop | null; stateVars?: ActionStateVar[]; conditions?: ActionCondition[] }
/** The short expansion's 분기 출구 lines: the first EXITS_SHOWN conditions as '{when} → {then}', the rest as one '+N' line (the
 * detail view lists them all, each with its else). */
export const EXITS_SHOWN = 3;
export function exitLines(conditions: readonly ActionCondition[]): string[] {
  const shown = conditions.slice(0, EXITS_SHOWN).map(c => `${c.when} → ${c.then}`), rest = conditions.length - shown.length;
  return rest > 0 ? [...shown, `+${rest}`] : shown;
}
/** What a blank of the loop line or of a kept state reads as: said nowhere in the record, never made up. */
export const UNSAID = '미상';
/** The loop line (spec 2.1, 반복 단위·종료·재개): '반복 {unit} · 정지 {stop} · 재개 {resume}', '미상' for each the record left out. */
export const loopLine = (l: ActionLoop): string => `반복 ${l.unit ?? UNSAID} · 정지 ${l.stop ?? UNSAID} · 재개 ${l.resume ?? UNSAID}`;
/** A kept state's line: '상태 {name} · 읽음 {readBy} · 바꿈 {changedBy}', each list joined by ', ', '미상' when empty. */
export const stateVarLine = (s: ActionStateVar): string => `상태 ${s.name} · 읽음 ${s.readBy.length ? s.readBy.join(', ') : UNSAID} · 바꿈 ${s.changedBy.length ? s.changedBy.join(', ') : UNSAID}`;
/** The sections an opened part shows, in this order: 받는 것, 내는 것, 반복 (the loop at its head), 기록된 단계, 분기 출구 (the
 * condition rows, exitLines), 유지 상태 (kept apart from the steps), 행의 필드, 설정, 상태. Only what the reading named; an empty list has no section (the entry line already says
 * '내부 미상' for a part with none). */
export function actionSections(c: ActionContent): ActionSection[] {
  const out: ActionSection[] = [];
  if (c.inputs.length) out.push({ key: 'inputs', title: '받는 것', kind: 'words', items: [...c.inputs] });
  if (c.outputs.length) out.push({ key: 'outputs', title: '내는 것', kind: 'words', items: [...c.outputs] });
  if (c.loop) out.push({ key: 'loop', title: '반복', kind: 'lines', items: [loopLine(c.loop)] });
  if (c.steps?.length) out.push({ key: 'steps', title: '기록된 단계', kind: 'steps', items: c.steps.map(s => s.name), subs: c.steps.map(s => (s.program === true ? null : s.does)),
    ...(c.steps.some(s => s.program === true) ? { programs: c.steps.map(s => s.program === true) } : {}) });
  if (c.conditions?.length) out.push({ key: 'exits', title: '분기 출구', kind: 'lines', items: exitLines(c.conditions), total: c.conditions.length });
  if (c.stateVars?.length) out.push({ key: 'stateVars', title: '유지 상태', kind: 'lines', items: c.stateVars.map(stateVarLine) });
  if (c.fields.length) out.push({ key: 'fields', title: '행의 필드', kind: 'cells', items: [...c.fields] });
  if (c.config.length) out.push({ key: 'config', title: '설정', kind: 'lines', items: [...c.config] });
  if (c.state) out.push({ key: 'state', title: '상태', kind: 'lines', items: [c.state] });
  return out;
}

/* ---------- the open state and the way back ---------- */
/** Which part is open, and how. */
export interface OpenState { part: string; mode: 'short' | 'detail' }
/** A reading position to come back to (이전 읽기 위치): the camera, the scope, the selection, the zoom level and the open state. */
export interface ReadPlace { camera: { x: number; y: number; k: number }; scope: string | null; selected: string | null; level: string; open: OpenState | null }
/** The way back's depth: the oldest position goes first. */
export const BACK_MAX = 12;
export function pushPlace(stack: ReadPlace[], p: ReadPlace): ReadPlace[] {
  const next = [...stack, p]; return next.length > BACK_MAX ? next.slice(next.length - BACK_MAX) : next;
}

/** The open state outlives a reload: one record per opened map, by the same key as its folds and cameras (a saved project by
 * its workspace entry, an example by its key, parts by their stable keys), kept apart from the project data. The newest
 * OPEN_MAPS are kept; an unreadable or malformed value reads as nothing open; a refused write is only a lost convenience. */
export const OPEN_KEY = 'agentflow.studio.open.1';
const OPEN_MAPS = 60;
interface StorageLike { getItem(k: string): string | null; setItem(k: string, v: string): void }
export function cleanOpenState(v: unknown): OpenState | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const { part, mode } = v as Record<string, unknown>;
  return typeof part === 'string' && part && part.length <= 200 && !(part in Object.prototype) && (mode === 'short' || mode === 'detail') ? { part, mode } : null;
}
function openAll(storage: StorageLike): Record<string, unknown> {
  try { const v = JSON.parse(storage.getItem(OPEN_KEY) ?? '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}; } catch { return {}; }
}
export function readOpenState(storage: StorageLike, mapKey: string): OpenState | null {
  const all = openAll(storage); return Object.hasOwn(all, mapKey) ? cleanOpenState(all[mapKey]) : null;
}
/** Writes one map's open state (null: nothing open); this map becomes the newest. False when the browser refused the write. */
export function writeOpenState(storage: StorageLike, mapKey: string, state: OpenState | null): boolean {
  try {
    const all = openAll(storage); delete all[mapKey];
    const clean = cleanOpenState(state); if (clean) all[mapKey] = clean;
    const keys = Object.keys(all); for (const k of keys.slice(0, Math.max(0, keys.length - OPEN_MAPS))) delete all[k];
    storage.setItem(OPEN_KEY, JSON.stringify(all)); return true;
  } catch { return false; }
}
