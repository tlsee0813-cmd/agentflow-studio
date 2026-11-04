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
/** How a lens draws each channel's lines (an opacity from 1 down; 7.1: data 0.35 / reference 0.2 under 데이터 이동, data 0.35
 * under 시작과 반복, every line 0.3 under 상태와 공백) and which card families it lifts. Never a position, a size or a label place. */
export interface LensLook { lines: Record<Channel | 'related', number>; lift: readonly string[]; badges: boolean; rails: boolean; ops: boolean }
export function lensLook(id: LensId): LensLook {
  switch (id) {
    case 'data': return { lines: { data: 1, control: 0.35, uses: 0.2, related: 0.2 }, lift: ['store'], badges: true, rails: false, ops: false };
    case 'start': return { lines: { data: 0.35, control: 1, uses: 0.35, related: 0.2 }, lift: ['trigger'], badges: true, rails: true, ops: false };
    case 'state': return { lines: { data: 0.3, control: 0.3, uses: 0.3, related: 0.3 }, lift: [], badges: false, rails: false, ops: true };
    case 'scenario': return { lines: { data: 1, control: 1, uses: 1, related: 1 }, lift: [], badges: true, rails: false, ops: false };
    default: return { lines: { data: 1, control: 1, uses: 1, related: 1 }, lift: [], badges: true, rails: false, ops: false };
  }
}
/** The classes a lens puts on the map's space (styles.css reads them): its own, and one per lifted family. */
export const lensClasses = (id: LensId): string[] => [`lens-${id}`, ...lensLook(id).lift.map(f => `lens-lift-${f}`)];

/* ---------- the legend ---------- */
/** A drawn part as the legend reads it: its family, type word, short status (the overview's: '가동 보고', '운영 기록 없음', or a
 * lifecycle word), whether it repeats, and the gaps its card shows. */
export interface LensPart { id: string; family: string; type: string | null; short: string; loop: boolean; unlinked: boolean; unmapped: number }
/** A drawn line: its key, channel (null: a plain relation), whether it carries a badge, and its two ends. sum: a summary line of a
 * busy map (outlined with the item, never counted: its relations are counted on their own lines). */
export interface LensLine { key: string; channel: Channel | null; badge: boolean; from: string; to: string; sum?: boolean }
export type Sample = { kind: 'family'; family: string } | { kind: 'line'; channel: Channel | 'related' } | { kind: 'badge' } | { kind: 'mark'; text: string };
export interface LegendItem { id: string; label: string; count: number; sample: Sample; parts: string[]; lines: string[] }
const FAMILY_ORDER = ['participant', 'process', 'store', 'trigger', 'neutral'] as const;
const FAMILY_NAME: Record<string, string> = { participant: '참여자', process: '처리', store: '저장', trigger: '촉발·관문', neutral: '중립' };
const CHANNEL_NAME: Record<Channel | 'related', string> = { data: '데이터 선', control: '제어 선', uses: '참조 선', related: '관련 선' };
/** The order the overview's short statuses are listed in (state lens), the rest after them in their first order. */
const SHORT_ORDER = ['가동 보고', '작업 중 보고', '멈춤 보고', '대기 보고', '폐기', '설계만', '미구현', '운영 기록 충돌', '운영 기록 모름', '운영 기록 없음'];

/** The legend of a lens over what the map draws: items with a count above zero only (nothing the map does not have is listed),
 * each with the parts and lines it stands for. 시나리오 lists nothing here: its path and visits read in the scenario strip. */
export function legendItems(id: LensId, parts: readonly LensPart[], lines: readonly LensLine[]): LegendItem[] {
  const out: LegendItem[] = [];
  const add = (x: LegendItem) => { if (x.count > 0) out.push(x); };
  const byChannel = (c: Channel | 'related') => lines.filter(l => (l.channel ?? 'related') === c);
  const lineItem = (c: Channel | 'related'): LegendItem => { const ls = byChannel(c); return { id: `line-${c}`, label: CHANNEL_NAME[c], count: ls.filter(l => !l.sum).length, sample: { kind: 'line', channel: c }, parts: [], lines: ls.map(l => l.key) }; };
  const badgeItem = (): LegendItem => { const ls = lines.filter(l => l.badge); return { id: 'badge', label: '박자·조건 배지 (기록의 글자)', count: ls.filter(l => !l.sum).length, sample: { kind: 'badge' }, parts: [], lines: ls.map(l => l.key) }; };
  const famItem = (f: string): LegendItem => { const ps = parts.filter(p => p.family === f); return { id: `family-${f}`, label: FAMILY_NAME[f] ?? f, count: ps.length, sample: { kind: 'family', family: f }, parts: ps.map(p => p.id), lines: [] }; };
  switch (id) {
    case 'compose':
      for (const f of FAMILY_ORDER) add(famItem(f));
      break;
    case 'data': {
      add(lineItem('data'));
      add(famItem('store'));
      add(badgeItem());
      const um = parts.filter(p => p.unmapped > 0);
      add({ id: 'unmapped', label: '포트 대응 미기록', count: um.reduce((a, p) => a + p.unmapped, 0), sample: { kind: 'mark', text: '□' }, parts: um.map(p => p.id), lines: [] });
      break;
    }
    case 'start': {
      add(lineItem('control'));
      add(famItem('trigger'));
      const loops = parts.filter(p => p.loop);
      add({ id: 'loop', label: '반복이 기록된 부분', count: loops.length, sample: { kind: 'mark', text: '↻' }, parts: loops.map(p => p.id), lines: [] });
      add(badgeItem());
      break;
    }
    case 'state': {
      const words = [...new Set(parts.map(p => p.short))].sort((a, b) => (SHORT_ORDER.indexOf(a) + 1 || 99) - (SHORT_ORDER.indexOf(b) + 1 || 99));
      for (const w of words) { const ps = parts.filter(p => p.short === w); add({ id: `short-${w}`, label: w, count: ps.length, sample: { kind: 'mark', text: '·' }, parts: ps.map(p => p.id), lines: [] }); }
      const ul = parts.filter(p => p.unlinked);
      add({ id: 'unlinked', label: '항목 근거 미연결', count: ul.length, sample: { kind: 'mark', text: '?' }, parts: ul.map(p => p.id), lines: [] });
      const um = parts.filter(p => p.unmapped > 0);
      add({ id: 'unmapped', label: '포트 대응 미기록', count: um.reduce((a, p) => a + p.unmapped, 0), sample: { kind: 'mark', text: '□' }, parts: um.map(p => p.id), lines: [] });
      break;
    }
    case 'scenario': break;
  }
  return out;
}

/* ---------- the legend as a filter ---------- */
/** What the person did with the legend: one selected item (a sustained outline), and per item dim or hidden; solo is every other
 * item hidden. Kept per map as a view record (localStorage, wrapped by the caller), never as a layout. */
export interface LegendState { picked: string | null; mode: Record<string, 'dim' | 'hide'> }
export const NO_FILTER: LegendState = { picked: null, mode: {} };
export type LegendAction = { do: 'pick'; id: string } | { do: 'dim' | 'hide' | 'solo'; id: string } | { do: 'all' } | { do: 'clear' };
export function legendApply(s: LegendState, a: LegendAction, items: readonly LegendItem[]): LegendState {
  switch (a.do) {
    case 'pick': return { ...s, picked: s.picked === a.id ? null : a.id };
    case 'dim': case 'hide': { const mode = { ...s.mode }; if (mode[a.id] === a.do) delete mode[a.id]; else mode[a.id] = a.do; return { ...s, mode }; }
    case 'solo': return { picked: a.id, mode: Object.fromEntries(items.filter(i => i.id !== a.id).map(i => [i.id, 'hide' as const])) };
    case 'all': return { ...s, mode: {} };
    case 'clear': return NO_FILTER;
  }
}
/** The legend's head: '숨김 3 · 흐림 2' (what is hidden and dimmed now), '' when nothing is. */
export function legendHead(s: LegendState): string {
  const v = Object.values(s.mode), hid = v.filter(m => m === 'hide').length, dim = v.filter(m => m === 'dim').length;
  return [hid ? `숨김 ${hid}` : '', dim ? `흐림 ${dim}` : ''].filter(Boolean).join(' · ');
}
/** The parts and lines each class goes on: the picked item's targets, and those of the dimmed and the hidden items (an element
 * both hidden by one item and shown by none other stays hidden; hiding never moves anything). */
export function legendMarks(s: LegendState, items: readonly LegendItem[]): { picked: Set<string>; dim: Set<string>; hide: Set<string> } {
  const picked = new Set<string>(), dim = new Set<string>(), hide = new Set<string>();
  const of = (i: LegendItem) => [...i.parts, ...i.lines.map(k => `line:${k}`)];
  for (const i of items) {
    if (i.id === s.picked) for (const x of of(i)) picked.add(x);
    if (s.mode[i.id] === 'dim') for (const x of of(i)) dim.add(x);
    if (s.mode[i.id] === 'hide') for (const x of of(i)) hide.add(x);
  }
  return { picked, dim, hide };
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
    return { lens, legend: { picked: typeof r?.legend?.picked === 'string' ? r.legend.picked : null, mode } };
  } catch { return { lens: DEFAULT_LENS, legend: NO_FILTER }; }
}
export function writeLensRecord(raw: string | null, map: string, rec: LensRecord): string {
  let all: Record<string, LensRecord> = {};
  try { const p = raw ? JSON.parse(raw) : {}; if (p && typeof p === 'object' && !Array.isArray(p)) all = p; } catch { /* a broken record starts over */ }
  all[map] = rec; return JSON.stringify(all);
}
