/* Lenses and the legend (map design v3 7), the client's pure part. A lens is the question the map is read with now: 구성과 역할
 * (what it is made of, the default), 데이터 이동 (what goes where), 시작과 반복 (what starts what, and what repeats), 상태와 공백
 * (what was reported and what is not known), 시나리오 (what one case passes through). Named ViewLens: the code's own #lens and
 * renderLens are the reading pane.
 * - A lens only emphasises and dims (classes on the map): it never moves a card, never resizes one, never re-places a label, and
 *   never hides anything. Hiding is the legend's alone, and the legend's head counts what is hidden and dimmed.
 * - The legend is the lens's filter (OpenTTD smallmap): each item a sample, a name and a count, with the parts and lines it
 *   stands for. A click selects the item (a sustained outline on its parts and lines; again or Esc clears it); dim, hide, solo
 *   and show-all are the item's ⋯ menu; pointing at an item outlines its targets after ~150 ms, never blinking.
 * - Counts come from what the map draws and what the readings say; nothing absent from the records is counted (a part with no
 *   operations record counts as 운영 기록 없음, never as stopped). No DOM. */
import type { Channel } from '../shared/types.js';

export type LensId = 'compose' | 'data' | 'start' | 'state' | 'scenario';
export interface LensDef { id: LensId; name: string; short: string; asks: string; key: string }
export const LENSES: readonly LensDef[] = [
  { id: 'compose', name: '구성과 역할', short: '구성', asks: '무엇으로 이루어졌나', key: 'Alt+1' },
  { id: 'data', name: '데이터 이동', short: '데이터', asks: '무엇이 어디서 와서 어디로 가나', key: 'Alt+2' },
  { id: 'start', name: '시작과 반복', short: '시작·반복', asks: '무엇이 언제 작동시키나', key: 'Alt+3' },
  { id: 'state', name: '상태와 공백', short: '상태·공백', asks: '무엇이 보고됐고 무엇을 모르나', key: 'Alt+4' },
  { id: 'scenario', name: '시나리오', short: '시나리오', asks: '이 경우 무엇을 거치나', key: 'Alt+5' }];
export const DEFAULT_LENS: LensId = 'compose';
export const lensDef = (id: LensId): LensDef => LENSES.find(l => l.id === id)!;
/** The next or previous lens (`[` / `]`), skipping one that cannot be read now (시나리오 without a scenario record). */
export function stepLens(cur: LensId, dir: 1 | -1, usable: (id: LensId) => boolean = () => true): LensId {
  const i = LENSES.findIndex(l => l.id === cur);
  for (let k = 1; k <= LENSES.length; k++) { const n = LENSES[(i + dir * k + LENSES.length * 2) % LENSES.length]!; if (usable(n.id)) return n.id; }
  return cur;
}

/* ---------- what a lens does to the map (classes only) ---------- */
/** How a lens draws each channel's lines and which card families it lifts. Never a position, a size or a label place.
 * Beauty v2 B5 (the binding lens contract): a lens has a foreground and a background, and the background stays visible: a
 * channel the lens is about is drawn whole (1), every other line in the background (BG_LINE: its place, no longer an opacity — the craft spec
 * draws the background in a solid quieter tone, styles.css, never faded). 구성: no channel is the subject (the
 * parts, their containment and the selected part's own lines are); 데이터: data lines; 시작·반복: control lines; 상태·공백: no line
 * (the recorded states are); 시나리오: no channel (the recorded path is, drawn on top). */
export const BG_LINE = 0.55;
export interface LensLook { lines: Record<Channel | 'related', number>; lift: readonly string[]; badges: boolean; rails: boolean; ops: boolean }
export function lensLook(id: LensId): LensLook {
  switch (id) {
    case 'data': return { lines: { data: 1, control: BG_LINE, uses: BG_LINE, related: BG_LINE }, lift: ['store'], badges: true, rails: false, ops: false };
    case 'start': return { lines: { data: BG_LINE, control: 1, uses: BG_LINE, related: BG_LINE }, lift: ['trigger'], badges: true, rails: true, ops: false };
    case 'state': return { lines: { data: BG_LINE, control: BG_LINE, uses: BG_LINE, related: BG_LINE }, lift: [], badges: false, rails: false, ops: true };
    case 'scenario': return { lines: { data: BG_LINE, control: BG_LINE, uses: BG_LINE, related: BG_LINE }, lift: [], badges: true, rails: false, ops: false };
    default: return { lines: { data: BG_LINE, control: BG_LINE, uses: BG_LINE, related: BG_LINE }, lift: [], badges: true, rails: false, ops: false };
  }
}
/** Beauty v2 B5: whether a drawn line is in the lens's foreground (drawn 2.25px and whole) or its background (1.15px, BG_LINE).
 * 구성: the selected part's own lines; 데이터: data lines; 시작·반복: control lines; 상태·공백: none (ordinary relations are its
 * background); 시나리오: the recorded path's lines. A selected relation and the selected part's lines are always foreground
 * (selected: the selected part's id; path: the scenario path's line keys; picked: line keys the selection lifts). */
export function lensLineFg(id: LensId, l: Pick<LensLine, 'key' | 'channel' | 'from' | 'to'>, ctx: { selected?: string | null; path?: ReadonlySet<string>; picked?: ReadonlySet<string> } = {}): boolean {
  if (ctx.picked?.has(l.key) || (!!ctx.selected && (l.from === ctx.selected || l.to === ctx.selected))) return true;
  switch (id) {
    case 'data': return l.channel === 'data';
    case 'start': return l.channel === 'control';
    case 'scenario': return !!ctx.path?.has(l.key);
    default: return false;
  }
}
/** The cards a lens is not about (S8, critique 9: switching lens barely changed the map): they step back (styles.css .lens-off,
 * never hidden, never moved; a selected card and its partners stay). 데이터 이동 is about the ends of data lines and the stores; 시작과
 * 반복 about the ends of control lines, triggers and gates, and the parts with a recorded loop. 구성과 역할, 상태와 공백 and 시나리오
 * are about every card (시나리오 marks its own path). A lens that is about none of the drawn cards steps none back: the map never
 * goes blank for want of a topic. */
export function lensOffTopic(id: LensId, parts: readonly (Pick<LensPart, 'id' | 'family' | 'loop'> & Partial<Pick<LensPart, 'short' | 'unlinked'>>)[], lines: readonly Pick<LensLine, 'channel' | 'from' | 'to'>[]): Set<string> {
  // Polish round fixes 2: 상태와 공백 is about the parts whose state the record says (a recorded state, its 「모름」 included); the rest
  // step back, so the lens reads at every zoom (at the whole-map view its words are too small to see).
  if (id === 'state') { const off = new Set(parts.filter(p => p.short === NO_RECORD).map(p => p.id)); return off.size >= parts.length ? new Set() : off; }
  if (id !== 'data' && id !== 'start') return new Set();
  const want: Channel = id === 'data' ? 'data' : 'control', ends = new Set<string>();
  for (const l of lines) if (l.channel === want) { ends.add(l.from); ends.add(l.to); }
  const about = (p: Pick<LensPart, 'id' | 'family' | 'loop'>) => ends.has(p.id) || (id === 'data' ? p.family === 'store' : p.family === 'trigger' || p.loop);
  const off = new Set(parts.filter(p => !about(p)).map(p => p.id));
  return off.size >= parts.length ? new Set() : off;
}
/** The classes a lens puts on the map's space (styles.css reads them): its own, and one per lifted family. */
export const lensClasses = (id: LensId): string[] => [`lens-${id}`, ...lensLook(id).lift.map(f => `lens-lift-${f}`)];

/* ---------- the legend ---------- */
/** A drawn part as the legend reads it: its family, type word, short status (the overview's: '가동 보고', '운영 기록 없음', or a
 * lifecycle word), whether it repeats, and the gaps its card shows. */
export interface LensPart { id: string; family: string; type: string | null; short: string; loop: boolean; unlinked: boolean; unmapped: number }
/** A drawn line: its key, channel (null: a plain relation), whether it carries a badge, and its two ends. sum: a summary line of a
 * busy map (outlined with the item, never counted: its relations are counted on their own lines). */
export interface LensLine { key: string; channel: Channel | null; badge: boolean; from: string; to: string; sum?: boolean; cond?: boolean }
export type Sample = { kind: 'family'; family: string } | { kind: 'line'; channel: Channel | 'related' } | { kind: 'badge' } | { kind: 'mark'; text: string };
export interface LegendItem { id: string; label: string; count: number; sample: Sample; parts: string[]; lines: string[] }
const FAMILY_ORDER = ['participant', 'process', 'store', 'trigger', 'neutral'] as const;
const FAMILY_NAME: Record<string, string> = { participant: '참여자', process: '처리', store: '저장', trigger: '촉발·관문', neutral: '중립' };
const CHANNEL_NAME: Record<Channel | 'related', string> = { data: '데이터 선', control: '제어 선', uses: '참조 선', related: '관련 선' };
/** The order the overview's short statuses are listed in (state lens), the rest after them in their first order. */
const SHORT_ORDER = ['가동 보고', '작업 중 보고', '멈춤 보고', '대기 보고', '폐기', '설계만', '미구현', '운영 기록 충돌', '상태 미상(기록)', '운영 기록 없음'];
/** Restore: the 상태와 공백 legend says in plain words what its faded cards are, so fading never reads as 멈춤. */
export const STATE_FADE_NOTE = '흐린 카드: 운영 상태를 말한 기록이 없음';
/** The faded-card line under the 상태와 공백 legend (its count, and that it is not 멈춤); null under the other lenses or when no card
 * steps back. */
export function lensFadeNote(id: LensId, faded: number): { text: string; tip: string } | null {
  if (id !== 'state' || faded <= 0) return null;
  return { text: `${STATE_FADE_NOTE} · ${faded}개`, tip: `${STATE_FADE_NOTE} (멈춤이라는 뜻이 아님) · 카드를 누르면 사이드 창에 「운영 기록 없음」` };
}
/** A part no record gave an operations state (never counted in the 상태와 공백 legend: the lens is about what was said). */
export const NO_RECORD = '운영 기록 없음';
/** F8 Q4: the legend's word for a condition's mark (its sample is the ◇ itself). */
export const COND_ITEM = '조건 보기';
/** Polish round fixes 2: the legend's words for a status, in a reader's terms (the record said 「모름」; nothing self-contradicting). */
const SHORT_LABEL: Readonly<Record<string, string>> = { '상태 미상(기록)': '기록에 「모름」으로 적힘' };
/** The corner mark the 상태와 공백 lens puts on a part whose state the record says: its state's mark. Something to check (unlinked
 * evidence) is no mark of its own: on a real map it is most cards, so a 「?」 on each read as noise; its legend item outlines them. */
export function stateMark(p: Pick<LensPart, 'short'>): string | null {
  return p.short !== NO_RECORD ? SHORT_MARK[p.short] ?? '·' : null;
}
/** Each short status its own mark (review: the record's 「모름」 and no record never share a glyph); the dots' shapes for their states. */
const SHORT_MARK: Readonly<Record<string, string>> = { '가동 보고': '●', '멈춤 보고': '■', '대기 보고': '○', '운영 기록 충돌': '◇', '상태 미상(기록)': '…', '운영 기록 없음': '–' };

/** The legend of a lens over what the map draws: items with a count above zero only (nothing the map does not have is listed),
 * each with the parts and lines it stands for. 시나리오 lists nothing here: its path and visits read in the scenario strip. */
export function legendItems(id: LensId, parts: readonly LensPart[], lines: readonly LensLine[]): LegendItem[] {
  const out: LegendItem[] = [];
  const add = (x: LegendItem) => { if (x.count > 0) out.push(x); };
  const byChannel = (c: Channel | 'related') => lines.filter(l => (l.channel ?? 'related') === c);
  const lineItem = (c: Channel | 'related'): LegendItem => { const ls = byChannel(c); return { id: `line-${c}`, label: CHANNEL_NAME[c], count: ls.filter(l => !l.sum).length, sample: { kind: 'line', channel: c }, parts: [], lines: ls.map(l => l.key) }; };
  const badgeItem = (): LegendItem => { const ls = lines.filter(l => l.badge); return { id: 'badge', label: '박자·조건 배지 (기록의 글자)', count: ls.filter(l => !l.sum).length, sample: { kind: 'badge' }, parts: [], lines: ls.map(l => l.key) }; };
  // F8 Q4: a condition folded to its ◇ opens from the map; the legend names the mark (「◇ 조건 보기」) and counts the lines that carry one.
  const condItem = (): LegendItem => { const ls = lines.filter(l => l.cond && !l.sum); return { id: 'cond', label: COND_ITEM, count: ls.length, sample: { kind: 'mark', text: '◇' }, parts: [], lines: ls.map(l => l.key) }; };
  const famItem = (f: string): LegendItem => { const ps = parts.filter(p => p.family === f); return { id: `family-${f}`, label: FAMILY_NAME[f] ?? f, count: ps.length, sample: { kind: 'family', family: f }, parts: ps.map(p => p.id), lines: [] }; };
  switch (id) {
    case 'compose':
      for (const f of FAMILY_ORDER) add(famItem(f));
      add(condItem());
      break;
    case 'data': {
      add(lineItem('data'));
      add(famItem('store'));
      add(condItem());
      add(badgeItem());
      const um = parts.filter(p => p.unmapped > 0);
      add({ id: 'unmapped', label: '포트 대응 미기록', count: um.reduce((a, p) => a + p.unmapped, 0), sample: { kind: 'mark', text: '□' }, parts: um.map(p => p.id), lines: [] });
      break;
    }
    case 'start': {
      add(lineItem('control'));
      add(famItem('trigger'));
      add(condItem());
      const loops = parts.filter(p => p.loop);
      add({ id: 'loop', label: '반복이 기록된 부분', count: loops.length, sample: { kind: 'mark', text: '↻' }, parts: loops.map(p => p.id), lines: [] });
      add(badgeItem());
      break;
    }
    case 'state': {
      const words = [...new Set(parts.map(p => p.short))].sort((a, b) => (SHORT_ORDER.indexOf(a) + 1 || 99) - (SHORT_ORDER.indexOf(b) + 1 || 99));
      // Polish round fixes 2: what was recorded first, each state by its words; a part with no record is not listed (it steps back on
      // the map), and the author's 포트 대응 미기록 belongs to the 데이터 이동 lens, not this one.
      for (const w of words.filter(x => x !== NO_RECORD)) { const ps = parts.filter(p => p.short === w); add({ id: `short-${w}`, label: SHORT_LABEL[w] ?? w, count: ps.length, sample: { kind: 'mark', text: SHORT_MARK[w] ?? '·' }, parts: ps.map(p => p.id), lines: [] }); }
      const ul = parts.filter(p => p.unlinked);
      add({ id: 'unlinked', label: '확인이 필요한 부분', count: ul.length, sample: { kind: 'mark', text: '?' }, parts: ul.map(p => p.id), lines: [] });
      break;
    }
    case 'scenario': break;
  }
  return out;
}

/* ---------- the legend as a filter ---------- */
/** What the person did with the legend: one selected item (a sustained outline, the rest of the map stepping back), per item dim or
 * hidden, and solo: that item alone (everything it does not stand for hidden, the parts its lines join kept for context). Kept per
 * map as a view record (localStorage, wrapped by the caller), never as a layout. */
export interface LegendState { picked: string | null; mode: Record<string, 'dim' | 'hide'>; solo?: string | null }
export const NO_FILTER: LegendState = { picked: null, mode: {}, solo: null };
export type LegendAction = { do: 'pick'; id: string } | { do: 'dim' | 'hide' | 'solo'; id: string } | { do: 'all' } | { do: 'clear' };
export function legendApply(s: LegendState, a: LegendAction, _items: readonly LegendItem[] = []): LegendState {
  const solo = s.solo ?? null;
  switch (a.do) {
    case 'pick': return { ...s, solo, picked: s.picked === a.id ? null : a.id };
    case 'dim': case 'hide': { const mode = { ...s.mode }; if (mode[a.id] === a.do) delete mode[a.id]; else mode[a.id] = a.do; return { ...s, solo: solo === a.id ? null : solo, mode }; }
    // Solo again: everything back. The soloed item is the picked one too (its targets outlined), and its own dim or hide is lifted.
    case 'solo': { if (solo === a.id) return { ...s, solo: null };
      const mode = { ...s.mode }; delete mode[a.id]; return { picked: a.id, mode, solo: a.id }; }
    case 'all': return { ...s, mode: {}, solo: null };
    case 'clear': return NO_FILTER;
  }
}
/** The legend's head: '그것만 · 저장 · 숨김 3 · 흐림 2' (what is shown alone, hidden and dimmed now), '' when nothing is. */
export function legendHead(s: LegendState, items: readonly LegendItem[] = []): string {
  const v = Object.values(s.mode), hid = v.filter(m => m === 'hide').length, dim = v.filter(m => m === 'dim').length;
  const solo = s.solo ? `그것만 · ${items.find(i => i.id === s.solo)?.label ?? s.solo}` : '';
  return [solo, hid ? `숨김 ${hid}` : '', dim ? `흐림 ${dim}` : ''].filter(Boolean).join(' · ');
}
/** Everything the map draws that the legend can mark: its parts (ids) and its lines (with their ends). Absent: what the items
 * stand for, together. */
export interface LegendWorld { parts: readonly string[]; lines: readonly { key: string; from: string; to: string }[] }
/** The parts and lines each class goes on:
 * - picked: the picked item's targets (an outline), and fade: everything else the map draws (stepping back, never hidden), so a
 *   plain click reads at once; the ends of the picked lines stay out of the fade;
 * - dim and hide: the dimmed and the hidden items' targets; an element a picked or soloed item stands for is never dimmed or hidden
 *   by another item;
 * - solo: everything the soloed item does not stand for is hidden (a part no item lists included); a soloed line keeps the two
 *   parts it joins (as context, in dim), a soloed family keeps the lines between its own parts.
 * Hiding never moves anything. */
export function legendMarks(s: LegendState, items: readonly LegendItem[], world?: LegendWorld): { picked: Set<string>; dim: Set<string>; hide: Set<string>; fade: Set<string> } {
  const picked = new Set<string>(), dim = new Set<string>(), hide = new Set<string>(), fade = new Set<string>();
  const of = (i: LegendItem) => [...i.parts, ...i.lines.map(k => `line:${k}`)];
  const lineKeys = new Map<string, { from: string; to: string }>();
  for (const l of world?.lines ?? []) lineKeys.set(l.key, l);
  const allParts = new Set(world ? world.parts : items.flatMap(i => i.parts));
  const allLines = new Set(world ? world.lines.map(l => l.key) : items.flatMap(i => i.lines));
  const universe = [...allParts, ...[...allLines].map(k => `line:${k}`)];
  // An item's targets with the parts its lines join (a line never floats without its ends).
  const reach = (i: LegendItem) => { const own = new Set(of(i)), ends = new Set<string>();
    for (const k of i.lines) { const l = lineKeys.get(k); if (l) for (const e of [l.from, l.to]) if (!own.has(e)) ends.add(e); }
    if (i.parts.length) { const ps = new Set(i.parts); for (const [k, l] of lineKeys) if (ps.has(l.from) && ps.has(l.to)) own.add(`line:${k}`); }
    return { own, ends }; };
  const keep = new Set<string>();
  for (const i of items) {
    if (i.id === s.picked) { const r = reach(i); for (const x of of(i)) picked.add(x); for (const x of [...r.own, ...r.ends]) keep.add(x); }
    if (s.mode[i.id] === 'dim') for (const x of of(i)) dim.add(x);
    if (s.mode[i.id] === 'hide') for (const x of of(i)) hide.add(x);
  }
  const soloItem = s.solo ? items.find(i => i.id === s.solo) : undefined;
  if (soloItem) {
    const r = reach(soloItem);
    for (const x of universe) if (!r.own.has(x) && !r.ends.has(x)) hide.add(x);
    for (const x of r.ends) dim.add(x);
    for (const x of r.own) { hide.delete(x); dim.delete(x); keep.add(x); }
    for (const x of r.ends) hide.delete(x);
  } else if (picked.size) for (const x of universe) if (!keep.has(x)) fade.add(x);
  for (const x of picked) { hide.delete(x); dim.delete(x); fade.delete(x); }
  for (const x of hide) fade.delete(x);
  return { picked, dim, hide, fade };
}
/** The legend folded to one chip (it starts so when it would cover cards): the lens's short name and its first items with their
 * counts, then how many more ('구성 · 참여자 4 · 처리 1 · +2'). */
export function legendChip(id: LensId, items: readonly LegendItem[], max = 2): string {
  const shown = items.slice(0, max).map(i => `${i.label} ${i.count}`), more = items.length - shown.length;
  return [lensDef(id).short, ...shown, ...(more > 0 ? [`외 ${more}개`] : [])].join(' · ');
}
/** Whether a box (the legend opened) would cover any of the given boxes (the cards on screen), with a few pixels of margin. */
export function covers(box: { x: number; y: number; w: number; h: number }, boxes: readonly { x: number; y: number; w: number; h: number }[], m = 4): boolean {
  return boxes.some(b => box.x < b.x + b.w + m && b.x < box.x + box.w + m && box.y < b.y + b.h + m && b.y < box.y + box.h + m);
}

/* ---------- keys (7.3) ---------- */
/** The lens a key picks: Alt+1 … Alt+5, '[' and ']' (previous, next); null for any other key. */
export function lensKey(e: { key: string; altKey: boolean; ctrlKey?: boolean; metaKey?: boolean }, cur: LensId, usable?: (id: LensId) => boolean): LensId | null {
  if (e.ctrlKey || e.metaKey) return null;
  if (e.altKey && /^[1-5]$/.test(e.key)) { const l = LENSES[Number(e.key) - 1]!.id; return !usable || usable(l) ? l : null; }
  if (!e.altKey && e.key === '[') return stepLens(cur, -1, usable);
  if (!e.altKey && e.key === ']') return stepLens(cur, 1, usable);
  return null;
}
/** The view record's key and its stored form (per map: the lens and the legend state). */
export const LENS_KEY = 'agentflow.studio.lens.1';
export interface LensRecord { lens: LensId; legend: LegendState }
export function readLensRecord(raw: string | null, map: string): LensRecord {
  try {
    const all = raw ? JSON.parse(raw) : {}, r = all?.[map];
    const lens: LensId = LENSES.some(l => l.id === r?.lens) ? r.lens : DEFAULT_LENS;
    const mode: Record<string, 'dim' | 'hide'> = {};
    for (const [k, v] of Object.entries(r?.legend?.mode ?? {})) if (v === 'dim' || v === 'hide') mode[k] = v;
    const solo = typeof r?.legend?.solo === 'string' ? r.legend.solo : null;
    return { lens, legend: { picked: typeof r?.legend?.picked === 'string' ? r.legend.picked : null, mode, solo } };
  } catch { return { lens: DEFAULT_LENS, legend: NO_FILTER }; }
}
export function writeLensRecord(raw: string | null, map: string, rec: LensRecord): string {
  let all: Record<string, LensRecord> = {};
  try { const p = raw ? JSON.parse(raw) : {}; if (p && typeof p === 'object' && !Array.isArray(p)) all = p; } catch { /* a broken record starts over */ }
  all[map] = rec; return JSON.stringify(all);
}
