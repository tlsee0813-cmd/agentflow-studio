/* 보기틀 (spec forms v1): the unit-level view forms of one part's detail view (내부 상세). 「목록」 is the numbered step list the view
 * always had; 「노선」 draws the part's C-STEP rows as a vertical line in the record's own row order (the record ask's C-STEP rule asks
 * for the steps in run order, one per line, alternatives as S04a·b), and 「상태 전이」 draws the part's C-STATE rows on a circle.
 *
 * Geometry asserts facts, so a form is offered only when the record proves what its shape implies:
 * - the line only for at least three recorded steps whose C-STEP IDs are of one owner, unique and ascending in row order, with every
 *   branch naming a step of that owner that exists (never reordered, never repaired);
 * - program-made steps are not stations (not record rows); a loop is a bracket only when its whole body is on the line and
 *   contiguous; a fork never joins (the record does not say where the branches meet); an exit with no condition breaks the line;
 * - the state graph places states on a circle in first-appearance order (no layer, no rank, no first-state emphasis), draws only
 *   recorded transitions, and marks a start only for a state the record calls initial.
 * Pure and deterministic: no DOM, unit-free numbers the detail view positions its own elements by. */

export type FormId = 'list' | 'line' | 'states';
export const FORM_IDS: readonly FormId[] = ['list', 'line', 'states'];
export const FORM_WORD: Readonly<Record<FormId, string>> = { list: '목록', line: '노선', states: '상태 전이' };

/* ---------- inputs ---------- */
export interface FormBranch { when: string | null; to: string[]; max: string | null; outcome: string | null }
/** A C-STEP row as the forms read it. cell: the row's 조건·분기 cell as written (tells an arrow-led clause from a plain one). */
export interface FormStep { ref: string | null; name: string; does: string | null; program: boolean; alt: { group: string; branch: string } | null;
  branch: FormBranch[]; loopIds: string[]; cell?: string | null }
export interface FormLoop { ref: string; parentRef: string | null; unit: string | null; count: string | null; stop: string | null; body: string[]; bodyState: 'linked' | 'unexpanded' | null }
export interface FormEntry { ref: string; name: string; kind: string | null }
export interface FormState { name: string; event: string | null; next: string | null }

interface StepLike { name: string; does: string | null; program?: boolean; recordRef?: string | null; alt?: { group: string; branch: string } | null;
  branch?: readonly FormBranch[]; loopIds?: readonly string[]; when?: string | null }
export function formStep(s: StepLike): FormStep {
  return { ref: s.recordRef ?? null, name: s.name, does: s.does ?? null, program: !!s.program, alt: s.alt ?? null,
    branch: (s.branch ?? []).map(b => ({ when: b.when ?? null, to: [...(b.to ?? [])], max: b.max ?? null, outcome: b.outcome ?? null })), loopIds: [...(s.loopIds ?? [])], cell: s.when ?? null };
}
interface LoopLike { recordRef: string; parentRef: string | null; unit: string | null; count: string | null; stop: string | null; body: readonly string[]; bodyState?: 'linked' | 'unexpanded' | null }
export function formLoop(l: LoopLike): FormLoop {
  return { ref: l.recordRef, parentRef: l.parentRef, unit: l.unit, count: l.count, stop: l.stop, body: [...l.body], bodyState: l.bodyState ?? null };
}

/* ---------- step IDs ---------- */
const REF = /^\s*(B)(\d{1,4})\s*:\s*S(\d{1,4})([a-z]?)\s*$/i;
export interface StepRef { owner: string; n: number; sfx: string }
/** A C-STEP row ID (B03:S04a) read: its owner (B3 and B03 are one), its number and its alternative letter. */
export function parseStepRef(ref: string | null | undefined): StepRef | null {
  const m = ref ? REF.exec(ref) : null; return m ? { owner: `B${Number(m[2])}`, n: Number(m[3]), sfx: m[4]!.toLowerCase() } : null;
}
export const ownerOf = (ref: string | null | undefined): string | null => { const m = ref ? /^\s*B(\d{1,4})\b/i.exec(ref) : null; return m ? `B${Number(m[1])}` : null; };
const refKey = (p: StepRef) => `${p.owner}:${p.n}${p.sfx}`;
/** The short ID a label names a step by (S06, S04a). */
export const shortRef = (ref: string) => { const p = parseStepRef(ref); return p ? `S${String(p.n).padStart(2, '0')}${p.sfx}` : ref; };

/* ---------- 노선: eligibility ---------- */
export const LINE_RULE = '기록 요청서 C-STEP: 부분의 단계를 실행 순서대로 한 줄에 하나씩';
export const LINE_FEW = '단계가 3개보다 적음';
export const LINE_OLD = '이 단계 표는 행 순서를 실행 순서로 쓰라는 규칙이 없는 옛 기록';
export const LINE_OWNER = '단계 ID가 다른 부분의 것';
export const LINE_DUP = '단계 ID가 겹침';
export const LINE_ORDER = '단계 ID가 행 순서대로 오르지 않음';
export const LINE_TARGET = '분기가 없는 단계를 가리킴';
export interface Offer { ok: boolean; reason: string }
/** Whether the line may be drawn for these steps (owner: the part's own C-PART ID, when known). Only recorded (non-program) steps
 * count; three is a display policy, not a meaning test. Any failed consistency check means no line and says which. */
export function lineOffer(steps: readonly FormStep[], owner: string | null = null): Offer {
  const rec = steps.filter(s => !s.program);
  if (rec.length < 3) return { ok: false, reason: LINE_FEW };
  const parsed = rec.map(s => parseStepRef(s.ref));
  if (parsed.some(p => !p)) return { ok: false, reason: LINE_OLD };
  const ps = parsed as StepRef[], owners = new Set(ps.map(p => p.owner)), own = ownerOf(owner);
  if (owners.size > 1 || (own && !owners.has(own))) return { ok: false, reason: `${LINE_OWNER} · ${rec.find((_, i) => ps[i]!.owner !== (own ?? ps[0]!.owner))?.ref ?? rec[0]!.ref}` };
  const seen = new Set<string>();
  for (let i = 0; i < ps.length; i++) { const k = refKey(ps[i]!); if (seen.has(k)) return { ok: false, reason: `${LINE_DUP} · ${rec[i]!.ref}` }; seen.add(k); }
  for (let i = 1; i < ps.length; i++) {
    const a = ps[i - 1]!, b = ps[i]!;
    if (b.n < a.n || (b.n === a.n && (!a.sfx || !b.sfx))) return { ok: false, reason: `${LINE_ORDER} · ${rec[i - 1]!.ref} 다음 ${rec[i]!.ref}` };
  }
  const o = ps[0]!.owner, groups = new Set(ps.filter(p => p.sfx).map(p => `${p.owner}:${p.n}`));
  for (const s of rec) for (const b of s.branch) for (const t of b.to) {
    const p = parseStepRef(t); if (!p || p.owner !== o) continue;
    if (!seen.has(refKey(p)) && !(p.sfx === '' && groups.has(`${p.owner}:${p.n}`))) return { ok: false, reason: `${LINE_TARGET} · ${s.ref} → ${t}` };
  }
  return { ok: true, reason: LINE_RULE };
}

/* ---------- 노선: geometry ---------- */
export const ROW_H = 64, ROW_H_DOES = 84, COL_W = 220, LOOP_GUTTER = 28, JUMP_GUTTER = 26;
/** One line of station content (a condition chip, a gate, the exits), the name line, the gap a segment's tag sits in, a tag band. */
export const LABEL_MAX = 400, LINE_H = 20, NAME_H = 24, GAP = 40, TAG_H = 26, SPLIT_H = 22, ENTRY_H = 30, PAD = 12, DOT_R = 11;
export const LINE_CAPTION = '기록에 적힌 실행 순서 · 실행 검증 아님 · 간격은 시간 아님';
export const FORK_TAG = '조건에 따라 하나';
export const FORK_OPEN = '갈래 뒤 합류는 기록에 없음';
export const COND_TAG = '조건에 따라';
export const APART_OUT = '몸통 단계가 이 노선 밖', APART_SPLIT = '몸통이 떨어져 있음', APART_NONE = '몸통 미기록';
export const ENTRY_WORD: Readonly<Record<string, string>> = { command: '명령', call: '호출', request: '요청', message: '메시지·사건', schedule: '일정', resident: '상주', script: '스크립트' };

/** A text's width at a font size (px), from its characters (Hangul and CJK a full em, Latin about half): an upper bound the UI
 * keeps by a max width and an ellipsis. */
export function textWidth(s: string, px: number): number {
  let w = 0;
  for (const ch of s) { const c = ch.codePointAt(0)!; w += c >= 0x1100 && (c <= 0x11ff || (c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xac00 && c <= 0xd7a3) || (c >= 0xf900 && c <= 0xfaff) || (c >= 0xff00 && c <= 0xffef)) ? 1 : /[A-Z0-9MW@%#&]/.test(ch) ? 0.68 : ch === ' ' ? 0.32 : c > 0x7f ? 1 : 0.58; }
  return Math.ceil(w * px);
}
export interface Rect { x: number; y: number; w: number; h: number }
export interface Pill extends Rect { text: string; tip: string }
export type ExitKind = 'out' | 'exit' | 'end' | 'note';
export interface StationExit { kind: ExitKind; text: string; tip: string }
export interface Station { index: number; row: number; col: number; kind: 'recorded'; ref: string; name: string;
  /** the dot's centre (on the line) and the station block (the button: from the dot's left edge to its label's right end) */
  x: number; y: number; top: number; h: number; left: number; right: number;
  /** content lines below the name: the alternative's condition cell, the 조건·분기 clauses drawn nowhere else, the exits */
  cond: string | null; notes: string[]; exits: StationExit[]; extra: number; loops: string[] }
export interface Segment { x1: number; y1: number; x2: number; y2: number; kind: 'solid' | 'cond'; curve?: boolean; open?: boolean; tail?: boolean; tip: string }
export interface Bracket { ref: string; x: number; xEnd: number; y1: number; y2: number; depth: number; label: string; tag: Pill; tip: string }
export interface Arc { lane: number; x: number; xFrom: number; y1: number; y2: number; back: boolean; from: number; to: number; label: string; pill: Pill; tip: string }
export interface Fork { row: number; group: string; stations: number[]; open: true; tag: Pill; gap: Pill | null }
export interface LoopApart { ref: string; label: string; why: string; text: string; parts: string[] }
export interface Jump { from: number; to: number; label: string; back: boolean }
export interface StepLine { width: number; height: number; x0: number; stations: Station[]; segments: Segment[]; brackets: Bracket[]; arcs: Arc[];
  jumps: Jump[]; forks: Fork[]; tags: Pill[]; terminals: Pill[]; loopsApart: LoopApart[]; program: number; crossings: number }
export interface LineOptions {
  /** the width the view has for the line (it grows past it only for what cannot be narrower; the view scrolls then) */
  width?: number;
  /** per input step index: content lines the view adds under the station (placed condition chips, gate chips and exits) */
  extra?: readonly number[];
  /** the part's own C-PART ID (B03); else the steps' own */
  owner?: string | null;
  /** C-STEP rows of the map's other parts: a loop's body on them makes it a loop apart, never a bracket */
  elsewhere?: readonly { ref: string | null; loopIds: readonly string[] }[];
  /** C-PART ID → the part's name, for 「몸통이 ‘…’에도 있음」 */
  ownerNames?: Readonly<Record<string, string>>;
}

/** The loop's tag: 「↻ {unit} · {count} · 끝: {stop}」 with only the items the row has. */
export function loopLabel(l: Pick<FormLoop, 'ref' | 'unit' | 'count' | 'stop'>): string {
  const bits = [l.unit, l.count, l.stop ? `끝: ${l.stop}` : null].filter((x): x is string => !!x);
  return `↻ ${bits.length ? bits.join(' · ') : l.ref}`;
}
const SPLIT = /\s*;\s*|\s+\/\s+/;
const clauseText = (b: FormBranch) => [b.when, b.to.length || b.outcome || b.max ? `→ ${[...b.to, b.max, b.outcome].filter(Boolean).join(', ')}` : null].filter(Boolean).join(' ');

/** The line for one part's steps (call it only when lineOffer passes: it never reorders and never repairs). loops: every C-LOOP row
 * that may touch the line (the part's own, and any its steps name). */
export function stepLine(steps: readonly FormStep[], loops: readonly FormLoop[], entries: readonly FormEntry[], opts: LineOptions = {}): StepLine {
  const rec = steps.map((s, index) => ({ s, index })).filter(x => !x.s.program);
  const owner = ownerOf(opts.owner) ?? parseStepRef(rec[0]?.s.ref)?.owner ?? null;
  // Rows: one per step; consecutive alternatives of one group (S04a, S04b) share a row, side by side.
  const rows: { items: typeof rec; group: string | null }[] = [];
  for (const x of rec) {
    const last = rows.at(-1), g = x.s.alt?.group ?? null;
    if (g && last?.group === g) last.items.push(x); else rows.push({ items: [x], group: g });
  }
  const rowOfIndex = new Map<number, number>(), keyRow = new Map<string, number>(), keyIndex = new Map<string, number>(), groupRow = new Map<string, number>();
  rows.forEach((r, ri) => r.items.forEach(x => { rowOfIndex.set(x.index, ri); const p = parseStepRef(x.s.ref); if (p) { keyRow.set(refKey(p), ri); keyIndex.set(refKey(p), x.index); if (p.sfx) groupRow.set(`${p.owner}:${p.n}`, ri); } }));
  const resolve = (t: string): { row: number; index: number } | 'outside' | null => {
    const p = parseStepRef(t); if (!p) return null;
    if (p.owner !== owner) return 'outside';
    const k = refKey(p); if (keyRow.has(k)) return { row: keyRow.get(k)!, index: keyIndex.get(k)! };
    const g = groupRow.get(`${p.owner}:${p.n}`); if (g !== undefined && !p.sfx) return { row: g, index: rows[g]!.items[0]!.index };
    return null;
  };
  const isFork = (ri: number) => rows[ri]!.items.length > 1;

  // Clauses read per station: jumps on the line, exits beside it, and what they do to the segment after the station.
  type Read = { jumps: { to: number; toIndex: number; label: string; tip: string; uncond: boolean }[]; exits: StationExit[]; notes: string[]; cond: string[]; broken: boolean };
  const reads = new Map<number, Read>();
  for (const { s, index } of rec) {
    const r: Read = { jumps: [], exits: [], notes: [], cond: [], broken: false }, ri = rowOfIndex.get(index)!;
    const cells = (s.cell ?? '').trim().split(SPLIT).filter(Boolean);
    s.branch.forEach((b, k) => {
      const tip = `조건·분기 칸 · ${cells[k] ?? clauseText(b)}`, arrowLed = !b.when && /^\s*(?:→|->)/.test(cells[k] ?? '');
      const tail = `${b.max ? ` · ${b.max}` : ''}${b.outcome ? ` · ${b.outcome}` : ''}`;
      const inside = b.to.map(t => ({ t, at: resolve(t) })), on = inside.filter(x => x.at && x.at !== 'outside') as { t: string; at: { row: number; index: number } }[];
      const out = inside.filter(x => x.at === 'outside');
      const next = on.length > 0 && on.every(x => x.at.row === ri + 1);
      for (const x of on) if (!next) r.jumps.push({ to: x.at.row, toIndex: x.at.index, label: `${b.when ? `${b.when} ` : ''}→ ${shortRef(x.t)}${tail}`, tip, uncond: !b.when });
      for (const x of out) r.exits.push({ kind: 'out', text: `${b.when ? `${b.when} ` : ''}→ ${x.t}${tail}`, tip: `${tip}\n이 노선 밖의 단계로 · ${x.t}` });
      if (!b.to.length && b.outcome) {
        if (b.when) r.exits.push({ kind: 'exit', text: `${b.when} → ${b.outcome}${b.max ? ` · ${b.max}` : ''}`, tip });
        else if (arrowLed) r.exits.push({ kind: 'end', text: `→ ${b.outcome}`, tip: `${tip}\n조건 없이 이 단계에서 끝나거나 거부함 (기록의 말)` });
        else if (!s.alt) r.notes.push(b.outcome);
      }
      // A clause with a condition (or one written without an arrow: the cell is the 조건·분기 column) makes the next step conditional;
      // one with no condition that jumps or ends breaks the line after the station.
      const uncond = !b.when && ((on.length > 0 && !next) || out.length > 0 || (!b.to.length && !!b.outcome && arrowLed));
      if (uncond) r.broken = true; else if (b.when || (!b.to.length && b.outcome)) r.cond.push(tip);
    });
    reads.set(index, r);
  }

  // Loops: a bracket only for a whole, contiguous body on this line; any other loop the line touches is listed apart.
  const stationKeys = new Set(keyRow.keys());
  const touches = (l: FormLoop) => ownerOf(l.ref) === owner || rec.some(x => x.s.loopIds.includes(l.ref)) || l.body.some(t => { const p = parseStepRef(t); return !!p && stationKeys.has(refKey(p)); });
  const cands: { l: FormLoop; top: number; bottom: number }[] = [], apart: LoopApart[] = [];
  const seenLoop = new Set<string>();
  for (const l of loops) {
    if (seenLoop.has(l.ref) || !touches(l)) continue; seenLoop.add(l.ref);
    const label = loopLabel(l);
    const body = new Set<string>(l.body);
    for (const x of rec) if (x.s.loopIds.includes(l.ref) && x.s.ref) body.add(x.s.ref);
    for (const e of opts.elsewhere ?? []) if (e.ref && e.loopIds.includes(l.ref)) body.add(e.ref);
    if (!body.size) { apart.push({ ref: l.ref, label, why: APART_NONE, text: `${l.ref} 반복 · ${APART_NONE}${l.bodyState === 'unexpanded' ? ' (몸통 단계 펼치지 않음)' : ''}`, parts: [] }); continue; }
    const others = [...new Set([...body].map(t => ownerOf(t)).filter((o): o is string => !!o && o !== owner))];
    const rowsIn = new Set<number>(); let missing = false;
    for (const t of body) { const p = parseStepRef(t); if (!p) { missing = true; continue; } if (p.owner !== owner) continue; const r0 = keyRow.get(refKey(p)); if (r0 === undefined) missing = true; else rowsIn.add(r0); }
    if (others.length) {
      const names = others.map(o => opts.ownerNames?.[o] ? `‘${opts.ownerNames[o]}’` : o);
      apart.push({ ref: l.ref, label, why: APART_OUT, text: `${l.ref} 반복의 일부 · 몸통이 ${names.join(', ')}에도 있음`, parts: others }); continue;
    }
    if (missing || !rowsIn.size) { apart.push({ ref: l.ref, label, why: APART_OUT, text: `${l.ref} 반복의 일부 · ${APART_OUT}`, parts: [] }); continue; }
    const top = Math.min(...rowsIn), bottom = Math.max(...rowsIn);
    const bodyKeys = new Set([...body].map(t => parseStepRef(t)).filter((p): p is StepRef => !!p).map(refKey));
    let whole = true;
    for (let r0 = top; r0 <= bottom; r0++) for (const x of rows[r0]!.items) { const p = parseStepRef(x.s.ref); if (!p || !bodyKeys.has(refKey(p))) whole = false; }
    if (!whole) { apart.push({ ref: l.ref, label, why: APART_SPLIT, text: `${l.ref} 반복의 일부 · ${APART_SPLIT}`, parts: [] }); continue; }
    cands.push({ l, top, bottom });
  }
  // Depth: inner (shorter) loops first, a child before its parent on a tie; each sits one gutter left of anything it overlaps.
  cands.sort((a, b) => (a.bottom - a.top) - (b.bottom - b.top) || (a.l.parentRef === b.l.ref ? -1 : b.l.parentRef === a.l.ref ? 1 : 0) || a.top - b.top || a.l.ref.localeCompare(b.l.ref));
  const depthOf = new Map<string, number>();
  for (const c of cands) {
    let d = 1; for (const o of cands) { const od = depthOf.get(o.l.ref); if (od !== undefined && o.top <= c.bottom && c.top <= o.bottom) d = Math.max(d, od + 1); }
    depthOf.set(c.l.ref, d);
  }
  const maxDepth = Math.max(0, ...depthOf.values());
  const x0 = 18 + maxDepth * LOOP_GUTTER + (maxDepth ? 6 : 0);

  // Jumps: lanes right of the labels, the shortest nearest; a lane holds jumps whose spans do not meet.
  const raw: { from: number; fromIndex: number; to: number; toIndex: number; label: string; tip: string }[] = [];
  for (const { index } of rec) for (const j of reads.get(index)!.jumps) raw.push({ from: rowOfIndex.get(index)!, fromIndex: index, to: j.to, toIndex: j.toIndex, label: j.label, tip: j.tip });
  const order = raw.map((j, k) => ({ j, k })).sort((a, b) => Math.abs(a.j.to - a.j.from) - Math.abs(b.j.to - b.j.from) || Math.min(a.j.from, a.j.to) - Math.min(b.j.from, b.j.to) || a.k - b.k);
  const laneOf = new Map<number, number>(), laneSpans: [number, number][][] = [];
  for (const { j, k } of order) {
    const lo = Math.min(j.from, j.to), hi = Math.max(j.from, j.to);
    let lane = 0; while ((laneSpans[lane] ?? []).some(([a, b]) => a <= hi && lo <= b)) lane++;
    (laneSpans[lane] ??= []).push([lo, hi]); laneOf.set(k, lane);
  }
  const lanes = laneSpans.length;
  const labelW = raw.length ? Math.min(190, Math.max(...raw.map(j => textWidth(j.label, 12) + 28))) : 0;
  const jumpArea = lanes ? 14 + (lanes - 1) * JUMP_GUTTER + 14 + labelW : 0;
  const maxCols = Math.max(1, ...rows.map(r => r.items.length));
  const natural = x0 + (maxCols - 1) * COL_W + DOT_R + 220 + jumpArea + 8;
  const width = Math.max(Math.round(opts.width ?? 0), natural);
  // With jumps, the labels end where a name and its line need (LABEL_MAX), so the arcs stay beside the stations, not across the view.
  const need = Math.max(220, ...rows.map(r => { const x = r.items.at(-1)!, rd = reads.get(x.index)!;
    return (r.items.length - 1) * COL_W + 32 + Math.max(textWidth(`${shortRef(x.s.ref ?? '')}  ${x.s.name}`, 15), textWidth(x.s.does ?? '', 13), textWidth(rd.exits.map(e => e.text).join('  '), 12) + rd.exits.length * 16); }));
  const labelRight = lanes ? Math.min(width - 8 - jumpArea, x0 + DOT_R + Math.min(LABEL_MAX + (maxCols - 1) * COL_W, need + 24)) : width - 8 - jumpArea;

  // Vertical layout: entries, then each row with the bands of the tags that open on it.
  const terminals: Pill[] = [], tags: Pill[] = [], stations: Station[] = [], forks: Fork[] = [], segments: Segment[] = [], brackets: Bracket[] = [];
  let y = PAD;
  for (const e of entries) {
    const text = `진입 · ${e.kind ? ENTRY_WORD[e.kind] ?? e.kind : '방식 미상'} · ${e.name}`;
    const w = Math.min(textWidth(text, 12.5) + 24, labelRight - (x0 - DOT_R));
    terminals.push({ x: x0 - DOT_R, y, w, h: 24, text, tip: `진입점 ${e.ref} · ${text}\n기록의 C-ENTRY 행 · 첫 단계와 잇지 않음 (진입이 어느 단계로 드는지는 기록에 없음)` });
    y += ENTRY_H;
  }
  if (entries.length) y += 6;
  const rowTop: number[] = [], rowBottom: number[] = [], rowY: number[] = [], bandTop = new Map<number, number>();
  const tagRight = (text: string, x: number) => Math.min(textWidth(text, 12) + 22, Math.max(80, labelRight - x));
  rows.forEach((r, ri) => {
    // Loop tags opening on this row, outer first (higher), then the fork's tag and its split.
    const opening = cands.filter(c => c.top === ri).sort((a, b) => depthOf.get(b.l.ref)! - depthOf.get(a.l.ref)!);
    for (const c of opening) {
      const d = depthOf.get(c.l.ref)!, label = loopLabel(c.l), tx = x0 + 18;
      const tag: Pill = { x: tx, y: y + 3, w: tagRight(label, tx), h: TAG_H - 6, text: label, tip: `반복 ${c.l.ref} · ${label}\n몸통 ${rows.slice(c.top, c.bottom + 1).flatMap(q => q.items.map(x => x.s.ref)).join(', ')} · 기록의 C-LOOP 행과 단계의 소속 반복${c.l.parentRef ? `\n바깥 반복 ${c.l.parentRef}` : ''}\n괄호는 몸통일 뿐 · 실행 화살표가 아님` };
      brackets.push({ ref: c.l.ref, x: x0 - 22 - (d - 1) * LOOP_GUTTER, xEnd: x0 - 8, y1: y + TAG_H / 2, y2: 0, depth: d, label, tag, tip: tag.tip });
      tags.push(tag); y += TAG_H;
    }
    let forkTag: Pill | null = null;
    if (isFork(ri)) {
      const whens = r.items.map(x => x.s.cell?.trim()).filter((c): c is string => !!c);
      forkTag = { x: x0 + 18, y: y + 3, w: tagRight(FORK_TAG, x0 + 18), h: TAG_H - 6, text: FORK_TAG,
        tip: `갈래 ${r.group} · ${r.items.map(x => x.s.ref).join(' · ')} 중 하나 (기록의 C-STEP 갈래 ID)${whens.length ? `\n${r.items.map(x => `${shortRef(x.s.ref!)}: ${x.s.cell?.trim() || '조건 미기재'}`).join('\n')}` : '\n갈래의 조건 칸은 기록에 없음'}` };
      tags.push(forkTag); bandTop.set(ri, y); y += TAG_H + SPLIT_H;
    }
    rowTop[ri] = y; rowY[ri] = y + NAME_H / 2;
    let bottom = y;
    r.items.forEach((x, c) => {
      const rd = reads.get(x.index)!, cond = x.s.alt && x.s.cell?.trim() ? x.s.cell.trim() : null;
      const extra = Math.max(0, Math.round(opts.extra?.[x.index] ?? 0));
      const lines = (x.s.does ? 1 : 0) + (cond ? 1 : 0) + (rd.notes.length ? 1 : 0) + (rd.exits.length ? 1 : 0) + extra;
      const h = NAME_H + lines * LINE_H, sx = x0 + c * COL_W;
      const right = c < r.items.length - 1 ? sx + COL_W - 30 : labelRight;
      stations.push({ index: x.index, row: ri, col: c, kind: 'recorded', ref: x.s.ref ?? '', name: x.s.name, x: sx, y: rowY[ri]!, top: y, h, left: sx - DOT_R, right,
        cond, notes: rd.notes, exits: rd.exits, extra, loops: cands.filter(q => q.top <= ri && ri <= q.bottom).map(q => q.l.ref) });
      bottom = Math.max(bottom, y + h);
    });
    rowBottom[ri] = bottom;
    if (forkTag) forks.push({ row: ri, group: r.group!, stations: r.items.map(x => x.index), open: true, tag: forkTag, gap: null });
    y = bottom + GAP;
  });
  const last = rows.length - 1;
  // A bracket closes just under its last station's content; an outer one a little lower, so nested ends read apart.
  for (const b of brackets) { const c = cands.find(q => q.l.ref === b.ref)!; b.y2 = rowBottom[c.bottom]! + 6 + (b.depth - 1) * 5; }

  // Segments: the line between rows (solid, or dashed with its tag where the step's clause decides), the fork's split and its open
  // branch ends, a broken segment after an exit with no condition, and the line's plain end.
  const at = (index: number) => stations.find(s => s.index === index)!;
  const stub = (s: Station): Segment => ({ x1: s.x, y1: s.y, x2: s.x, y2: Math.max(s.y + 30, s.top + s.h + 14), kind: 'solid', open: true, tip: '' });
  for (let ri = 0; ri <= last; ri++) {
    const here = rows[ri]!.items.map(x => at(x.index));
    if (ri === last) {
      for (const s of here) segments.push(here.length > 1 || reads.get(s.index)!.broken ? { ...stub(s), tip: here.length > 1 ? FORK_OPEN : '조건 없는 출구 · 이 단계 뒤로 잇지 않음' } : { x1: s.x, y1: s.y, x2: s.x, y2: s.top + s.h + 12, kind: 'solid', tail: true, tip: '기록된 마지막 행 · 끝이라는 기록은 아님' });
      continue;
    }
    if (here.length > 1) {
      for (const s of here) segments.push({ ...stub(s), tip: FORK_OPEN });
      const f = forks.find(q => q.row === ri)!;
      f.gap = { x: x0 + 14, y: rowBottom[ri]! + (GAP - 18) / 2, w: tagRight(FORK_OPEN, x0 + 14), h: 18, text: FORK_OPEN, tip: `${FORK_OPEN} · 갈래가 어디서 다시 만나는지 기록이 말하지 않아 잇지 않음` };
      tags.push(f.gap); continue;
    }
    const s = here[0]!, rd = reads.get(s.index)!;
    if (rd.broken) { segments.push({ ...stub(s), tip: '조건 없는 출구 · 이 단계 뒤로 잇지 않음 (기록의 조건·분기 칸)' }); continue; }
    const kind = rd.cond.length ? 'cond' : 'solid', tip = rd.cond.length ? `${COND_TAG} · ${s.ref}의 ${rd.cond.join('\n')}` : `${s.ref} 다음 행 · 기록의 행 순서`;
    const nextRow = rows[ri + 1]!.items.map(x => at(x.index));
    if (nextRow.length > 1) {
      const split = bandTop.get(ri + 1)! + TAG_H;
      segments.push({ x1: s.x, y1: s.y, x2: s.x, y2: nextRow[0]!.y, kind, tip });
      for (const n of nextRow.slice(1)) segments.push({ x1: s.x, y1: split, x2: n.x, y2: n.y, kind, curve: true, tip });
    } else segments.push({ x1: s.x, y1: s.y, x2: nextRow[0]!.x, y2: nextRow[0]!.y, kind, tip });
    if (kind === 'cond' && nextRow.length === 1) tags.push({ x: x0 + 14, y: rowBottom[ri]! + (GAP - 18) / 2, w: tagRight(COND_TAG, x0 + 14), h: 18, text: COND_TAG, tip });
  }

  // Arcs: right of the labels, out from the station's row and back into the target's, each label in the column beyond the lanes.
  const arcs: Arc[] = [], jumps: Jump[] = [];
  raw.forEach((j, k) => {
    const lane = laneOf.get(k)!, a = at(j.fromIndex), b = at(j.toIndex), x = labelRight + 14 + lane * JUMP_GUTTER;
    const pill: Pill = { x: labelRight + 14 + (lanes - 1) * JUMP_GUTTER + 14, y: (a.y + b.y) / 2 - 10, w: labelW, h: 20, text: j.label, tip: `${j.tip}\n${a.ref} → ${b.ref}${j.to <= j.from ? ' · 되돌아감' : ''}` };
    arcs.push({ lane, x, xFrom: labelRight + 2, y1: a.y, y2: b.y, back: j.to <= j.from, from: j.from, to: j.to, label: j.label, pill, tip: pill.tip });
    jumps.push({ from: j.from, to: j.to, label: j.label, back: j.to <= j.from });
  });
  // Labels in the column never overlap: a sweep down, each below the one before.
  const byY = [...arcs].sort((p, q) => p.pill.y - q.pill.y || p.lane - q.lane);
  for (let i = 1; i < byY.length; i++) { const p = byY[i - 1]!.pill, q = byY[i]!.pill; if (q.y < p.y + p.h + 4) q.y = p.y + p.h + 4; }
  for (const a of arcs) tags.push(a.pill);
  // Crossings: two jumps whose spans interleave cannot both stay clear on one side (counted, so the view can say so).
  let crossings = 0;
  for (let i = 0; i < arcs.length; i++) for (let k = i + 1; k < arcs.length; k++) {
    const A = arcs[i]!, B = arcs[k]!, [a1, a2] = [Math.min(A.y1, A.y2), Math.max(A.y1, A.y2)], [b1, b2] = [Math.min(B.y1, B.y2), Math.max(B.y1, B.y2)];
    if ((a1 < b1 && b1 < a2 && a2 < b2) || (b1 < a1 && a1 < b2 && b2 < a2)) crossings++;
  }
  // Arcs meeting at one station (as a start or an end) spread a few pixels apart, so their ends and heads stay apart.
  const meets = new Map<number, { a: Arc; end: 'y1' | 'y2' }[]>();
  raw.forEach((j, k) => { for (const [st, end] of [[j.fromIndex, 'y1'], [j.toIndex, 'y2']] as const) { const list = meets.get(st) ?? []; list.push({ a: arcs[k]!, end }); meets.set(st, list); } });
  for (const list of meets.values()) if (list.length > 1) {
    list.sort((p, q) => p.a.lane - q.a.lane || (p.end < q.end ? -1 : 1));
    list.forEach((e, i) => { e.a[e.end] += Math.round((i - (list.length - 1) / 2) * 7); });
  }
  const bottom = Math.max(y - GAP + 24, ...tags.map(t => t.y + t.h + PAD), ...segments.map(s => Math.max(s.y1, s.y2) + PAD));
  return { width, height: Math.ceil(bottom), x0, stations, segments, brackets, arcs, jumps, forks, tags, terminals, loopsApart: apart, program: steps.length - rec.length, crossings };
}
/** Every box the line places (stations, tags, terminals): the view's no-overlap invariant reads these. */
export function lineBoxes(l: StepLine): (Rect & { what: string })[] {
  return [...l.stations.map(s => ({ x: s.left, y: s.top, w: s.right - s.left, h: s.h, what: `station ${s.ref}` })),
    ...l.tags.map(t => ({ x: t.x, y: t.y, w: t.w, h: t.h, what: `tag ${t.text}` })), ...l.terminals.map(t => ({ x: t.x, y: t.y, w: t.w, h: t.h, what: `entry ${t.text}` }))];
}
export const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/* ---------- 상태 전이 ---------- */
export const STATE_FEW = '상태 전이 행이 2개보다 적음';
export const STATE_CAPTION = '이 부분의 C-STATE 행만 · 한 생명주기의 일부일 수 있음 · 배치 순서는 의미 없음';
export const STATE_TERMINAL = '이 상태에서 나가는 전이 행이 없음 (끝이라는 기록은 아님)';
export const NO_EVENT = '사건 미기재';
const START = /^(시작|초기|initial|start)/i;
const names = (rows: readonly FormState[]) => { const out: string[] = []; for (const r of rows) for (const n of [r.name, r.next]) if (n && n.trim() && !out.includes(n.trim())) out.push(n.trim()); return out; };
export function stateOffer(rows: readonly FormState[]): Offer {
  const ok = names(rows).length >= 2 && rows.filter(r => r.next && r.next.trim()).length >= 2;
  return { ok, reason: ok ? STATE_CAPTION : STATE_FEW };
}
export interface StateNode extends Rect { name: string; cx: number; cy: number; start: boolean; terminal: boolean; rows: number[] }
export interface StateEdge { from: string; to: string; label: string; rows: number[]; self: boolean; d: string; head: { x: number; y: number; angle: number }; pill: Pill }
export interface StateGraph { width: number; height: number; nodes: StateNode[]; edges: StateEdge[] }
const NODE_H = 36;
/** The states on a circle (an ellipse wide enough for the names), in the rows' first-appearance order, clockwise from the top; each
 * recorded transition a curved chord (A→B and B→A bend apart), a self-loop outside its state; the event on a pill at the curve. */
export function stateGraph(rows: readonly FormState[]): StateGraph {
  const list = names(rows), n = list.length;
  const ws = list.map(s => Math.min(220, Math.max(72, textWidth(s, 14) + 32)));
  const maxW = Math.max(72, ...ws);
  const selfAny = rows.some(r => r.next && r.next.trim() === r.name.trim());
  let rx = Math.max(130, maxW * 0.75 + n * 14), ry = Math.max(96, n * 26);
  const place = () => list.map((name, i) => { const a = -Math.PI / 2 + (2 * Math.PI * i) / n; return { name, ax: Math.cos(a), ay: Math.sin(a), w: ws[i]! }; });
  const clash = () => { const p = place(); for (let i = 0; i < n; i++) for (let k = i + 1; k < n; k++) { const A = p[i]!, B = p[k]!;
    if (Math.abs(A.ax * rx - B.ax * rx) < (A.w + B.w) / 2 + 28 && Math.abs(A.ay * ry - B.ay * ry) < NODE_H + 40) return true; } return false; };
  for (let g = 0; g < 40 && clash(); g++) { rx *= 1.1; ry *= 1.08; }
  rx = Math.round(rx); ry = Math.round(ry);
  const margin = 56 + (selfAny ? 40 : 0), cx = Math.round(rx + maxW / 2 + margin), cy = Math.round(ry + NODE_H / 2 + margin);
  const nodes: StateNode[] = place().map(p => { const x = Math.round(cx + p.ax * rx), y = Math.round(cy + p.ay * ry);
    return { name: p.name, cx: x, cy: y, x: x - p.w / 2, y: y - NODE_H / 2, w: p.w, h: NODE_H, start: false, terminal: false, rows: [] as number[] }; });
  const node = (s: string) => nodes.find(q => q.name === s.trim())!;
  rows.forEach((r, i) => { const a = node(r.name); if (!a) return; a.rows.push(i);
    if (START.test(r.name.trim()) || (r.event && START.test(r.event.trim()))) a.start = true; });
  for (const q of nodes) q.terminal = !rows.some(r => r.name.trim() === q.name && r.next && r.next.trim());
  // Edges, one per (from, to, event); repeats of the same three merge.
  const keyed: { from: string; to: string; label: string; rows: number[] }[] = [];
  rows.forEach((r, i) => { if (!r.next || !r.next.trim() || !r.name.trim()) return; const label = r.event?.trim() || NO_EVENT, from = r.name.trim(), to = r.next.trim();
    const e = keyed.find(x => x.from === from && x.to === to && x.label === label); if (e) e.rows.push(i); else keyed.push({ from, to, label, rows: [i] }); });
  const clip = (q: StateNode, ux: number, uy: number, pad: number) => { const hw = q.w / 2 + pad, hh = q.h / 2 + pad, t = Math.min(ux ? hw / Math.abs(ux) : Infinity, uy ? hh / Math.abs(uy) : Infinity); return { x: q.cx + ux * t, y: q.cy + uy * t }; };
  const unit = (x: number, y: number) => { const l = Math.hypot(x, y) || 1; return { x: x / l, y: y / l }; };
  const placed: Rect[] = nodes.map(q => ({ x: q.x - 4, y: q.y - 4, w: q.w + 8, h: q.h + 8 }));
  const edges: StateEdge[] = keyed.map(e => {
    const a = node(e.from), b = node(e.to), self = a === b, k = keyed.filter(x => x.from === e.from && x.to === e.to).indexOf(e);
    const lw = Math.min(170, textWidth(e.label, 12) + 18), lh = 20;
    let d: string, head: StateEdge['head'], mid: { x: number; y: number }, nrm: { x: number; y: number };
    if (self) {
      const u = unit(a.cx - cx, a.cy - cy), rot = (ang: number) => ({ x: u.x * Math.cos(ang) - u.y * Math.sin(ang), y: u.x * Math.sin(ang) + u.y * Math.cos(ang) });
      const r1 = rot(-0.45), r2 = rot(0.45), p1 = clip(a, r1.x, r1.y, 2), p2 = clip(a, r2.x, r2.y, 6), far = 52 + k * 18;
      const c1 = { x: p1.x + r1.x * far, y: p1.y + r1.y * far }, c2 = { x: p2.x + r2.x * far, y: p2.y + r2.y * far };
      d = `M${f(p1.x)},${f(p1.y)} C${f(c1.x)},${f(c1.y)} ${f(c2.x)},${f(c2.y)} ${f(p2.x)},${f(p2.y)}`;
      head = { x: p2.x, y: p2.y, angle: Math.atan2(p2.y - c2.y, p2.x - c2.x) * 180 / Math.PI };
      mid = { x: (p1.x + 3 * c1.x + 3 * c2.x + p2.x) / 8, y: (p1.y + 3 * c1.y + 3 * c2.y + p2.y) / 8 }; nrm = u;
    } else {
      const dx = b.cx - a.cx, dy = b.cy - a.cy, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
      const mutual = keyed.some(x => x.from === e.to && x.to === e.from), off = len * ((mutual ? 0.2 : 0.1) + 0.12 * k);
      const c = { x: (a.cx + b.cx) / 2 + nx * off, y: (a.cy + b.cy) / 2 + ny * off };
      const u1 = unit(c.x - a.cx, c.y - a.cy), u2 = unit(c.x - b.cx, c.y - b.cy), p1 = clip(a, u1.x, u1.y, 3), p2 = clip(b, u2.x, u2.y, 7);
      d = `M${f(p1.x)},${f(p1.y)} Q${f(c.x)},${f(c.y)} ${f(p2.x)},${f(p2.y)}`;
      head = { x: p2.x, y: p2.y, angle: Math.atan2(p2.y - c.y, p2.x - c.x) * 180 / Math.PI };
      mid = { x: 0.25 * p1.x + 0.5 * c.x + 0.25 * p2.x, y: 0.25 * p1.y + 0.5 * c.y + 0.25 * p2.y }; nrm = { x: nx, y: ny };
    }
    // The event's pill at the curve's middle, moved along the curve's normal until it covers no state and no other pill.
    let pill: Pill = { x: mid.x - lw / 2, y: mid.y - lh / 2, w: lw, h: lh, text: e.label, tip: '' };
    for (let t = 1; t <= 12 && placed.some(r => overlaps(r, pill)); t++) { const s = (t % 2 ? 1 : -1) * Math.ceil(t / 2) * 12; pill = { ...pill, x: mid.x - lw / 2 + nrm.x * s, y: mid.y - lh / 2 + nrm.y * s }; }
    pill = { ...pill, x: Math.round(pill.x), y: Math.round(pill.y), tip: `${e.from} → ${e.to} · 사건 ${e.label === NO_EVENT ? '미기재' : e.label}\nC-STATE 행 ${e.rows.map(i => i + 1).join(', ')}` };
    placed.push(pill);
    return { from: e.from, to: e.to, label: e.label, rows: e.rows, self, d, head: { x: f(head.x), y: f(head.y), angle: f(head.angle) }, pill };
  });
  // The frame holds every state and pill with a margin (a self-loop or a pushed pill may reach past the circle's margin).
  const all = [...nodes, ...edges.map(e => e.pill)];
  const minX = Math.min(0, ...all.map(r => r.x - 12)), minY = Math.min(0, ...all.map(r => r.y - 12));
  if (minX < 0 || minY < 0) { const sx = -minX, sy = -minY; for (const q of nodes) { q.x += sx; q.y += sy; q.cx += sx; q.cy += sy; }
    for (const e of edges) { e.pill.x += sx; e.pill.y += sy; e.head = { ...e.head, x: f(e.head.x + sx), y: f(e.head.y + sy) }; e.d = shiftPath(e.d, sx, sy); } }
  const width = Math.ceil(Math.max(2 * cx, ...all.map(r => r.x + r.w + 12))), height = Math.ceil(Math.max(2 * cy, ...all.map(r => r.y + r.h + 12)));
  return { width, height, nodes, edges };
}
const f = (v: number) => Math.round(v * 10) / 10;
function shiftPath(d: string, sx: number, sy: number): string { let i = 0; return d.replace(/-?\d+(?:\.\d+)?/g, m => String(f(Number(m) + (i++ % 2 ? sy : sx)))); }

/** Another part's C-STATE rows that use a state name this part uses: never merged, only said. */
export function statesElsewhere(own: readonly FormState[], others: readonly { part: string; name: string; rows: readonly FormState[] }[]): { part: string; name: string; shared: string[] }[] {
  const mine = new Set(names(own));
  return others.map(o => ({ part: o.part, name: o.name, shared: names(o.rows).filter(s => mine.has(s)) })).filter(o => o.shared.length);
}

/* ---------- choice and persistence ---------- */
export interface FormOffer { line: Offer; states: Offer; steps: number }
/** 노선 when it passes; else 상태 전이 for a part with no steps whose state rows pass; else 목록. */
export function defaultForm(o: FormOffer): FormId { return o.line.ok ? 'line' : !o.steps && o.states.ok ? 'states' : 'list'; }
export const formUsable = (id: FormId, o: FormOffer) => id === 'list' ? true : id === 'line' ? o.line.ok : o.states.ok;
/** The stored choice when it is a form and still usable, else the default. */
export function chooseForm(stored: unknown, o: FormOffer): FormId {
  return typeof stored === 'string' && (FORM_IDS as readonly string[]).includes(stored) && formUsable(stored as FormId, o) ? stored as FormId : defaultForm(o);
}
/** V: the next usable form after the current one. */
export function nextForm(current: FormId, o: FormOffer): FormId {
  const usable = FORM_IDS.filter(id => formUsable(id, o)), i = usable.indexOf(current);
  return usable[(i + 1) % usable.length] ?? 'list';
}
export const FORM_KEY = 'agentflow.studio.form.1';
const FORM_KEEP = 400;
interface StorageLike { getItem(k: string): string | null; setItem(k: string, v: string): void }
export const formKeyOf = (projectKey: string, partId: string) => `${projectKey}|${partId}`;
function formAll(storage: StorageLike): Record<string, unknown> {
  try { const v = JSON.parse(storage.getItem(FORM_KEY) ?? '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}; } catch { return {}; }
}
/** The form a person chose for one part, or null (unknown values read as nothing). */
export function readForm(storage: StorageLike, key: string): FormId | null {
  const v = Object.hasOwn(formAll(storage), key) ? formAll(storage)[key] : null;
  return typeof v === 'string' && (FORM_IDS as readonly string[]).includes(v) ? v as FormId : null;
}
/** Keeps one part's choice (null forgets it); the newest last, the oldest dropped past a bound. False when the write was refused. */
export function writeForm(storage: StorageLike, key: string, form: FormId | null): boolean {
  try {
    const all = formAll(storage); delete all[key];
    if (form && (FORM_IDS as readonly string[]).includes(form)) all[key] = form;
    const keys = Object.keys(all); for (const k of keys.slice(0, Math.max(0, keys.length - FORM_KEEP))) delete all[k];
    storage.setItem(FORM_KEY, JSON.stringify(all)); return true;
  } catch { return false; }
}

/* ---------- where the forms are ---------- */
export interface SpotInput { part: string; name: string; owner?: string | null; steps: readonly FormStep[]; states: readonly FormState[]; loops: number }
export interface FormSpot { part: string; name: string; forms: FormId[]; loops: number; states: number }
/** The parts with a line or a state graph, the loopiest first, then the most states, the most steps, the name. */
export function formSpots(parts: readonly SpotInput[]): FormSpot[] {
  return parts.flatMap(p => {
    const forms: FormId[] = [...(lineOffer(p.steps, p.owner ?? null).ok ? ['line' as const] : []), ...(stateOffer(p.states).ok ? ['states' as const] : [])];
    return forms.length ? [{ part: p.part, name: p.name, forms, loops: p.loops, states: names(p.states).length, n: p.steps.filter(s => !s.program).length }] : [];
  }).sort((a, b) => b.loops - a.loops || b.states - a.states || b.n - a.n || a.name.localeCompare(b.name) || a.part.localeCompare(b.part))
    .map(({ n: _n, ...s }) => s);
}
