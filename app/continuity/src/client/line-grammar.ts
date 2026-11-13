/* The line grammar of the map (map design v3 6, principle 7), the client's pure part. One visual channel carries one meaning:
 * - the stroke and the head say what the relation is (beauty v2 B1, the binding ruling): data a solid line with a filled head;
 *   control (a start, a trigger) a SOLID line with an open head (the open and the filled head read apart in greyscale); a
 *   reference (uses, needs) a faint long dash (8 5) with a port-less ear where it starts and a small open V where it points (its
 *   direction kept); a shared use the same long dash with an ear at both ends; a plain relation sparse dots with a dot at both ends.
 *   A planned, reported or unconfirmed line keeps the stroke of its kind (its mark is a badge or a tone on top, never a dash).
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
export interface LineStyle { stroke: 'solid' | 'long' | 'sparse'; dash: readonly number[]; head: Head; start: Head }
/** Dash patterns in screen pixels (beauty v2 B1): data and control solid, a reference or a shared use a long dash 8 5 (butt caps),
 * a plain relation sparse dots 0 8. */
export const DASH = { data: [], control: [], uses: [8, 5], shares: [8, 5], related: [0, 8] } as const;
/** End marks' boxes in screen pixels at every zoom (beauty v2 B1: about 7–9 long and 5–7 wide): the filled triangle 9 (9 × 6.3), the
 * open V 10 (8.2 × 7), a reference's V 9.5 (7.1 × 6.7), the ear's ring 6, a dot 4. */
export const HEAD_PX = { filled: 9, open: 10, ref: 9.5, ear: 6, dot: 4 } as const;
/** An end mark's box in map units at zoom k (HEAD_PX screen pixels, so 1/k of the map), as the marker's markerWidth/Height carry it.
 * Beauty v5 (lanes review): a marker is sized when it is made and again whenever the zoom it was sized at moved by MARK_STEP or more,
 * each marker by the zoom it carries (markResize), never by one cache shared with markers since replaced: a redraw makes new
 * markers, and a map opened at nearly the zoom of the one before (0.643 against 0.640) drew every head at the SVG default box, too
 * small to see. */
export const MARK_STEP = 0.005;
export function markPx(head: Exclude<Head, 'none'>, k: number): string { return (HEAD_PX[head] / Math.max(k, 1e-6)).toFixed(2); }
/** Whether a marker sized at zoom 'at' (null: never sized) needs sizing at zoom k. */
export function markResize(at: number | null, k: number): boolean { return at === null || !Number.isFinite(at) || Math.abs(k - at) >= MARK_STEP; }
/** The style of a line from its kind and its channel (a line with no channel read keeps its kind's default: a flow hands data
 * over, a need or a shared use refers). */
export function lineStyle(kind: RelKind, channel: Channel | null): LineStyle {
  if (kind === 'related') return { stroke: 'sparse', dash: DASH.related, head: 'dot', start: 'dot' };
  if (kind === 'shares' && channel !== 'control') return { stroke: 'long', dash: DASH.shares, head: 'ear', start: 'ear' };
  const ch = channel ?? (kind === 'flow' ? 'data' : 'uses');
  if (ch === 'data') return { stroke: 'solid', dash: DASH.data, head: 'filled', start: 'none' };
  if (ch === 'control') return { stroke: 'solid', dash: DASH.control, head: 'open', start: 'none' };
  return { stroke: 'long', dash: DASH.uses, head: 'ref', start: 'ear' };
}
/** Screen widths (beauty v2 B1): by the current reading focus, never by importance or traffic: a background line 1.15, a
 * foreground line (the lens's subject) 2.25, a pointed-at line 2.5, a selected line 3. Never under 1 on screen. The zoom tier
 * no longer changes a width (kept in the signature for callers). */
export const WIDTH_FLOOR = 1;
export const LINE_W = { bg: 1.15, fg: 2.25, hover: 2.5, selected: 3 } as const;
export function lineWidth(_tier: ZoomTier | null, state: 'rest' | 'fg' | 'hover' | 'selected', _channel: Channel | null = 'data'): number {
  if (state === 'selected') return LINE_W.selected;
  if (state === 'hover') return LINE_W.hover;
  return state === 'fg' ? LINE_W.fg : LINE_W.bg;
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
export function mergeByChannel<E extends MergeEdge>(edges: readonly E[], chanOf: (relationId: string, kind: RelKind) => Channel | null, noteOf: (relationId: string) => string | null | undefined = () => null, stable = false, sigOf: (relationId: string) => string = () => ''): E[] {
  const out = new Map<string, E>();
  for (const e of edges) {
    if (e.kind === 'related') { out.set(e.key, { ...e }); continue; }
    // Beauty v2 (B4): one stroke holds only relations with the same condition, timing and status (sigOf: a relation's signature of
    // those, '' when it has none); relations that differ in any of them are strokes of their own, never covered by one.
    const by = new Map<Channel, Map<string, string[]>>();
    for (const id of e.ids) {
      const c = chanOf(id, e.kind) ?? (e.kind === 'flow' ? 'data' : 'uses'), s = sigOf(id), m = by.get(c) ?? by.set(c, new Map()).get(c)!;
      (m.get(s) ?? m.set(s, []).get(s)!).push(id);
    }
    const parts = [...by.values()].reduce((n, m) => n + m.size, 0);
    for (const [ch, sigs] of by) {
      [...sigs].forEach(([sig, ids], si) => {
        // One stroke per pair, direction, channel, drawn style (a shared use's ears are not a need's ear and V) and signature.
        // stable: the stroke is keyed by those alone (a summary line keeps its key whatever relations it is left with beside a
        // selection).
        const k = `${e.key.startsWith('sum:') ? 'sum:' : ''}${e.from}|${e.to}|${ch}|${lineStyle(e.kind, ch).head}${sig ? `|${sigKey(sig)}` : ''}`, cur = out.get(k);
        const notes = parts > 1 ? ids.map(noteOf).filter((n): n is string => !!n) : [...e.notes];
        if (!cur) out.set(k, { ...e, key: stable ? k : parts > 1 ? `${e.key}~${ch}${sigs.size > 1 ? `~${si}` : ''}` : e.key, ids: [...ids], notes });
        else { cur.ids.push(...ids); cur.notes.push(...notes); cur.agg ||= e.agg; if (e.spine) cur.spine = true; }
      });
    }
  }
  return [...out.values()];
}
/** A short stable key for a signature (a stroke's key carries it, so the same relations keep the same stroke). */
export const sigKey = (sig: string): string => { let h = 2166136261; for (let i = 0; i < sig.length; i++) h = Math.imul(h ^ sig.charCodeAt(i), 16777619) >>> 0; return `s${h.toString(36)}`; };
/** A relation's signature for one stroke (B4): its condition words, its optional mark and variant, its cadence words and whether
 * the record states it as planned. Relations of one pair, direction and channel share a stroke only when these are the same. */
export function relationSig(r: { when?: string | null | undefined; optional?: boolean | null | undefined; variant?: string | null | undefined; cadence?: string | null | undefined; planned?: boolean | undefined }): string {
  const t = (x?: string | null) => (x ?? '').replace(/\s+/g, ' ').trim();
  const parts = [t(r.when), r.optional ? `선택:${t(r.variant)}` : '', t(r.cadence), r.planned ? '계획' : ''];
  return parts.some(Boolean) ? parts.join('\u0001') : '';
}
/** Two summary strokes of one pair, one channel and one drawn style that run opposite ways, drawn as one stroke with a head at each
 * end (S8): on a busy map a folded group's lines to and from the same parts otherwise run side by side down one gap (nanoGPT .43
 * v4: fourteen runs beside 「로컬 Python 프로세스」), and the gap holds only so many tracks TRACK_GAP apart. Only data and control
 * (each has a head that says its direction); a reference, a shared use and a plain relation keep their own strokes. The pair's
 * key is the same whichever way it is found ('sum:<lo>|<hi>|<channel>|<head>|both', lo and hi the two ends in id order), from 'lo' to
 * 'hi'; back holds the relations that run from hi to lo. keep: pair keys that stay paired even when one direction is gone (the
 * summary beside a selection keeps the strokes drawn at rest). Only summary strokes ('sum:' keys made stable by mergeByChannel). */
export function pairWays<E extends MergeEdge & { both?: boolean; back?: string[] }>(edges: readonly E[], keep: ReadonlySet<string> = new Set()): E[] {
  const restOf = (e: E) => { const pre = `sum:${e.from}|${e.to}|`; return e.key.startsWith(pre) ? e.key.slice(pre.length) : null; };
  const byKey = new Map(edges.map(e => [e.key, e])), done = new Set<string>(), out: E[] = [];
  for (const e of edges) {
    if (done.has(e.key)) continue;
    const rest = restOf(e);
    if (!rest || !/^(data|control)\|/.test(rest) || e.from === e.to) { out.push(e); continue; }
    const lo = e.from < e.to ? e.from : e.to, hi = lo === e.from ? e.to : e.from, pk = `sum:${lo}|${hi}|${rest}|both`;
    const rev = byKey.get(`sum:${e.to}|${e.from}|${rest}`);
    if (!rev && !keep.has(pk)) { out.push(e); continue; }
    done.add(e.key); if (rev) done.add(rev.key);
    const fwd = e.from === lo ? e : rev, bwd = e.from === lo ? rev : e, base = (fwd ?? bwd)!;
    out.push({ ...base, key: pk, from: lo, to: hi, ids: [...(fwd?.ids ?? []), ...(bwd?.ids ?? [])], back: [...(bwd?.ids ?? [])],
      notes: [...(fwd?.notes ?? []), ...(bwd?.notes ?? [])], agg: !!(fwd?.agg || bwd?.agg), both: true, ...(fwd?.spine || bwd?.spine ? { spine: true } : {}) });
  }
  return out;
}
/** The label of a stroke holding several relations that hand over different things: 'a · b +N' (the first two named payloads,
 * then how many relations more); one name when they all hand over the same; null when none names one. */
export function multiWord(payloads: readonly (string | null)[], clip = (t: string) => t): string | null {
  const named = payloads.filter((p): p is string => !!p), uniq = [...new Set(named)];
  if (!uniq.length) return null;
  if (uniq.length === 1) return clip(uniq[0]!);
  const shown = uniq.slice(0, 2), rest = payloads.length - payloads.filter(p => !!p && shown.includes(p)).length;
  // Cards v2 §1: a count says what it counts (「외 N」 after the names: the relations past the two named).
  return `${shown.map(clip).join(' · ')}${rest > 0 ? ` 외 ${rest}` : ''}`;
}

/* ---------- the text badge (6.2) ---------- */
/** What a relation's reading says of when it flows. when / optional: the contract's fields once it carries them (S10); absent
 * today. cadence: its words as written. */
export interface BadgeRead { cadence?: string | null; mode?: RelationMode | null; when?: string | null; optional?: boolean | null;
  /** The variant an optional relation flows for (its C-LINK 조건·선택 「변형 X02」, glossed), said in the 선택 cue's tip. */
  variant?: string | null }
/** Polish round (spec-cards-v2 §1): a condition the record wrote with nothing but the ask's own form word (「조건 그대로」 bare): the
 * relation is conditional, its words are not in the record. Kept as this so the cue never drops; said in words in the tip. */
export const COND_UNSAID = '조건의 글자는 기록에 없음';
/** A relation's condition as the map says it: the record's words without the ask's form word the record copied in front of them
 * (「조건 그대로: not os.path.exists(…)」 reads 「not os.path.exists(…)」); COND_UNSAID when the form word is all it wrote; null with
 * no condition. The record's own row (원문) keeps it as written. */
export function conditionWords(raw: string | null | undefined): string | null {
  const t = (raw ?? '').replace(/\s+/g, ' ').trim(); if (!t) return null;
  const rest = t.replace(/^조건\s*그대로\s*[:：]?\s*/, '').trim();
  return rest || COND_UNSAID;
}
/** One condition in a tip: 「조건: …」 (the record's words), or what the record left unsaid. v9 (review of v8: a ◇'s tip read 「조건: CD04가
 * 거짓일 때」, 「조건: LN13과 같음」): plain says the record's row IDs in it as the record's own words (app.ts condPlain: a condition row by
 * its words, 「<line>과 같음」 by that line's condition); the record's own row (원문) keeps them as written. */
export const conditionTip = (w: string, plain: (t: string) => string = t => t): string => (w === COND_UNSAID ? `조건 · ${COND_UNSAID}` : `조건: ${plain(w)}`);
export interface LineBadge {
  /** What it says: 'condition' (when), 'optional', or 'cadence' (the record's words). */
  kind: 'condition' | 'optional' | 'cadence';
  /** At rest: the record's own words as written; a stroke whose relations wrote different words reads the first and how many other
   * words ('명령마다 외 1'); one whose relations do not all write any reads the words and how many do ('명령마다 (1/2)'). Never the kind
   * word alone ('박자', '박자 2'): what kind of words they are reads in the tip. */
  short: string;
  /** Selected: the same words, longer (≤24 of the record's characters), with the mode as read ('호출마다 · 설계'). */
  full: string;
  /** The tip: what kind of words they are, each distinct wording in full, and the mode. */
  tip: string;
  /** The distinct wordings as written, in the relations' order. */
  words: string[];
  /** How many of the stroke's relations carry such words. */
  n: number;
  /** The words are a reference the record left unresolved ('위 두 줄과 같음'): shown as written, muted, never resolved here. */
  unresolved: boolean;
  /** The wording the badge leads with: the first that says more than 「한 번」 (S8), else the first. */
  lead?: string;
  /** Cadence words that are all the record's bare 「한 번」 (S8): low information, so at the overview and the middle tier the badge
   * folds into a small tick on the line (its words in the tip); nearer and selected it reads as written. */
  quiet?: boolean }
/** Badge words at most this long whole on a selected line (6.2: ≤24 of the record's characters), then an ellipsis. */
export const BADGE_FULL = 24;
/** A badge with no room for its words reads this many of them, then an ellipsis (its whole words in the tip). */
export const BADGE_CLIP = 7;
/** The glyph a cadence badge falls back to when not even its clipped words fit (and at the overview): a small rhythm mark, its
 * words in the tip. A condition falls back to the word 조건, an optional mark is the word 선택: those words say something. */
export const BADGE_GLYPH = '◷';
const cut = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
/** Words that point at another row of the record instead of saying a cadence ('위 두 줄과 같음', '위와 같음', '상동', '앞 행과 동일',
 * 'same as above'): the reading kept the record's relative reference as it stood. Shown as written and muted; never resolved here. */
export function isRelativeRef(t: string): boolean {
  const s = t.replace(/\s+/g, ' ').trim();
  return /^(상동|〃|동상|ditto|same as above|see above)\.?$/i.test(s) || /^(위|앞|윗|상기)\S*\s*.{0,14}?(와|과|에서)?\s*(같음|같다|같은|동일|동일함|마찬가지)\.?$/.test(s) || /^same as (the )?(row|line|rows|lines)? ?above/i.test(s);
}
/** The badge of a stroke from what its relations' readings say; null when none says anything of when it flows (no badge is
 * ever made from a name, a payload or a kind). A condition outranks an optional mark, which outranks cadence words. */
export function lineBadge(rels: readonly BadgeRead[], plain: (t: string) => string = t => t): LineBadge | null {
  const pick = (k: LineBadge['kind']) => rels.map(r => (k === 'condition' ? conditionWords(r.when) : k === 'optional' ? (r.optional ? '선택' : null) : r.cadence ?? null)).filter((x): x is string => !!x && !!x.trim());
  for (const kind of ['condition', 'optional', 'cadence'] as const) {
    const said = pick(kind); if (!said.length) continue;
    const words = [...new Set(said.map(s => s.replace(/\s+/g, ' ').trim()))], word = kind === 'condition' ? '조건' : kind === 'optional' ? '선택' : '박자';
    const modes = [...new Set(rels.map(r => r.mode).filter(Boolean))], mode = modes.length === 1 ? (modes[0] === 'design' ? ' · 설계' : ' · 관찰') : '';
    // Polish round fixes 1: the count says what it counts (「관계 2개 중 1개에 기록됨」, never 「…1개가 적음」, which reads as 'few').
    // Polish round fixes 2: the count only when some of the bundle's relations do not carry it (all of them: nothing to add).
    const count = rels.length > 1 && said.length < rels.length ? `\n${countWords(rels.length, said.length)}` : '';
    // Polish round (spec-cards-v2 §1): a condition or an optional mark is a small cue of fixed words on the line (「조건」, 「선택」;
    // 「조건 1/3」 when only some of the stroke's relations carry it, so a bundle never reads wholly conditional), never the record's
    // words cut short: those read whole in the tip, one 「조건: …」 a wording.
    const cue = `${word}${said.length < rels.length ? ` ${said.length}/${rels.length}` : ''}`;
    // The mode in words a reader can take without the legend (설계: what the code or docs define; 관찰: what a run showed).
    const modeSaid = modes.length === 1 ? (modes[0] === 'design' ? '\n코드·문서에서 읽은 흐름' : '\n실행에서 본 흐름') : '';
    if (kind === 'condition') {
      // A condition that only points at another row of the record (「위와 같음」) is said as such, muted, never resolved here.
      const unresolved = words.every(isRelativeRef);
      const tip = `조건 · 이 조건일 때만 흐름${unresolved ? ' · 기록 안의 상대 참조 (풀지 않음)' : ''}\n${words.map(w => conditionTip(w, plain)).join('\n')}${count}${modeSaid}`;
      return { kind, short: cue, full: cue, tip, words, n: said.length, unresolved, lead: words[0]!, quiet: false };
    }
    if (kind === 'optional') {
      // Only the optional relations' variants (another relation of the stroke may carry an older reading's variant).
      const vs = [...new Set(rels.filter(r => r.optional).map(r => r.variant?.trim()).filter((x): x is string => !!x))];
      const tip = `선택 · 늘 흐르지는 않음${vs.length ? ` · 그 변형일 때만\n${vs.map(variantWord).join('\n')}` : ' (기록이 선택으로 적음)'}${count}${modeSaid}`;
      return { kind, short: cue, full: cue, tip, words: vs, n: said.length, unresolved: false };
    }
    const unresolved = words.every(isRelativeRef);
    const tip = `${word} · 기록의 글자 그대로${unresolved ? ' · 기록 안의 상대 참조 (풀지 않음)' : ''}\n${words.map(w => `“${w}”`).join('\n')}${count}${modeSaid}`;
    // S8: a stroke whose words include more than the bare 「한 번」 leads with the first that does ('항목마다 외 2', not '한 번 외 2');
    // the words themselves and their count are the record's, only their order on the badge changes.
    const told = words.filter(w => !isOnceWord(w)), quiet = !told.length;
    const first = told[0] ?? words[0]!, others = words.length - 1, part = said.length < rels.length;
    const short = others ? `${first} 외 ${others}` : part ? `${first} (${said.length}/${rels.length})` : first;
    const full = `${cut(first, BADGE_FULL)}${others ? ` 외 ${others}` : part ? ` (${said.length}/${rels.length})` : ''}${mode}`;
    return { kind, short, full, tip, words, n: said.length, unresolved, lead: first, quiet };
  }
  return null;
}
/** How many of a stroke's relations carry the badge's words (Polish round fixes 1: 「관계 2개 중 1개에 기록됨」). */
export const countWords = (all: number, said: number): string => `관계 ${all}개 중 ${said}개에 기록됨`;
export const COUNT_RE = /^관계 \d+개 중 \d+개에 기록됨$/;
/** A variant in a tip, by its name (「변형 ‘다중 에이전트 그래프’」); a name already said as 「변형 …」 stays. */
export const variantWord = (v: string): string => (/^변형\s/.test(v) ? v : `변형 ‘${v}’`);
/** The texts a badge tries, in order, where it is placed (the first with room wins): selected, its full words, then the rest
 * form; then the words clipped to BADGE_CLIP; then the cadence glyph (or 조건 · 선택). At the overview and the dot map a cadence badge
 * is its glyph alone (5.5: the overview keeps condition badges; a cadence reads on hover and nearer). Never the bare kind word 박자. */
export function badgeForms(b: LineBadge, on: boolean, tier: ZoomTier | null = null): string[] {
  // Polish round (spec-cards-v2 §1): a condition or an optional mark is its cue alone at every tier (its words in the tip); when even
  // a 「조건 1/3」 finds no room it is the bare 「조건」, never nothing.
  if (b.kind !== 'cadence') { const word = b.kind === 'condition' ? '조건' : '선택'; return [...new Set([b.short, word])]; }
  const fallback = BADGE_GLYPH;
  // S8: a bare 「한 번」 says little: at rest below 가까이 it is no badge (quietMark: a tick on the line, its words in the tip).
  if (quietAt(b, on, tier)) return [];
  if (b.kind === 'cadence' && !on && (tier === 'far' || tier === 'dots')) return [BADGE_GLYPH];
  const first = b.lead ?? b.words[0] ?? '', others = b.words.length - 1;
  const clipped = others ? `${cut(first, BADGE_CLIP - 1)} 외 ${others}` : cut(first, BADGE_CLIP);
  return [...new Set([...(on ? [b.full] : []), b.short, clipped, fallback])];
}
/** Restore (spec-cards-v2 §7 'Conditional relations'; Astra F2, Pro R2): below 가까이 a line at rest carries no text pill (polish
 * round fixes 2), but a line with a condition or a 선택 mark never reads unconditional: it carries a tiny text-free mark on the line
 * itself (◇ a condition, a dashed ring 선택), its words in the line's tip. null: the pill is drawn (가까이, or the line is picked) or
 * the line has no such cue (a cadence word is no condition: it may rest unsaid, the 시작·반복 lens and the tip say it). */
export function restCue(b: Pick<LineBadge, 'kind'>, on: boolean, tier: ZoomTier | null): 'condition' | 'optional' | null {
  if (on || tier === 'near') return null;
  return b.kind === 'condition' || b.kind === 'optional' ? b.kind : null;
}
/** The rest cue mark's size on screen (px), at every zoom. */
export const CUE_PX = 8;
/** The record's bare 「한 번」 (CADENCE_WORDS 'once',and the same said as 1회 or once): a cadence word that says only that the line
 * flows once. Any word with more in it ('prepare 한 번', '시작 시 한 번', '끝에 한 번', '실행마다 1회') says more and is never quiet. */
export const isOnceWord = (t: string): boolean => /^(한\s?번|1\s?회|once)\.?$/i.test(t.replace(/\s+/g, ' ').trim());
/** Whether a badge folds into the quiet tick (S8): cadence words that are all a bare 「한 번」, at rest, at the overview, the dot map
 * or the middle tier (the full words read near and on a selected line, and in the pane). A condition is never quiet. */
export const quietAt = (b: Pick<LineBadge, 'kind' | 'quiet'>, on: boolean, tier: ZoomTier | null): boolean =>
  b.kind === 'cadence' && !!b.quiet && !on && (tier === 'far' || tier === 'dots' || tier === 'mid');
/** The quiet tick's tip: what it stands for, then the badge's own tip (the words as written). */
export const quietTip = (b: Pick<LineBadge, 'tip'>): string => `한 번 · 가까이 보거나 선을 고르면 글자로\n${b.tip}`;
/** Badges that found no place of their own on one part's side gather in one marker: '+N' (each line's words in its tip). */
// Cards v2 §1: the marker names what it gathers (「배지 +2」).
// Polish round fixes 1: it names the cues it gathers (「조건·박자 +2」), in the cue order (조건, 선택, 박자); 「배지」 only without them.
export const overflowMark = (n: number, kinds: readonly LineBadge['kind'][] = []): string => {
  const w = (['condition', 'optional', 'cadence'] as const).filter(k => kinds.includes(k)).map(k => (k === 'condition' ? '조건' : k === 'optional' ? '선택' : '박자'));
  return `${w.length ? w.join('·') : '배지'} +${n}`;
};

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

/* ---------- labels by zoom tier (5.5) ---------- */
/** What the lines carry at rest, by tier: at the overview and the dot map only how many relations a line holds and the condition
 * badges ('counts'); at the middle tier short labels ('short': cut to LABEL_SHORT, the main flow and a scenario path placed first,
 * 6.3); near, every label in full ('full'). The selection's own lines carry their labels at every tier. Labels only show or hide:
 * their places never move. */
export type RestLabels = 'counts' | 'short' | 'full';
export const restLabels = (tier: ZoomTier | null): RestLabels => (tier === 'far' || tier === 'dots' ? 'counts' : tier === 'mid' ? 'short' : 'full');
/** Whether a line's label reads at rest in a mode: none at 'counts' (the counts and condition badges stand for them), every one at
 * 'short' (cut) and 'full'. The main flow and a path win a contested place by their rank (labelRank), not here. */
export function restLabelShown(mode: RestLabels, _x: { spine?: boolean; path?: boolean } = {}): boolean {
  return mode !== 'counts';
}
/** A middle-tier label keeps this many characters, then an ellipsis (its whole words on hover and nearer). */
export const LABEL_SHORT = 14;
export const shortLabel = (t: string, n = LABEL_SHORT): string => cut(t, n);
/** Polish round fixes 2: a label shortened only to whole words (split at spaces and 「·」), never cut mid-word with 「…」; '' when even
 * its first word does not fit (the label is left to the line's tip then). */
export function wholeWords(t: string, n = LABEL_SHORT): string {
  const s = t.trim(); if (s.length <= n) return s;
  // Polish 7: whole units (cutUnits: a code run, spaces and all, is one; words split at spaces and 「·」).
  let out = '';
  for (const u of cutUnits(s)) { if ((out + u).replace(/[\s·]+$/, '').length > n) break; out += u; }
  // A quotation cut open (「고정 질의 "Is AI」) keeps only the words before it.
  if (((out.match(/["“”]/g) ?? []).length % 2) === 1) out = out.slice(0, out.search(/["“][^"“”]*$/));
  // Map hygiene H4: a bracket cut open (「JSON 응답(token,」, 「fs-job {type,」, 「경고 문구(stderr,」) keeps only the words before it, and
  // no label ends on punctuation that promises more (「,」 「(」 「{」 「:」 「;」 「/」 「-」 「·」) or on an arrow pointing at what was cut
  // (「발행 layout →」; review fixes).
  for (const [o, c] of [['(', ')'], ['{', '}'], ['[', ']'], ['（', '）'], ['「', '」']] as const) { const i = out.lastIndexOf(o); if (i >= 0 && out.indexOf(c, i) < 0) out = out.slice(0, i); }
  // Polish 7: nor on an operator (「len(files) ==」: the operator goes, never a cut that promises an operand), nor inside a code run (a
  // run the end would cut goes whole).
  return cutEnd(s, out, false) ?? '';
}
/** The end of a cut of s to its first characters out: punctuation that promises more and every trailing token that is only an
 * operator or a mark (「·」 「→」 「==」 「&&」) off the end; a code run the end would fall inside goes whole (strict: null instead, the
 * cut is not made at all). */
function cutEnd(s: string, out: string, strict: boolean): string | null {
  const spans = codeSpans(s);
  for (let prev = ''; prev !== out;) {
    prev = out;
    out = out.trimEnd().replace(/(?:…+|\.{3})$|[·,;:(\[{（「/\-→←↔⇒]+$|(?:^|\s)[·,;:/\-→←↔⇒=<>!&|+*%^~?]+$/, '').trimEnd();
    const inside = spans.find(([a, b]) => out.length > a && out.length < b && s.slice(out.length, b).trim());
    if (inside) { if (strict) return null; out = s.slice(0, inside[0]); }
  }
  return out.trim();
}
/** A line label's size on screen at zoom k: it follows the zoom a little (12.5 × √k) between 11 and 14px, so it never outweighs a
 * card's name (14px or more on screen, 5.2) far out and is not left tiny near in. */
export const labelPx = (k: number): number => Math.min(14, Math.max(11, 12.5 * Math.sqrt(Math.max(0.01, k))));
/** The badge's least height on screen at rest and selected (6.2, 9.6). */
export const BADGE_H = 16, BADGE_H_ON = 20;

/* ---------- code in a line label (polish 5) ----------
 * The ruling keeps code as code when the record has no plain words for it (never a paraphrase made up): such a label reads as quoted
 * code, not as broken prose. A run of code tokens is drawn as one monospace code chip at the label's size; the words around it stay
 * words (「REDIS_URL 있을 때」: the code in the chip, 「있을 때」 as words). A cut is made only between tokens, with 「…」. */
/** A token of code: ASCII with a letter and a mark only code has (an underscore, brackets, a slash, a dot between letters, an operator,
 * camelCase), never a plain word (「fetch」, 「POST」, 「bind」) and never a token with Hangul. */
export function codeToken(tok: string): boolean {
  const t = tok.replace(/…+$|\.{3}$/, '');
  if (t.length < 2 || !/^[\x21-\x7e]+$/.test(t) || !/[A-Za-z_$]/.test(t)) return false;
  return /[_(){}[\]/%=<>$#`*]|[a-z][A-Z]|[A-Za-z0-9]\.[A-Za-z]|::|->/.test(t);
}
/** An ASCII token with no letter that reads as part of the code next to it (an operator, a bracket, 「…」). */
const codeMark = (tok: string): boolean => /^[%=<>+\-*/!&|^~?:.,()[\]{}…]+$/.test(tok);
/** Polish 7: an operator mark (「==」 「!=」 「%」 「&&」), and what reads as its operand when code stands on its other side: a name, a
 * number or a quoted word (「== 0」 「!= Disabled」 「!= 'detailed_report'」), and the words that join an expression (「and」 「or」 「not」). */
const OP_MARK = /^[%=<>!&|+\-*/^~?:]+$/, OPERAND = /^[A-Za-z0-9_.$'"]+$/, CONNECTIVE = /^(?:and|or|not|in|is|None|True|False|null|nil)$/;
/** A label's text as runs of words and code (each run with its own spacing, in order; joined they give the text back). A code token
 * with a Hangul ending (「pb.skipBootstrap()이…」) gives the ending to the words; ASCII tokens beside code within the same run (「%…」, 「main)」
 * after 「(src/main.rs」) join the code. */
export function labelParts(text: string): { t: string; code: boolean }[] {
  const toks = text.split(/(\s+)/), out: { t: string; code: boolean }[] = [];
  const push = (t: string, code: boolean) => { if (!t) return; const last = out.at(-1); if (last && last.code === code) last.t += t; else out.push({ t, code }); };
  const kinds = toks.map(t => {
    if (!t || /^\s+$/.test(t)) return { t, k: 'space' as const };
    const m = /^([\x21-\x7e]+?)([가-힣]{1,3}…?|[가-힣]{1,3}\.{3})$/.exec(t);
    // Only a whole token takes a Hangul ending (「PR(병합」 opens words in brackets: no code there).
    if (m && /[\w)\]}'"`]$/.test(m[1]!) && codeToken(m[1]!)) return { t, k: 'code' as const, head: m[1]!, tail: m[2]! };
    return { t, k: codeToken(t) ? 'code' as const : codeMark(t) || (/^[\x21-\x7e]+$/.test(t) && /[()[\]{}]/.test(t)) ? 'mark' as const : 'word' as const };
  });
  // A mark joins the code only when code stands next to it (through spaces).
  const near = (i: number, d: -1 | 1): boolean => { for (let j = i + d; j >= 0 && j < kinds.length; j += d) { const k = kinds[j]!.k; if (k === 'space') continue; return k === 'code' || (k === 'mark' && near(j, d)); } return false; };
  // Polish 7: an expression is one run of code (「iter_num % log_interval == 0 and master_process」, 「len(files) == 0」가…): an operand
  // beside an operator that touches code, and a joining word between code, join it (a cut then never falls inside the expression).
  const nb = (i: number, d: -1 | 1): number => { for (let j = i + d; j >= 0 && j < kinds.length; j += d) if (kinds[j]!.k !== 'space') return j; return -1; };
  type K = { t: string; k: 'space' | 'code' | 'mark' | 'word'; head?: string; tail?: string };
  const ks = kinds as K[];
  for (let changed = true, g = 0; changed && g < 12; g++) {
    changed = false;
    ks.forEach((x, i) => {
      if (x.k === 'mark' && (near(i, -1) || near(i, 1))) { x.k = 'code'; changed = true; return; }
      if (x.k !== 'word') return;
      const L = nb(i, -1), R = nb(i, 1), lc = L >= 0 && ks[L]!.k === 'code', rc = R >= 0 && ks[R]!.k === 'code';
      const lop = lc && !ks[L]!.tail && OP_MARK.test(ks[L]!.t), rop = rc && OP_MARK.test(ks[R]!.t);
      if (OPERAND.test(x.t) && (lop || rop)) { x.k = 'code'; changed = true; return; }
      if (CONNECTIVE.test(x.t) && ((lc && !ks[L]!.tail && rc) || (L < 0 && rc && x.t === 'not'))) { x.k = 'code'; changed = true; return; }
      const m = /^([A-Za-z0-9_.$'"]+)([가-힣]{1,3}(?:…|\.{3})?)$/.exec(x.t);
      if (m && lop) { x.k = 'code'; x.head = m[1]!; x.tail = m[2]!; changed = true; }
    });
  }
  kinds.forEach((x, i) => {
    if (x.k === 'space') { const prev = out.at(-1), next = kinds.slice(i + 1).find(y => y.k !== 'space'); push(x.t, !!prev?.code && !!next && (next.k === 'code' || next.k === 'mark')); return; }
    if (x.k === 'code' && 'head' in x && x.head) { push(x.head, true); push(x.tail!, false); return; }
    push(x.t, x.k === 'code' || (x.k === 'mark' && (near(i, -1) || near(i, 1))));
  });
  // A cut's 「…」 reads outside the chip (the code itself is never made up longer or shorter than written).
  return out.flatMap(p => { const m = p.code ? /^(.*?)(…+|\.{3})$/s.exec(p.t) : null; return m && m[1] ? [{ t: m[1], code: true }, { t: m[2]!, code: false }] : [p]; })
    .reduce<{ t: string; code: boolean }[]>((acc, p) => { const last = acc.at(-1); if (last && last.code === p.code) last.t += p.t; else acc.push({ ...p }); return acc; }, []);
}
/** Whether a label shows code (then it is drawn with its code chip). */
export const hasCode = (text: string): boolean => labelParts(text).some(p => p.code);
/** The label cut to its first n tokens (spaces kept inside), with one 「…」 when anything is left out: a cut never falls inside a token
 * nor ends on a mark that promises more (「기동 ·」, 「==」, 「→」). null when what is left says nothing: fewer than 4 characters of words
 * (「기동 ·」 is only its lead, 「원시」 a fragment); the label is then left to its line's hover (polish 6). */
export function tokenCut(text: string, n: number): string | null {
  const s = text.trim(), us = cutUnits(s), solid = us.filter(u => u.trim()).length;
  if (n >= solid) return s;
  let seen = 0, out = '';
  for (const u of us) { if (u.trim()) { if (seen === n) break; seen++; } out += u; }
  // Off the end: a cut mark of its own (「...」, 「…」), a comma or 「·」 on the last word, and every whole token that is only such a mark
  // (「·」, 「→」, 「==」); a token's own characters never (「<command>」 keeps its 「>」). Polish 7: a code run's own characters never
  // either: a cut whose end would trim into a run (「len(files) ==」) is not made (null; a shorter one may be).
  const end = cutEnd(s, out, true); if (end === null) return null;
  return end.replace(/[\s·,;:()[\]{}…]/g, '').length < 4 ? null : `${end}…`;
}
/** How many units tokenCut counts in a text (its cuts are 1 … this − 1). */
export const cutCount = (text: string): number => cutUnits(text.trim()).filter(u => u.trim()).length;
/** v8 (review of v7: 「GPT 모델」 beside 「model.py」, 「train.py 학습 실행기」 in two fonts): a card's title is drawn in one font. Monospace
 * only when the whole title is code (what lies outside its code spans is spaces and 「·」 only) and that code is at least 4 characters;
 * a title with words, or with a code part narrower than that, stays in the title's own type (its identifier as written in the pane and
 * the hover). */
export function monoTitle(name: string, spans: readonly (readonly [number, number])[]): boolean {
  if (!spans.length) return false;
  let at = 0, code = 0, rest = '';
  for (const [a, b] of spans) { rest += name.slice(at, a); code += b - a; at = b; }
  rest += name.slice(at);
  return code >= 4 && /^[\s·]*$/.test(rest);
}
/** A condition written as code reads whole on the first screen up to this many characters (longer: cut between its units). */
export const FIT_CODE_MAX = 32;
/** v8 (review of v7: 「len(files) == 0가 거짓일 때」 and 「build 작업은 …」 left the map): a condition written as code never
 * vanishes at a readable zoom. Its long form: whole up to FIT_CODE_MAX characters, else its longest cut between units within that
 * (tokenCut: never inside a run, never ending on an operator), else whole; its short form: its longest such cut within LABEL_SHORT + 7,
 * else its shortest, else whole. fold (the far zoom only): one longer than FIT_CODE_MAX folds to its line's ◇ (both null), whose open cue
 * and hover read it whole. */
export function condForms(text: string, fold = false): { long: string | null; short: string | null } {
  const s = text.replace(/\s+/g, ' ').trim();
  if (fold && s.length > FIT_CODE_MAX) return { long: null, short: null };
  const cuts = condCuts(s);
  return { long: s.length <= FIT_CODE_MAX ? s : cuts.find(c => c.length <= FIT_CODE_MAX + 1) ?? cuts.at(-1) ?? s,
    short: cuts.find(c => c.length <= LABEL_SHORT + 7) ?? cuts.at(-1) ?? s };
}
/** A text's cuts between its units (tokenCut), longest first, each shorter than the text; none for one unit. v9 (review of v8: a condition
 * left the map at 1280): the last pass tries each of them, down to the shortest, before a condition folds to its ◇. */
export function condCuts(text: string): string[] {
  const s = text.replace(/\s+/g, ' ').trim(), cuts: string[] = [];
  for (let n = cutCount(s) - 1; n >= 1; n--) { const c = tokenCut(s, n); if (c !== null && c !== s && !cuts.includes(c)) cuts.push(c); }
  return cuts;
}
/** v9 (review of v8: 「CLOUD_MODE 가」): two runs of a label meet with no space between (a run of code and its particle, a word and its
 * 「…」): the later one keeps its halo off the letter before it (styles.css lb-join), never a gap. */
export const joinsRun = (prev: string, next: string): boolean => /\S$/.test(prev) && /^\S/.test(next);
/** v9 (review of v8: 「먼저 볼 연결: … → WebSocketManage…」, 「{out_dir}…」, 「ReadWriteProxy·…」): a name in at most n characters, cut between its
 * units as a label is (tokenCut: never inside a run of code or a word, never ending on 「·」 or an operator): whole when it fits; else its
 * longest such cut within n that keeps at least half of it; else whole up to n + 8 characters (「체크포인트 {out_dir}/ckpt.pt」 says which
 * checkpoint, 「체크포인트…」 does not); else that cut; else its first unit whole up to n + 8 characters; else cut at n (a single unit that long). */
export function tokenFit(text: string, n: number): string {
  const s = text.replace(/\s+/g, ' ').trim(); if (s.length <= n) return s;
  const cuts = condCuts(s), fit = cuts.find(c => c.length <= n);
  if (fit && fit.length - 1 >= s.length / 2) return fit;
  if (s.length <= n + 8) return s;
  if (fit) return fit;
  const first = cuts.at(-1) ?? null; if (first && first.length <= n + 8) return first;
  return `${s.slice(0, n - 1).trimEnd()}…`;
}
/** v8 (「Backups.Cron != ""」 drawn as 「Backups.Cron !=」): a label's quotation marks go (「」 『』 ‘’ “”), but the straight quotes
 * of code stay (an empty string is an operand). */
export const unquoteLabel = (t: string): string => { const s = t.replace(/[「」『』‘’“”]/g, ''); return (hasCode(s) ? s : s.replace(/"/g, '')).trim(); };
/** Polish 7: a label's units, the places a cut may fall between: each run of code whole (spaces and all: 「(src/main.rs main)」,
 * 「iter_num % log_interval == 0」), the words split at spaces and after a list's 「·」 (「질의·」 「report_type·」); a piece with no space or
 * 「·」 between it and the next stays one with it (「pb.skipBootstrap()이…」). Joined, the units give the text back. */
export function cutUnits(text: string): string[] {
  const pieces: string[] = [];
  for (const p of labelParts(text)) { if (p.code) pieces.push(p.t); else for (const w of p.t.split(/(?<=[\s·])(?=[^\s·])/)) if (w) pieces.push(w); }
  const out: string[] = [];
  for (const p of pieces) { const last = out.at(-1); if (last !== undefined && ((!/[\s·]$/.test(last) && !/^\s/.test(p)) || !p.trim())) out[out.length - 1] = last + p; else out.push(p); }
  return out;
}
/** Where the code runs of a text lie ([start, end) in its characters). */
function codeSpans(text: string): [number, number][] {
  const out: [number, number][] = []; let at = 0;
  for (const p of labelParts(text)) { if (p.code) out.push([at, at + p.t.length]); at += p.t.length; }
  return out;
}
