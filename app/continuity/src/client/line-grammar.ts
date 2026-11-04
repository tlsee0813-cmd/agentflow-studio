/* The line grammar of the map (map design v3 6, principle 7), the client's pure part. One visual channel carries one meaning:
 * - the stroke and the head say what the relation is: data a solid line with a filled head; control (a start, a trigger) a
 *   dashed line (6 4) with an open head; a reference (uses, needs) a dotted line with a port-less ear where it starts and a small
 *   open V where it points; a shared use dotted with an ear at both ends; a plain relation sparse dots with a dot at both ends.
 *   A planned, corrected or summary line keeps the dash of its kind (its mark is a badge or a colour on top, never a new dash).
 * - a text badge says what the record wrote of when the line flows: today its cadence words as written (a condition the record
 *   put there reads in them: 'init_from=resume', 'wandb_log일 때'), and once the contract carries them the condition (when) and
 *   optional fields. Nothing is read into the words (no '마다' parsed into a beat); a line without such a field has no badge.
 * - widths are screen pixels (never under 1.25 at rest), the heads screen sized, whatever the zoom.
 * Colour never carries a meaning alone: the channel reads in the stroke, the head and the legend's words. No DOM. */
import type { Channel, RelationMode } from '../shared/types.js';
import type { ZoomTier } from './card-budget.js';

export type RelKind = 'flow' | 'needs' | 'shares' | 'related';
/** The end marks (marker ids without their state suffix). */
export type Head = 'filled' | 'open' | 'ref' | 'ear' | 'dot' | 'none';
export interface LineStyle { stroke: 'solid' | 'dashed' | 'dotted' | 'sparse'; dash: readonly number[]; head: Head; start: Head }
/** Dash patterns in screen pixels (9.6): control 6 4, a reference or a shared use dots 0 4 with round caps (a dot as wide as the
 * line), a plain relation 0 8. */
export const DASH = { data: [], control: [6, 4], uses: [0, 4], shares: [0, 4], related: [0, 8] } as const;
/** End marks in screen pixels (9.6): the filled triangle 9, the open V 10, a reference's V 8, the ear's ring 6, a dot 4. */
export const HEAD_PX = { filled: 9, open: 10, ref: 8, ear: 6, dot: 4 } as const;
/** The style of a line from its kind and its channel (a line with no channel read keeps its kind's default: a flow hands data
 * over, a need or a shared use refers). */
export function lineStyle(kind: RelKind, channel: Channel | null): LineStyle {
  if (kind === 'related') return { stroke: 'sparse', dash: DASH.related, head: 'dot', start: 'dot' };
  if (kind === 'shares' && channel !== 'control') return { stroke: 'dotted', dash: DASH.shares, head: 'ear', start: 'ear' };
  const ch = channel ?? (kind === 'flow' ? 'data' : 'uses');
  if (ch === 'data') return { stroke: 'solid', dash: DASH.data, head: 'filled', start: 'none' };
  if (ch === 'control') return { stroke: 'dashed', dash: DASH.control, head: 'open', start: 'none' };
  return { stroke: 'dotted', dash: DASH.uses, head: 'ref', start: 'ear' };
}
/** Screen widths (6.1, 9.6): at rest 1.25 at the overview and the dot map, 1.5 nearer; 2 hovered; 3 selected (2.5 for a
 * reference). Never under 1.25 on screen. */
export const WIDTH_FLOOR = 1.25;
export function lineWidth(tier: ZoomTier | null, state: 'rest' | 'hover' | 'selected', channel: Channel | null = 'data'): number {
  if (state === 'selected') return channel === 'uses' ? 2.5 : 3;
  if (state === 'hover') return 2;
  return tier === 'mid' || tier === 'near' ? 1.5 : WIDTH_FLOOR;
}

/* ---------- ports: which face of a card a line end takes (3.6, S4b) ---------- */
/** 'side': the data sides (in on the left, out on the right, a pin or the card-level contact); 'top': a control line coming in
 * (the trigger's wedge, the head's left third); 'bottom': a control line going out (started, done, failed); 'ear': a reference's
 * port-less ear (the head band of the side it leaves). Only a channel the reading gave decides a top or a bottom: a line whose
 * channel is a default (by kind) keeps its sides. */
export type PortFace = 'side' | 'top' | 'bottom' | 'ear';
export function portFaces(kind: RelKind, channel: Channel | null, read: boolean): { a: PortFace; b: PortFace } {
  if (kind === 'related') return { a: 'side', b: 'side' };
  if (read && channel === 'control') return { a: 'bottom', b: 'top' };
  const s = lineStyle(kind, channel);
  return { a: s.start === 'ear' ? 'ear' : 'side', b: s.head === 'ear' ? 'ear' : 'side' };
}
/** The first bend keeps this far from its port (9.9-5), the corner radius, and the clearance a line keeps round a card. */
export const FIRST_BEND = 16, CORNER_R = 8, CARD_CLEAR = 8;
/** A route through top or bottom ports is kept only when it turns at most this often; else the line meets the card-level contact
 * points on the sides and is told by its dash and open head alone (3.6 hypothesis: a long detour reads worse than a side). */
export const FACE_TURNS = 3;
export const turnsOf = (pts: readonly { x: number; y: number }[]): number => Math.max(0, pts.length - 2);

/* ---------- one stroke for the same pair (6.5) ---------- */
export interface MergeEdge { key: string; from: string; to: string; kind: RelKind; notes: string[]; ids: string[]; agg: boolean; spine?: boolean }
/** Lines of one pair, one direction and one channel drawn as one stroke: their relations (ids, notes) together, each kept for the
 * hover and the pane. Data and control never share a stroke; a plain relation stays its own; a line holding relations of two
 * channels is split by channel first (each part its own stroke, keyed '<key>~<channel>'). The kind of a merged stroke is its
 * first line's (the order of the input). */
export function mergeByChannel<E extends MergeEdge>(edges: readonly E[], chanOf: (relationId: string, kind: RelKind) => Channel | null, noteOf: (relationId: string) => string | null | undefined = () => null, stable = false): E[] {
  const out = new Map<string, E>();
  for (const e of edges) {
    if (e.kind === 'related') { out.set(e.key, { ...e }); continue; }
    const by = new Map<Channel, string[]>();
    for (const id of e.ids) { const c = chanOf(id, e.kind) ?? (e.kind === 'flow' ? 'data' : 'uses'); (by.get(c) ?? by.set(c, []).get(c)!).push(id); }
    for (const [ch, ids] of by) {
      // One stroke per pair, direction, channel and drawn style (a shared use's ears are not a need's ear and V). stable: the
      // stroke is keyed by those alone (a summary line keeps its key whatever relations it is left with beside a selection).
      const k = `${e.key.startsWith('sum:') ? 'sum:' : ''}${e.from}|${e.to}|${ch}|${lineStyle(e.kind, ch).head}`, cur = out.get(k);
      const notes = by.size > 1 ? ids.map(noteOf).filter((n): n is string => !!n) : [...e.notes];
      if (!cur) out.set(k, { ...e, key: stable ? k : by.size > 1 ? `${e.key}~${ch}` : e.key, ids: [...ids], notes });
      else { cur.ids.push(...ids); cur.notes.push(...notes); cur.agg ||= e.agg; if (e.spine) cur.spine = true; }
    }
  }
  return [...out.values()];
}
/** The label of a stroke holding several relations that hand over different things: 'a · b +N' (the first two named payloads,
 * then how many relations more); one name when they all hand over the same; null when none names one. */
export function multiWord(payloads: readonly (string | null)[], clip = (t: string) => t): string | null {
  const named = payloads.filter((p): p is string => !!p), uniq = [...new Set(named)];
  if (!uniq.length) return null;
  if (uniq.length === 1) return clip(uniq[0]!);
  const shown = uniq.slice(0, 2), rest = payloads.length - payloads.filter(p => !!p && shown.includes(p)).length;
  return `${shown.map(clip).join(' · ')}${rest > 0 ? ` +${rest}` : ''}`;
}

/* ---------- the text badge (6.2) ---------- */
/** What a relation's reading says of when it flows. when / optional: the contract's fields once it carries them (S10); absent
 * today. cadence: its words as written. */
export interface BadgeRead { cadence?: string | null; mode?: RelationMode | null; when?: string | null; optional?: boolean | null }
export interface LineBadge {
  /** What it says: 'condition' (when), 'optional', or 'cadence' (the record's words). */
  kind: 'condition' | 'optional' | 'cadence';
  /** At rest: the words as written (the badge ellipsises past 120 screen px), or 'X N' when the stroke holds several. */
  short: string;
  /** Selected: the words in full with what kind of words they are, and the mode as read. */
  full: string;
  /** How many of the stroke's relations carry such words. */
  n: number }
/** Badge words at most this long whole on a selected line (6.2: ≤24 of the record's characters), then an ellipsis. */
export const BADGE_FULL = 24;
const cut = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
/** The badge of a stroke from what its relations' readings say; null when none says anything of when it flows (no badge is
 * ever made from a name, a payload or a kind). A condition outranks an optional mark, which outranks cadence words. */
export function lineBadge(rels: readonly BadgeRead[]): LineBadge | null {
  const pick = (k: LineBadge['kind']) => rels.map(r => (k === 'condition' ? r.when ?? null : k === 'optional' ? (r.optional ? '선택' : null) : r.cadence ?? null)).filter((x): x is string => !!x && !!x.trim());
  for (const kind of ['condition', 'optional', 'cadence'] as const) {
    const said = pick(kind); if (!said.length) continue;
    const uniq = [...new Set(said.map(s => s.replace(/\s+/g, ' ').trim()))], word = kind === 'condition' ? '조건' : kind === 'optional' ? '선택' : '박자';
    const modes = [...new Set(rels.map(r => r.mode).filter(Boolean))], mode = modes.length === 1 ? (modes[0] === 'design' ? ' · 설계' : ' · 관찰') : '';
    if (uniq.length === 1 && rels.length === said.length)
      return { kind, short: kind === 'optional' ? '선택' : uniq[0]!, full: `${word} · ${kind === 'optional' ? '선택' : cut(uniq[0]!, BADGE_FULL)}${mode}`, n: said.length };
    // Several relations on one stroke whose words differ (or some of which say none): how many say any, never one of them as the
    // stroke's.
    return { kind, short: `${word} ${said.length}`, full: `${word} ${said.length} / ${rels.length}${mode} · 선택하면 관계마다`, n: said.length };
  }
  return null;
}

/* ---------- label priority (6.3) ---------- */
/** The protected order of what a line carries, highest first (6.3 items 5–9; 1–4 are part and region names, which a label never
 * covers): the selected or scenario path's line labels, the badges, the spine's labels, a data line naming what it hands over or
 * a control line naming what starts it, the rest. Lower wins. */
export const RANK = { selected: 5, badge: 6, spine: 7, said: 8, other: 9 } as const;
export function labelRank(x: { selected?: boolean; path?: boolean; spine?: boolean; said?: boolean }): number {
  return x.selected || x.path ? RANK.selected : x.spine ? RANK.spine : x.said ? RANK.said : RANK.other;
}
/** A label wider than this on screen ellipsises; selecting its line shows it whole (9.9-7). */
export const LABEL_MAX = 120;
/** The badge's least height on screen at rest and selected (6.2, 9.6). */
export const BADGE_H = 16, BADGE_H_ON = 20;
