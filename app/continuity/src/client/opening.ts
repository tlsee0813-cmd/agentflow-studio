/* v13 (spec 1): the opening. A map opened for the first time, or for the first time after a new map version arrived, is not shown finished:
 * it comes into being from the record, then lands and is quiet.
 * - Two or more map versions (growth): the recorded versions replayed in place, at the layout's places. One beat per shown version: the parts
 *   that version has appear at their places, a name the version had reads in place until the version that renamed it, a part retired with a
 *   recorded successor stands as a dashed outline at its successor's place and dissolves into it on the succession version, and a part with
 *   no place on the map now (retired without successor, folded away) is not drawn and counted in the caption. The version's relations draw
 *   in after its parts. Every state shown is a recorded version's whole state (never a state between two); when the versions are more than
 *   the time holds, some are passed over, never blended. The strip at the bottom says which version is shown.
 * - One version: the recorded main flow (먼저 볼 연결's chain) appears step by step in its own order, then everything else at once.
 *   With no recorded chain, everything fades in together.
 * - Landing: the camera settles to the fit (1.03 → 1), the summary sentence types in, and the map is quiet.
 * Any key, press, wheel or touch ends it at once; reduced motion never plays it. Seen versions are remembered per project in this browser
 * (try/catch: without storage it plays each time a map is opened fresh). 「다시 보기」 in the tools plays it again.
 * Motion only from the record (the versions, the recorded chain) and the person's hand; no order, importance or group is made up. */

import { easeInOut } from './flight.js';

/* ---------- timing ---------- */
/** From the first frame to a quiet map, at most (the versions' rebuild included; a beat never goes under BEAT_MIN_MS). */
export const OPEN_TOTAL_MS = 4500;
export const OPEN_START_MS = 120, BEAT_MIN_MS = 450, BEAT_MAX_MS = 600, GROWTH_MAX_MS = 3300;
export const STEP_MS = 250, CHAIN_MAX_MS = 2200, REST_MS = 500, FADE_MS = 600, LINE_MS = 250, SETTLE_MS = 350, TYPE_MAX_MS = 600;
/** v13 fix 1: the typing's share of the budget (the sentence types at 8 ms a character up to this; TYPE_MAX_MS stays the spec's bound). */
export const TYPE_PLAN_MS = 450, TYPE_CHAR_MS = 8;
/** v13 fix 1 (review of v13: lines drawn while their cards were still fading in ended in the air): a version's or a step's lines start once
 * its cards have come in (the cards' fade), never sooner. */
export const CARD_IN_MS = 200;
/** v13 fix 1 (review of v13: the opening told an order the record never stated): the chain an opening walks is the one 보기 calls a flow —
 * a recorded order (map-forms recordedChain: a scenario, the summary sentence read as 「기록이 설명한 흐름」, an ordered 첫 구조 줄) of this
 * many steps or more on the cards drawn (map-forms FLOW_OFFER_STEPS); anything less fades in together, with no caption. */
export const CHAIN_MIN_STEPS = 3;
/** The settle's start: the camera this much closer, coming back to the fit. */
export const SETTLE_FROM = 1.03;
/** When the map's own frame shows only part of it (a large map in a small window opens on its first flow), it grows in the whole view and
 * the camera then glides into that frame as it lands (this long, the settle with it). */
export const LAND_GLIDE_MS = 650;
/** The last beat when the final version changes nothing drawn: the tick moves on to it, briefly. */
export const LAST_TICK_MS = 260;
/** The outline around a successor that is already drawn: the earlier part it will take over from. */
export const GHOST_WORD = '이어받기 전 · ';
export const CHAIN_CAPTION = '기록이 말한 흐름 순서';
export const REPLAY_WORD = '다시 보기', REPLAY_TIP = '지도가 기록에서 생겨나는 모습을 다시 보기 (아무 키나 누르면 끝)';
export const versionCaption = (n: number, parts: number, unplaced: number): string => `기록을 읽은 판 v${n} · 부품 ${parts}${unplaced ? ` · 지금 지도에 자리가 없는 부품 ${unplaced}` : ''}`;
export const SEEN_KEY = 'af.opening.seen.v1';

/* ---------- the plan (pure) ---------- */
export interface OpeningBox { id: string; container: string | null }
export interface OpeningEdge { key: string; ids: readonly string[]; from?: string; to?: string }
export interface OpeningVersion { n: number; parts: readonly { id: string; name: string }[]; rels: readonly string[];
  /** Retired between the version before and this one (changeSet's 은퇴), with the successor the record names when it is on this version. */
  retired: readonly { part: string; name: string; successor: string | null }[] }
export interface OpeningInput {
  boxes: readonly OpeningBox[]; edges: readonly OpeningEdge[];
  /** The drawn box a part stands in (itself, else its nearest drawn container); null: no place on the map now. */
  rep(part: string): string | null;
  /** The live name of each part drawn as its own box. */
  names: ReadonlyMap<string, string>;
  versions: readonly OpeningVersion[];
  /** The recorded chain's steps as drawn boxes (null: none), and its relations. */
  chain: readonly (readonly string[])[] | null; chainRels: readonly string[];
}
export interface Ghost { box: string; part: string; name: string }
export interface Beat {
  at: number; ms: number;
  /** v13 fix 1: boxes and lines that come in receded on this beat (the rest after a recorded chain): they reach full strength as it lands. */
  dim?: string[]; dimLines?: string[];
  /** Boxes seen after this beat; their shown names where a version's name differs from the live one; the outlines standing; the lines seen. */
  show: string[]; names: [string, string][]; ghosts: Ghost[]; lines: string[];
  version: number | null; caption: string | null;
}
export interface OpeningPlan { kind: 'growth' | 'chain' | 'fade'; beats: Beat[]; versions: number[]; end: number }

const norm = (t: string) => t.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
/** A box with every container it sits in (a frame is seen with anything inside it). */
function withContainers(ids: Iterable<string>, boxes: ReadonlyMap<string, OpeningBox>): Set<string> {
  const out = new Set<string>();
  for (const id of ids) for (let c: string | null = id, g = 0; c && boxes.has(c) && g < 64; c = boxes.get(c)!.container, g++) out.add(c);
  return out;
}
interface VState { n: number; show: Set<string>; names: Map<string, string>; ghosts: Ghost[]; lines: Set<string>; parts: number; unplaced: number }
const sameState = (a: VState, b: VState) => a.show.size === b.show.size && [...a.show].every(x => b.show.has(x)) && a.lines.size === b.lines.size && [...a.lines].every(x => b.lines.has(x))
  && a.names.size === b.names.size && [...a.names].every(([k, v]) => b.names.get(k) === v) && a.ghosts.map(g => `${g.box}|${g.part}`).join() === b.ghosts.map(g => `${g.box}|${g.part}`).join();
/** How much a version changes what is drawn (to choose which to show when there are more than the time holds): parts that come or go and
 * names and outlines count most, lines less. */
function weight(a: VState | null, b: VState): number {
  if (!a) return 1e6;
  const diff = <T>(x: Set<T>, y: Set<T>) => [...y].filter(v => !x.has(v)).length + [...x].filter(v => !y.has(v)).length;
  const nm = new Set([...a.names.keys(), ...b.names.keys()]); let names = 0; for (const k of nm) if (a.names.get(k) !== b.names.get(k)) names++;
  const gk = (s: VState) => new Set(s.ghosts.map(g => `${g.box}|${g.part}`));
  return diff(a.show, b.show) * 2 + names * 4 + diff(gk(a), gk(b)) * 4 + diff(a.lines, b.lines) * 0.5;
}
/** Each version's drawn state. */
export function versionStates(inp: OpeningInput): VState[] {
  const boxes = new Map(inp.boxes.map(b => [b.id, b])), all = inp.versions, last = all.at(-1);
  // Retirements with a successor: the outline stands at the successor's place while its predecessor is on a version, until the one that retired it.
  const succ = all.flatMap(v => v.retired.filter(r => r.successor).map(r => ({ part: r.part, name: r.name, successor: r.successor!, at: v.n })));
  const firstLine = new Map<string, number>();
  for (const v of all) { const rs = new Set(v.rels); for (const e of inp.edges) if (!firstLine.has(e.key) && e.ids.some(id => rs.has(id))) firstLine.set(e.key, v.n); }
  return all.map(v => {
    const reps: string[] = []; let unplaced = 0; const names = new Map<string, string>();
    for (const p of v.parts) {
      const r = inp.rep(p.id);
      if (!r) { if (!succ.some(s => s.part === p.id && s.at > v.n && inp.rep(s.successor))) unplaced++; continue; }
      reps.push(r);
      if (r === p.id) { const live = inp.names.get(r); if (live !== undefined && norm(live) !== norm(p.name)) names.set(r, p.name); }
    }
    const show = withContainers(reps, boxes);
    const ghosts: Ghost[] = [];
    for (const s of succ) if (s.at > v.n && v.parts.some(p => p.id === s.part)) { const box = inp.rep(s.successor); if (box) ghosts.push({ box, part: s.part, name: v.parts.find(p => p.id === s.part)!.name }); }
    // A line from the version its relation was first read on, and only with both of its cards there.
    const lines = new Set(inp.edges.filter(e => { const n = firstLine.get(e.key); return n !== undefined && n <= v.n && (!e.from || show.has(e.from)) && (!e.to || show.has(e.to)); }).map(e => e.key));
    // The last version is the live map: everything drawn now is on it (a part or relation the person made has no reading behind it).
    if (v === last) { for (const b of inp.boxes) show.add(b.id); for (const e of inp.edges) lines.add(e.key); names.clear(); }
    return { n: v.n, show, names, ghosts, lines, parts: v.parts.length, unplaced };
  });
}
/** The growth plan: the versions that change what is drawn (the first and the last always), as many as GROWTH_MAX_MS holds at BEAT_MIN_MS
 * or more each, chosen by how much they change when there are more. */
export function growthPlan(inp: OpeningInput, budget = OPEN_TOTAL_MS): OpeningPlan {
  const st = versionStates(inp), versions = st.map(s => s.n);
  const most = Math.min(GROWTH_MAX_MS, budget - OPEN_START_MS - SETTLE_MS - TYPE_PLAN_MS - 80);
  const changed: VState[] = []; for (const s of st) if (!changed.length || !sameState(changed.at(-1)!, s)) changed.push(s);
  const last = st.at(-1)!, lastSame = changed.at(-1) !== last;
  const room = Math.max(2, Math.floor((most - (lastSame ? LAST_TICK_MS : 0)) / BEAT_MIN_MS));
  let keep = changed;
  if (keep.length > room) {
    const w = keep.map((s, i) => ({ s, i, w: i === 0 || i === keep.length - 1 ? Infinity : weight(keep[i - 1]!, s) }));
    const chosen = new Set(w.sort((a, b) => b.w - a.w || a.i - b.i).slice(0, room).map(x => x.i));
    keep = keep.filter((_, i) => chosen.has(i));
  }
  const ms = Math.round(Math.min(BEAT_MAX_MS, Math.max(BEAT_MIN_MS, (most - (lastSame ? LAST_TICK_MS : 0)) / keep.length)));
  const beats: Beat[] = []; let at = OPEN_START_MS;
  const beatOf = (s: VState, len: number): Beat => ({ at, ms: len, show: [...s.show], names: [...s.names], ghosts: s.ghosts, lines: [...s.lines], version: s.n, caption: versionCaption(s.n, s.parts, s.unplaced) });
  for (const s of keep) { beats.push(beatOf(s, ms)); at += ms; }
  if (lastSame) { beats.push(beatOf(last, LAST_TICK_MS)); at += LAST_TICK_MS; }
  return { kind: 'growth', beats, versions, end: at };
}
/** One version with a recorded chain: its steps one by one (STEP_MS each, CHAIN_MAX_MS at most), each step's chain lines once both ends
 * are there, then the rest together (REST_MS). */
export function chainPlan(inp: OpeningInput): OpeningPlan | null {
  const boxes = new Map(inp.boxes.map(b => [b.id, b]));
  const steps = (inp.chain ?? []).map(s => s.filter(id => boxes.has(id))).filter(s => s.length);
  if (steps.length < CHAIN_MIN_STEPS) return null;
  const ms = Math.round(Math.min(STEP_MS, CHAIN_MAX_MS / steps.length));
  const beats: Beat[] = []; let at = OPEN_START_MS; const seen: string[] = [];
  for (const s of steps) {
    seen.push(...s);
    const show = withContainers(seen, boxes);
    beats.push({ at, ms, show: [...show], names: [], ghosts: [], lines: [], version: null, caption: CHAIN_CAPTION });
    at += ms;
  }
  // The rest comes in together, receded (as a pick's rest recedes: the chain stays lit), and reaches full strength as the map lands.
  const lit = withContainers(seen, boxes);
  beats.push({ at, ms: REST_MS, show: inp.boxes.map(b => b.id), names: [], ghosts: [], lines: inp.edges.map(e => e.key), version: null, caption: CHAIN_CAPTION, dim: inp.boxes.map(b => b.id).filter(id => !lit.has(id)) });
  at += REST_MS;
  return { kind: 'chain', beats, versions: [], end: at };
}
/** The chain's lines seen at each step: a chain line once both of its drawn ends are there (filled in by the engine from the line's ends). */
export function chainLines(plan: OpeningPlan, edges: readonly { key: string; ids: readonly string[]; from: string; to: string }[], rels: readonly string[]): OpeningPlan {
  if (plan.kind !== 'chain') return plan;
  const rs = new Set(rels), mine = edges.filter(e => e.ids.some(id => rs.has(id)));
  const steps = plan.beats.at(-2)?.show ?? [];
  const chainKeys = new Set(mine.filter(e => steps.includes(e.from) && steps.includes(e.to)).map(e => e.key));
  return { ...plan, beats: plan.beats.map((b, i) => (i === plan.beats.length - 1 ? { ...b, dimLines: b.lines.filter(k => !chainKeys.has(k)) } : { ...b, lines: mine.filter(e => b.show.includes(e.from) && b.show.includes(e.to)).map(e => e.key) })) };
}
export function fadePlan(inp: OpeningInput): OpeningPlan {
  return { kind: 'fade', beats: [{ at: OPEN_START_MS, ms: FADE_MS, show: inp.boxes.map(b => b.id), names: [], ghosts: [], lines: inp.edges.map(e => e.key), version: null, caption: null }], versions: [], end: OPEN_START_MS + FADE_MS };
}
/** Which opening a map gets: growth with two versions or more, else its recorded chain, else the fade. */
export function openingPlan(inp: OpeningInput & { edges: readonly { key: string; ids: readonly string[]; from: string; to: string }[] }, budget = OPEN_TOTAL_MS): OpeningPlan {
  if (inp.versions.length >= 2) return growthPlan(inp, budget);
  const c = chainPlan(inp);
  return c ? chainLines(c, inp.edges, inp.chainRels) : fadePlan(inp);
}
/** The whole length from the first frame to a quiet map (the typing at its longest). */
export const openingLength = (p: OpeningPlan): number => p.end + SETTLE_MS + TYPE_PLAN_MS;
/** v13 fix 1: the typing's length for a sentence of n characters (TYPE_CHAR_MS each, TYPE_PLAN_MS at most; within TYPE_MAX_MS). */
export const typeLength = (n: number): number => Math.min(TYPE_PLAN_MS, n * TYPE_CHAR_MS);
/** v13 fix 1 (review of v13: versions passed over still read as passed on the strip): each tick's state at a shown version — 'now', 'past'
 * (a shown version before it), 'skip' (a version passed over: drawn hollow, never as seen), or 'ahead'. */
export function tickState(v: number, now: number, shown: ReadonlySet<number>): 'now' | 'past' | 'skip' | 'ahead' {
  if (v === now) return 'now';
  if (!shown.has(v)) return 'skip';
  return v < now ? 'past' : 'ahead';
}
/** v13 fix 1 (review of v13: a wheel that ended the opening also zoomed the map, a click also picked what was under it): how an input that
 * ends the opening is taken. 'eat': it only ends it (its default and the map's own handling stopped); 'pass': it ends it and does what it
 * does (a key with a modifier, a press outside the map's area). */
export function skipTake(type: string, inMap: boolean, mod: boolean): 'eat' | 'pass' {
  if (type === 'keydown') return mod ? 'pass' : 'eat';
  return inMap ? 'eat' : 'pass';
}

/* ---------- remembering what was seen (this browser only) ---------- */
export function readSeen(get: (k: string) => string | null): Record<string, string> {
  try { const v = JSON.parse(get(SEEN_KEY) ?? '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, string> : {}; } catch { return {}; }
}
export const seenNow = (seen: Record<string, string>, key: string, version: string): boolean => seen[key] === version;
export function markSeen(get: (k: string) => string | null, set: (k: string, v: string) => void, key: string, version: string) {
  try { const s = readSeen(get); s[key] = version; set(SEEN_KEY, JSON.stringify(s)); } catch { /* no storage: it plays again next time */ }
}

/** Typing: the first n characters of the texts, in order (the text nodes keep their places; the rest is empty until typed). */
export function typedTexts(texts: readonly string[], n: number): string[] {
  let left = Math.max(0, n);
  return texts.map(t => { const s = t.slice(0, left); left -= s.length; return s; });
}
/** The settle's camera: c scaled by f about the viewport's centre. */
export const settled = (c: { x: number; y: number; k: number }, f: number, vw: number, vh: number) => (f === 1 ? c : { k: c.k * f, x: vw / 2 - (vw / 2 - c.x) * f, y: vh / 2 - (vh / 2 - c.y) * f });
export const easeOut = (t: number): number => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
/** Between the whole view a and the map's frame b at t: the centre moves evenly, the zoom by the same ratio each step. */
export function between(a: { x: number; y: number; k: number }, b: { x: number; y: number; k: number }, t: number, vw: number, vh: number) {
  if (t <= 0) return { ...a }; if (t >= 1) return { ...b };
  const ca = { x: (vw / 2 - a.x) / a.k, y: (vh / 2 - a.y) / a.k }, cb = { x: (vw / 2 - b.x) / b.k, y: (vh / 2 - b.y) / b.k };
  const k = a.k * Math.pow(b.k / a.k, t), cx = ca.x + (cb.x - ca.x) * t, cy = ca.y + (cb.y - ca.y) * t;
  return { k, x: vw / 2 - cx * k, y: vh / 2 - cy * k };
}

/* ---------- the engine (DOM) ---------- */
export interface OpeningHost {
  space(): HTMLElement; world(): HTMLElement;
  /** Writes the camera again (the app's writer, through look()). */
  rewrite(): void;
  sentence(): HTMLElement | null;
  reduced(): boolean;
  storage(): { get(k: string): string | null; set(k: string, v: string): void } | null;
  /** The input of the map shown now (built when asked; null: nothing to open). */
  input(): (OpeningInput & { edges: readonly { key: string; ids: readonly string[]; from: string; to: string }[] }) | null;
  /** After the landing (the map quiet): what the app does again for the settled camera (labels at the fit). */
  landed(): void;
  /** The whole map's view while it comes into being, when the camera shows only part of it (null: the camera shows it whole). */
  overview(): { x: number; y: number; k: number } | null;
}
export function createOpening(host: OpeningHost) {
  let run: { timers: number[]; raf: number; off: () => void; key: string; version: string; names: Map<Element, Node[]>; typing: { el: HTMLElement; nodes: Text[]; texts: string[] } | null;
    over: { x: number; y: number; k: number } | null; blend: number } | null = null;
  let factor = 1;
  const strip = () => document.getElementById('op-strip');
  function clearClasses(world: HTMLElement) {
    world.querySelectorAll('.op-out, .op-in, .op-dim').forEach(el => el.classList.remove('op-out', 'op-in', 'op-dim'));
    world.querySelectorAll<SVGPathElement>('.edge-line.op-draw').forEach(p => { p.classList.remove('op-draw'); p.style.removeProperty('stroke-dasharray'); p.style.removeProperty('stroke-dashoffset'); p.style.removeProperty('transition'); p.style.removeProperty('marker-end'); p.style.removeProperty('marker-start'); });
    world.querySelectorAll('.op-ghost').forEach(el => el.remove());
  }
  function restoreNames() {
    if (!run) return;
    for (const [el, nodes] of run.names) { el.replaceChildren(...nodes); (el as HTMLElement).style.removeProperty('font-size'); el.classList.remove('op-oldname'); }
    run.names.clear();
  }
  function restoreTyping() {
    const t = run?.typing; if (!t) return;
    t.nodes.forEach((n, i) => { n.data = t.texts[i]!; }); t.el.style.removeProperty('width'); t.el.style.removeProperty('height'); t.el.classList.remove('op-typing'); run!.typing = null;
  }
  /** Ends it now: the final state exactly as the map draws it. */
  function finish(mark = true) {
    const r = run; if (!r) return;
    for (const t of r.timers) clearTimeout(t); cancelAnimationFrame(r.raf); r.off();
    restoreNames(); restoreTyping();
    const world = host.world(); clearClasses(world);
    host.space().classList.remove('op-run', 'op-land');
    strip()?.remove();
    run = null; factor = 1; host.rewrite();
    if (mark) { const s = host.storage(); if (s) markSeen(s.get, s.set, r.key, r.version); }
    host.landed();
  }
  function nameEls(world: HTMLElement, box: string): Element[] {
    const card = world.querySelector(`.node[data-box="${CSS.escape(box)}"]`); if (!card) return [];
    return [...card.querySelectorAll('.c-name, .c-tag-name, .node-name')].filter((el, i, a) => !a.some(o => o !== el && o.contains(el)));
  }
  function setName(world: HTMLElement, box: string, name: string | null) {
    if (!run) return;
    for (const el of nameEls(world, box)) {
      if (name === null) { const nodes = run.names.get(el); if (nodes) { el.replaceChildren(...nodes); (el as HTMLElement).style.removeProperty('font-size'); el.classList.remove('op-oldname'); run.names.delete(el); } continue; }
      if (!run.names.has(el)) run.names.set(el, [...el.childNodes]);
      el.textContent = name; el.classList.add('op-oldname');
      // A longer name of an earlier version keeps to the card: a little smaller until it fits (never cut).
      const e = el as HTMLElement; e.style.removeProperty('font-size');
      const base = parseFloat(getComputedStyle(e).fontSize) || 13, card = e.closest<HTMLElement>('.node');
      const over = () => e.scrollWidth > e.clientWidth + 1 || (!!card && card.scrollHeight > card.clientHeight + 1);
      for (let s = 0.94; s >= 0.7 && over(); s -= 0.06) e.style.fontSize = `${(base * s).toFixed(2)}px`;
    }
  }
  function drawLine(g: SVGGElement) {
    g.classList.remove('op-out'); g.classList.add('op-in');
    const p = g.querySelector<SVGPathElement>('.edge-line'); if (!p) return;
    let len = 0; try { len = p.getTotalLength(); } catch { return; }
    if (!len || getComputedStyle(p).strokeDasharray !== 'none') return;
    p.classList.add('op-draw');
    p.style.setProperty('marker-end', 'none'); p.style.setProperty('marker-start', 'none');
    p.style.strokeDasharray = `${len}`; p.style.strokeDashoffset = `${len}`;
    void p.getBoundingClientRect();
    p.style.transition = `stroke-dashoffset ${LINE_MS}ms ease-out`; p.style.strokeDashoffset = '0';
    run?.timers.push(window.setTimeout(() => { p.classList.remove('op-draw'); for (const k of ['stroke-dasharray', 'stroke-dashoffset', 'transition', 'marker-end', 'marker-start']) p.style.removeProperty(k); }, LINE_MS + 30));
  }
  /** An outline's name keeps to it (a little smaller until it fits, never cut), as a card's own name does; around a successor it is the caption over it. */
  function fitGhost(el: HTMLElement, around: boolean) {
    el.classList.toggle('around', around);
    const t = el.querySelector<HTMLElement>('.op-ghost-name'); if (!t) return;
    t.style.removeProperty('font-size'); t.style.removeProperty('line-height'); if (around) return;
    const base = parseFloat(getComputedStyle(t).fontSize) || 13;
    for (let s = 0.94; s >= 0.6 && (el.scrollHeight > el.clientHeight + 1 || t.scrollWidth > el.clientWidth); s -= 0.06) { t.style.fontSize = `${(base * s).toFixed(2)}px`; t.style.lineHeight = '1.2'; }
  }
  function ghostEl(world: HTMLElement, g: Ghost): HTMLElement | null {
    const card = world.querySelector<HTMLElement>(`[data-box="${CSS.escape(g.box)}"]`); if (!card) return null;
    const el = document.createElement('div'); el.className = 'op-ghost'; el.dataset.part = g.part; el.dataset.box = g.box; el.setAttribute('aria-hidden', 'true');
    el.style.left = card.style.left; el.style.top = card.style.top; el.style.width = card.style.width; el.style.height = card.style.height;
    // Standing alone it is the earlier part's place; around its successor (already there on that version) it names the part it will take over from.
    const t = document.createElement('span'); t.className = 'op-ghost-name'; t.textContent = g.name; const w = document.createElement('span'); w.className = 'op-ghost-w'; w.textContent = GHOST_WORD; t.prepend(w); el.append(t);
    world.append(el); return el;
  }
  function buildStrip(plan: OpeningPlan): HTMLElement {
    strip()?.remove();
    const el = document.createElement('div'); el.id = 'op-strip'; el.className = `op-strip k-${plan.kind}`; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
    if (plan.versions.length) {
      const track = document.createElement('div'); track.className = 'op-track'; track.setAttribute('aria-hidden', 'true');
      const n = plan.versions.length;
      plan.versions.forEach((v, i) => { const t = document.createElement('span'); t.className = 'op-tick'; t.dataset.n = String(v); t.style.left = `${n > 1 ? (i / (n - 1)) * 100 : 50}%`; const l = document.createElement('span'); l.className = 'op-tick-l'; l.textContent = `v${v}`; t.append(l); track.append(t); });
      const head = document.createElement('span'); head.className = 'op-head'; track.append(head); el.append(track);
    }
    const cap = document.createElement('span'); cap.className = 'op-cap'; el.append(cap);
    const skip = document.createElement('span'); skip.className = 'op-skip'; skip.textContent = '아무 키나 누르면 끝'; el.append(skip);
    host.space().append(el); return el;
  }
  function beatAt(plan: OpeningPlan, i: number, prev: { show: Set<string>; lines: Set<string>; ghosts: Map<string, HTMLElement> }) {
    const world = host.world(), b = plan.beats[i]!, show = new Set(b.show), lines = new Set(b.lines);
    for (const id of show) if (!prev.show.has(id)) world.querySelector(`[data-box="${CSS.escape(id)}"]`)?.classList.remove('op-out');
    for (const id of prev.show) if (!show.has(id)) world.querySelector(`[data-box="${CSS.escape(id)}"]`)?.classList.add('op-out');
    for (const id of b.dim ?? []) world.querySelector(`[data-box="${CSS.escape(id)}"]`)?.classList.add('op-dim');
    for (const k of b.dimLines ?? []) world.querySelector(`.edge[data-key="${CSS.escape(k)}"]`)?.classList.add('op-dim');
    // Names: the version's own where it differs from the live one, else the live one back.
    const named = new Map(b.names); for (const [el] of run!.names) { const box = el.closest<HTMLElement>('[data-box]')?.dataset.box; if (box && !named.has(box)) setName(world, box, null); }
    for (const [box, name] of named) setName(world, box, name);
    // Outlines: new ones come, those of a succession dissolve (the successor fades in where they stood).
    const gk = new Set(b.ghosts.map(g => `${g.box}|${g.part}`));
    for (const [k, el] of prev.ghosts) if (!gk.has(k)) { el.classList.add('op-dissolve'); prev.ghosts.delete(k); run!.timers.push(window.setTimeout(() => el.remove(), 420)); }
    for (const g of b.ghosts) { const k = `${g.box}|${g.part}`; let el = prev.ghosts.get(k); if (!el) { el = ghostEl(world, g) ?? undefined; if (el) prev.ghosts.set(k, el); } if (el && el.classList.contains('around') !== show.has(g.box) || (el && !el.dataset.fit)) { el.dataset.fit = '1'; fitGhost(el, show.has(g.box)); } }
    // Lines after their cards.
    const newLines = [...lines].filter(k => !prev.lines.has(k));
    run!.timers.push(window.setTimeout(() => { for (const k of newLines) { const g = world.querySelector<SVGGElement>(`.edge[data-key="${CSS.escape(k)}"]`); if (g) drawLine(g); } }, CARD_IN_MS));
    for (const k of prev.lines) if (!lines.has(k)) world.querySelector(`.edge[data-key="${CSS.escape(k)}"]`)?.classList.add('op-out');
    prev.show = show; prev.lines = lines;
    const st = strip();
    if (st) {
      const cap = st.querySelector('.op-cap'); if (cap) cap.textContent = b.caption ?? '';
      st.classList.toggle('no-cap', !b.caption);
      if (b.version !== null && plan.versions.length) {
        const n = plan.versions.length, at = plan.versions.indexOf(b.version), head = st.querySelector<HTMLElement>('.op-head');
        if (head) head.style.left = `${n > 1 ? (at / (n - 1)) * 100 : 50}%`;
        const shown = new Set(plan.beats.map(x => x.version).filter((x): x is number => x !== null));
        st.querySelectorAll<HTMLElement>('.op-tick').forEach(t => { const s = tickState(Number(t.dataset.n), b.version!, shown); t.classList.toggle('past', s === 'past' || s === 'now'); t.classList.toggle('now', s === 'now'); t.classList.toggle('skip', s === 'skip'); });
      }
    }
  }
  function land() {
    const r = run; if (!r) return;
    restoreNames();
    host.world().querySelectorAll('.op-ghost').forEach(el => el.remove());
    // The sentence waits empty while the camera settles, then types in.
    const sent = host.sentence();
    if (sent) {
      const tw = document.createTreeWalker(sent, NodeFilter.SHOW_TEXT), nodes: Text[] = [];
      for (let n = tw.nextNode(); n; n = tw.nextNode()) nodes.push(n as Text);
      const texts = nodes.map(n => n.data);
      sent.style.width = `${sent.getBoundingClientRect().width}px`; sent.style.height = `${sent.getBoundingClientRect().height}px`; sent.classList.add('op-typing');
      nodes.forEach(n => { n.data = ''; });
      r.typing = { el: sent, nodes, texts };
    }
    host.space().classList.add('op-land'); host.space().classList.remove('op-run');
    // The receded rest reaches full strength with the settle.
    host.world().querySelectorAll('.op-dim').forEach(el => el.classList.remove('op-dim'));
    strip()?.classList.add('op-gone');
    const t0 = performance.now(), total = r.typing ? r.typing.texts.join('').length : 0;
    const typeMs = typeLength(total), landMs = r.over ? LAND_GLIDE_MS : SETTLE_MS;
    const step = (now: number) => {
      if (!run) return;
      const t = now - t0;
      // The settle (1.03 → 1), and from the whole view into the map's frame when it grew in the whole view.
      factor = 1 + (SETTLE_FROM - 1) * (1 - easeOut(t / landMs)); run.blend = easeInOut(Math.min(1, t / landMs)); host.rewrite();
      const ty = run.typing;
      if (ty && t > landMs) { const n = Math.round(((t - landMs) / Math.max(1, typeMs)) * total); typedTexts(ty.texts, n).forEach((s, i) => { ty.nodes[i]!.data = s; }); }
      if (t >= landMs + typeMs) { finish(true); return; }
      run.raf = requestAnimationFrame(step);
    };
    r.raf = requestAnimationFrame(step);
  }
  function play(key: string, version: string, since?: number) {
    if (run) finish(false);
    const world = host.world(), sp = host.space();
    if (!world.querySelector(':scope > .node, :scope > .frame')) return false;
    // The stage: nothing of the map yet but its title; the tools step aside for the strip.
    // At once (no fade out of what was laid out a moment ago): the transitions held while the stage is set.
    sp.classList.add('op-setup');
    world.querySelectorAll<HTMLElement>(':scope > .node, :scope > .frame').forEach(el => el.classList.add('op-out'));
    world.querySelectorAll<SVGGElement>('.edge').forEach(g => g.classList.add('op-out'));
    sp.classList.add('op-run'); sp.classList.remove('op-land');
    void world.offsetWidth; sp.classList.remove('op-setup');
    run = { timers: [], raf: 0, off: () => {}, key, version, names: new Map(), typing: null, over: host.overview(), blend: 0 };
    factor = SETTLE_FROM; host.rewrite();
    // The budget counts from when the map was asked for (its own drawing took part of it), never from the stage alone.
    const t0 = since !== undefined && since <= performance.now() ? since : performance.now();
    const off = (() => {
      // An input that ends it is taken whole where it would act on the map (no zoom from the wheel, no pick from the press, no key's
      // action); a press outside the map's area (the header's controls) and a key with a modifier also do what they do.
      let eatUntil = 0;
      const inMap = (e: Event) => { const t = e.target as Element | null; return !!t && typeof t.closest === 'function' && !!t.closest('#viewport'); };
      const h = (e: Event) => {
        const ke = e as KeyboardEvent, mod = e.type === 'keydown' && (ke.ctrlKey || ke.metaKey || ke.altKey || /^F\d+$/.test(ke.key ?? ''));
        if (e.type === 'keydown' && ['Shift', 'Control', 'Alt', 'Meta'].includes(ke.key)) { finish(true); return; }
        if (skipTake(e.type, inMap(e), mod) === 'eat') { e.stopImmediatePropagation(); if (e.cancelable) e.preventDefault(); if (e.type !== 'keydown' && e.type !== 'wheel') eatUntil = performance.now() + 700; }
        finish(true);
      };
      // The rest of the press that ended it (its release and click) is taken too, on the map only.
      const tail = (e: Event) => { if (performance.now() < eatUntil && inMap(e)) { e.stopImmediatePropagation(); if (e.cancelable) e.preventDefault(); } };
      const types = ['pointerdown', 'mousedown', 'wheel', 'keydown', 'touchstart'], tails = ['pointerup', 'mouseup', 'click', 'dblclick'];
      for (const t of types) window.addEventListener(t, h, { capture: true, passive: false });
      for (const t of tails) window.addEventListener(t, tail, { capture: true, passive: false });
      const drop = () => { for (const t of types) window.removeEventListener(t, h, true); };
      return () => { drop(); window.setTimeout(() => { for (const t of tails) window.removeEventListener(t, tail, true); }, 750); };
    })();
    run.off = off;
    // The plan once the stage is on screen (rebuilding a long history's versions takes a moment), in the time left of OPEN_TOTAL_MS.
    run.raf = requestAnimationFrame(() => { run?.timers.push(window.setTimeout(() => {
      if (!run) return;
      // Anything that cannot be read ends it at once: the map as it is, never a stage left empty.
      let inp: ReturnType<OpeningHost['input']> = null, plan: OpeningPlan;
      try { inp = host.input(); if (!inp || !inp.boxes.length) throw new Error('EMPTY'); plan = openingPlan(inp, OPEN_TOTAL_MS - (performance.now() - t0) - (run.over ? LAND_GLIDE_MS - SETTLE_MS : 0)); } catch { finish(true); return; }
      const spent = performance.now() - t0, shift = -Math.min(OPEN_START_MS, spent);
      // The strip says what is shown (a version, the recorded chain); the plain fade has nothing to say.
      if (plan.kind !== 'fade') buildStrip(plan);
      const prev = { show: new Set<string>(), lines: new Set<string>(), ghosts: new Map<string, HTMLElement>() };
      plan.beats.forEach((b, i) => run!.timers.push(window.setTimeout(() => { if (run) beatAt(plan, i, prev); }, Math.max(0, b.at + shift))));
      run.timers.push(window.setTimeout(() => land(), Math.max(0, plan.end + shift) + 120));
    }, 0)); });
    return true;
  }
  return {
    running: (): boolean => !!run,
    /** The settle's camera for the writer (the camera itself when nothing plays). */
    look<C extends { x: number; y: number; k: number }>(c: C, vw: number, vh: number): C {
      const base = run?.over ? between(run.over, c, run.blend, vw, vh) : c;
      return factor === 1 && base === c ? c : { ...c, ...settled(base, factor, vw, vh) };
    },
    /** A map arriving fresh: plays when this version of it was not seen here (and motion is welcome). */
    arrive(key: string, version: string, since?: number): boolean {
      if (host.reduced()) return false;
      const s = host.storage(); if (s && seenNow(readSeen(s.get), key, version)) return false;
      return play(key, version, since);
    },
    /** Whether arrive would play now (not reduced, this version not seen here). */
    willPlay(key: string, version: string): boolean { if (host.reduced()) return false; const s = host.storage(); return !(s && seenNow(readSeen(s.get), key, version)); },
    /** 다시 보기. */
    replay(key: string, version: string): boolean { if (host.reduced()) return false; return play(key, version); },
    /** Any redraw or move away ends it at once. */
    skip(): void { finish(true); },
    /** Shows 다시 보기 (the top bar, beside the project's name) where an opening can play: the map's own view, not inside a part or a past version. */
    offer(on: boolean) { const b = document.getElementById('replay-open'); if (b) b.hidden = !on; },
  };
}
export type Opening = ReturnType<typeof createOpening>;
