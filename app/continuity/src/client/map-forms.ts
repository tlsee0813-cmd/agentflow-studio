/* 보기 (v13 spec 3): the whole map's three forms, each a placement of the scope's top cards that the existing router draws the lines of.
 * - 흐름: the record's main flow (a 먼저 볼 연결 candidate whose own words state an order: a scenario, the C-SUMMARY sentence the first view
 *   calls 「기록이 설명한 흐름」, or a 「첫 구조 줄」 line with arrows or order words) laid on one row left to right in the record's order (a
 *   step's alternatives stand in one column); every other card in the rows above or below, beside the step it has the most recorded
 *   relations with (what feeds a step above it, what a step feeds below it); people and outside systems at the row end they meet;
 *   build, CI and release parts (their recorded kind, or their own names) in a lane of their own under everything, 「만들고 배포하는 길」;
 *   a relation from a later step back to an earlier one leaves and enters its cards from below (the way back runs under the row).
 *   Offered only when that order holds three steps or more on the cards drawn.
 * - 층: one horizontal band per recorded family (the record's own words: 참여 · 촉발 · 처리 · 저장 · 관문, and 외부 for an outside system),
 *   cards in a band ordered to cross fewer lines (barycentres over the other bands), a band that is too long for the window wrapped on
 *   more rows, its label on the left. Offered when three families or more are recorded on the cards drawn. A card the record gave no
 *   family is never dropped: it stands in a band 「미정」 at the bottom.
 * - 구성: the layered map as it is (always offered).
 * The automatic choice is the record's: 흐름 when its order holds four steps or more and covers a quarter of the cards; else 층 when three
 * families or more are recorded on twelve cards or more; else 구성. The reason reads in plain words in the switcher's tip.
 * Nothing here invents an order, a group or an importance: the row is the record's own sentence order, the bands are the record's own
 * families, and above/below only says which way a recorded relation runs. Pure and deterministic: no DOM. */
import { statesOrder } from './first-flow.js';

export type MapForm = 'flow' | 'layers' | 'compose';
export const MAP_FORMS: readonly MapForm[] = ['flow', 'layers', 'compose'];
export const MAP_FORM_WORD: Readonly<Record<MapForm, string>> = Object.freeze({ flow: '흐름', layers: '층', compose: '구성' });
/** The switcher's own word, before the forms (「보기: 흐름 · 층 · 구성」). */
export const FORM_SWITCH_WORD = '보기';
/** The build and release lane's caption (흐름). */
export const BUILD_LANE_WORD = '만들고 배포하는 길';
/** The least steps a recorded order needs for 흐름 to be offered, and for it to be chosen (with FLOW_COVER of the cards). */
export const FLOW_OFFER_STEPS = 3, FLOW_AUTO_STEPS = 4, FLOW_COVER = 0.25;
/** The least families for 층 to be offered, and the least cards for it to be chosen. */
export const LAYERS_OFFER_FAMILIES = 3, LAYERS_AUTO_CARDS = 12;

/* ---------- what a form reads ---------- */
/** A top card of the scope as the forms read it: its box size, its recorded family (map-reading familyRead: participant · process · store
 * · trigger · gate, or null) and type word, its name, and whether it is on the 실행 위치 미기록 shelf (kept under everything). */
export interface FormCard { id: string; name: string; w: number; h: number; family: string | null; type: string | null; shelf?: boolean;
  /** From the card's top, where its side lines meet it (a typed card's contact point; else its middle): a row's cards keep it level. */
  anchor?: number }
/** A recorded relation lifted to two top cards: directed for data, control and reference lines, not for shares and related. */
export interface FormLine { from: string; to: string; directed: boolean }
/** A candidate order as the first view reads it (first-flow FlowCandidate's fields used here). */
export interface OrderCandidate { rule: string; source: string; text: string | null; steps: readonly (readonly string[])[]; drawnLines: number }
/** The record's order on the cards drawn: its steps (each the top cards it names, first naming only), where it was read. */
export interface FormChain { steps: string[][]; rule: string; source: string; text: string | null }

/** The order a candidate states as the record says it: a scenario (its recorded visit order), the summary sentence the first view reads as
 * 「기록이 설명한 흐름」, or a 「첫 구조 줄」 line whose words state an order (arrows, 다음 · 그 뒤). An entry (a start and its fan) states none. */
export function statesAnOrder(c: Pick<OrderCandidate, 'rule' | 'source' | 'text'>, orderedWord: string): boolean {
  if (c.rule === 'scenario') return true;
  if (c.rule === 'summary') return c.source === orderedWord;
  if (c.rule === 'head') return !!c.text && statesOrder(c.text);
  return false;
}
/** The record's main order on the cards drawn (rep: the top card a part is drawn on, null when it is not drawn): of the candidates that
 * state an order, the one with the most steps on the cards drawn, then the most drawn lines, then the record's order. A card named twice
 * stands at its first step; a step left with no card drawn is dropped (its neighbours stay in the record's order). null: none. */
export function recordedChain(cands: readonly OrderCandidate[], rep: (id: string) => string | null, orderedWord: string): FormChain | null {
  let best: FormChain | null = null, bestLines = -1;
  for (const c of cands) {
    if (!statesAnOrder(c, orderedWord)) continue;
    const seen = new Set<string>(), steps: string[][] = [];
    for (const st of c.steps) {
      const cards = [...new Set(st.map(rep).filter((x): x is string => !!x && !seen.has(x)))];
      cards.forEach(x => seen.add(x)); if (cards.length) steps.push(cards);
    }
    if (steps.length < 2) continue;
    if (!best || steps.length > best.steps.length || (steps.length === best.steps.length && c.drawnLines > bestLines)) { best = { steps, rule: c.rule, source: c.source, text: c.text }; bestLines = c.drawnLines; }
  }
  return best;
}

/* ---------- bands (층) ---------- */
export type BandId = 'participant' | 'trigger' | 'process' | 'store' | 'external' | 'undecided';
export const BAND_ORDER: readonly BandId[] = ['participant', 'trigger', 'process', 'store', 'external', 'undecided'];
/** The record's family words (C-PART 표현군), and 외부 for an outside system; 미정 for a card the record gave no family. */
const FAMILY_WORD: Readonly<Record<string, string>> = { participant: '참여', trigger: '촉발', process: '처리', store: '저장', gate: '관문', external: '외부', undecided: '미정' };
const TYPE_FAMILY: Readonly<Record<string, string>> = { collector: 'process', compute: 'process', ai: 'process', actor: 'process', loop: 'process', screen: 'process', timer: 'trigger', automation: 'trigger', store: 'store', person: 'participant', session: 'participant', external: 'participant' };
/** A card's family word key: the record's family first, else its type word's (as the card's own family tint reads), else none. */
export function familyKey(c: Pick<FormCard, 'family' | 'type'>): string | null {
  if (c.family && FAMILY_WORD[c.family] && c.family !== 'external' && c.family !== 'undecided') return c.family;
  return c.type ? TYPE_FAMILY[c.type] ?? null : null;
}
/** A card's band: an outside system (type word 외부 system, of the 참여 family or none) is 외부; a gate stands with the stores (저장·관문). */
export function bandOf(c: Pick<FormCard, 'family' | 'type'>): BandId {
  const f = familyKey(c);
  if (c.type === 'external' && (!f || f === 'participant')) return 'external';
  if (f === 'gate' || f === 'store') return 'store';
  return f === 'participant' || f === 'trigger' || f === 'process' ? f : 'undecided';
}
/** A band's label: the family words of the cards in it, in the record's words (「저장 · 관문」 only when both are there). */
export function bandWord(band: BandId, cards: readonly Pick<FormCard, 'family' | 'type'>[]): string {
  if (band !== 'store') return FAMILY_WORD[band]!;
  const ws = [...new Set(cards.map(c => (familyKey(c) === 'gate' ? 'gate' : 'store')))].sort((a, b) => (a === 'store' ? -1 : 1) - (b === 'store' ? -1 : 1));
  return ws.map(w => FAMILY_WORD[w]).join(' · ');
}
/** The recorded families on the cards (each band but 미정, a gate and a store counted apart). */
export function familiesOn(cards: readonly Pick<FormCard, 'family' | 'type' | 'shelf'>[]): string[] {
  const out = new Set<string>();
  for (const c of cards) { if (c.shelf) continue; const b = bandOf(c); if (b === 'undecided') continue; out.add(b === 'store' ? (familyKey(c) === 'gate' ? 'gate' : 'store') : b); }
  return BAND_ORDER.flatMap(b => (b === 'store' ? ['store', 'gate'] : [b])).filter(f => out.has(f));
}

/* ---------- the choice ---------- */
export interface FormChoice { offered: MapForm[]; auto: MapForm; why: string; not: Partial<Record<MapForm, string>>; steps: number; families: string[] }
/** Which forms the record offers and which it chooses (see the head of this file), with the reason in plain words. */
export function formChoice(cards: readonly FormCard[], chain: FormChain | null): FormChoice {
  const live = cards.filter(c => !c.shelf), n = live.length, steps = chain?.steps.length ?? 0;
  const covered = chain ? new Set(chain.steps.flat()).size : 0, fams = familiesOn(live), famWords = fams.map(f => FAMILY_WORD[f]).join('·');
  const offered: MapForm[] = [], not: Partial<Record<MapForm, string>> = {};
  if (steps >= FLOW_OFFER_STEPS) offered.push('flow');
  else not.flow = steps ? `기록에 이어진 흐름이 ${steps}단계뿐이라 흐름으로 펼치지 않아요 (3단계부터)` : '기록에 순서를 말한 흐름이 없어 흐름으로 펼치지 않아요';
  if (fams.length >= LAYERS_OFFER_FAMILIES) offered.push('layers');
  else not.layers = fams.length ? `기록된 표현군이 ${fams.length}가지(${famWords})뿐이라 층으로 나누지 않아요 (3가지부터)` : '기록된 표현군이 없어 층으로 나누지 않아요';
  offered.push('compose');
  let auto: MapForm = 'compose', why: string;
  if (steps >= FLOW_AUTO_STEPS && n && covered / n >= FLOW_COVER) { auto = 'flow'; why = `기록에 이어진 흐름 ${steps}단계가 부품 ${n}개 중 ${covered}개를 지나서 흐름으로 보여 줍니다`; }
  else if (fams.length >= LAYERS_OFFER_FAMILIES && n >= LAYERS_AUTO_CARDS) {
    auto = 'layers';
    why = `기록된 표현군이 ${fams.length}가지(${famWords})라 층으로 보여 줍니다${steps >= FLOW_OFFER_STEPS ? ` · 이어진 흐름 ${steps}단계는 흐름에서 볼 수 있어요` : ''}`;
  } else why = n < LAYERS_AUTO_CARDS && fams.length >= LAYERS_OFFER_FAMILIES ? `부품이 ${n}개로 적어 구성으로 보여 줍니다` : '기록이 흐름도 층도 정하지 않아 구성으로 보여 줍니다';
  return { offered, auto, why, not, steps, families: fams };
}
/** The form shown: the person's kept choice while the record still offers it, else the record's. */
export const formShown = (c: FormChoice, kept: MapForm | null | undefined): MapForm => (kept && c.offered.includes(kept) ? kept : c.auto);
/** V: the next form offered after the one shown (in switcher order), wrapping. */
export function nextMapForm(now: MapForm, offered: readonly MapForm[]): MapForm {
  const order = MAP_FORMS.filter(f => offered.includes(f)); if (!order.length) return now;
  const i = order.indexOf(now); return order[(i + 1) % order.length]!;
}

/* ---------- placements ---------- */
export interface Pt { x: number; y: number }
export interface FormRect { x: number; y: number; w: number; h: number }
/** A caption the form draws (a band's, the build lane's): its words, the rectangle it labels (in map units), and its kind. */
export interface FormLane { kind: 'band' | 'build'; band?: BandId; text: string; rect: FormRect; count: number; ids: string[] }
export interface FormPlace {
  /** Each card's top-left corner. */
  at: Map<string, Pt>;
  lanes: FormLane[];
  /** 흐름: the relations that run from a later step back to an earlier one (their lines leave and enter from below). */
  back: { from: string; to: string }[];
  /** 흐름: the cards of the row, in order. */
  row: string[];
  /** The cards with no recorded relation at all (흐름 keeps them in a block of their own). */
  lone: string[];
}

const BUILD_TYPE = new Set(['automation']);
/** Build, CI and release parts by their own names (the record's kind 자동화 first, buildLike's caller). */
export const BUILD_NAME = /빌드|build|\bCI\b|CI[·/ ]|CI$|\bCD\b|CICD|릴리스|release|배포|deploy|publish|게시|레지스트리|registry|워크플로|workflow|github actions|dependabot|패키징|packag/i;
export const buildLike = (c: Pick<FormCard, 'name' | 'type'>): boolean => (!!c.type && BUILD_TYPE.has(c.type)) || BUILD_NAME.test(c.name);

/** 흐름 gaps (map units): between the row's steps, the row and the rows beside it, cards side by side, the build lane. */
export const FLOW_STEP_GAP = 128, FLOW_TIER_GAP = 88, FLOW_STACK_GAP = 28, FLOW_LANE_GAP = 112, FLOW_BACK_ROOM = 34;

interface Adj { out: Map<string, Map<string, number>>; inn: Map<string, Map<string, number>>; all: Map<string, Map<string, number>> }
function adjacency(lines: readonly FormLine[]): Adj {
  const add = (m: Map<string, Map<string, number>>, a: string, b: string) => { const x = m.get(a) ?? m.set(a, new Map()).get(a)!; x.set(b, (x.get(b) ?? 0) + 1); };
  const out = new Map<string, Map<string, number>>(), inn = new Map<string, Map<string, number>>(), all = new Map<string, Map<string, number>>();
  for (const l of lines) { if (l.from === l.to) continue; add(all, l.from, l.to); add(all, l.to, l.from); if (l.directed) { add(out, l.from, l.to); add(inn, l.to, l.from); } }
  return { out, inn, all };
}
const anchorOf = (c: FormCard) => c.anchor ?? c.h / 2;
/** A row's cards with their contact points on one line: the line's offset from the row's top, and the row's height. */
const levelRow = (cs: readonly FormCard[]) => { const a = Math.max(...cs.map(anchorOf)), b = Math.max(...cs.map(c => c.h - anchorOf(c))); return { a, h: a + b }; };
const weight = (m: Map<string, Map<string, number>>, a: string, set: ReadonlySet<string>): number => { let n = 0; for (const [b, k] of m.get(a) ?? []) if (set.has(b)) n += k; return n; };

/** 흐름's placement (see the head of this file). aspect: the window's width over height, for the lane's wrap. */
export function flowPlace(cards: readonly FormCard[], lines: readonly FormLine[], chain: FormChain, aspect = 1.8): FormPlace {
  const byId = new Map(cards.map(c => [c.id, c])), adj = adjacency(lines.filter(l => byId.has(l.from) && byId.has(l.to)));
  const at = new Map<string, Pt>(), lanes: FormLane[] = [];
  const steps = chain.steps.map(s => s.filter(id => byId.has(id) && !byId.get(id)!.shelf)).filter(s => s.length);
  const stepOf = new Map<string, number>(); steps.forEach((s, i) => s.forEach(id => stepOf.set(id, i)));
  const rowSet = new Set(stepOf.keys()), shelf = cards.filter(c => c.shelf).map(c => c.id);
  const rest = cards.filter(c => !c.shelf && !rowSet.has(c.id)).map(c => c.id);
  const linked = (id: string) => (adj.all.get(id)?.size ?? 0) > 0;
  const lone = rest.filter(id => !linked(id));
  const band = (id: string) => bandOf(byId.get(id)!), isEnd = (id: string) => band(id) === 'participant' || band(id) === 'external';
  // The build lane: a card of the build kind or name; then the cards whose every relation stays among the lane and themselves, one at
  // least meeting the lane (a maintainer who only runs the release, a contributor who only meets that maintainer, the registry it
  // publishes to; people and outside systems only): the largest such set (cards that break the rule leave it until none does).
  const build = new Set(rest.filter(id => linked(id) && buildLike(byId.get(id)!)));
  if (build.size) {
    const near = new Set(rest.filter(id => linked(id) && !build.has(id) && isEnd(id)));
    for (let changed = true; changed;) { changed = false; for (const id of [...near]) { const ns = [...adj.all.get(id)!.keys()]; if (!ns.every(n => build.has(n) || near.has(n))) { near.delete(id); changed = true; } } }
    // Each kept card must reach the lane through the set (never a separate island that only meets itself).
    const reach = new Set<string>(); let grow = true;
    while (grow) { grow = false; for (const id of near) if (!reach.has(id) && [...adj.all.get(id)!.keys()].some(n => build.has(n) || reach.has(n))) { reach.add(id); grow = true; } }
    for (const id of reach) build.add(id);
  }
  const ends = rest.filter(id => linked(id) && !build.has(id) && isEnd(id));
  const side = rest.filter(id => linked(id) && !build.has(id) && !isEnd(id));
  // Each side card stands by the step it has the most recorded relations with; a card with none to the row by the step most of its
  // placed neighbours stand by (repeated until nothing changes).
  const stepAt = new Map<string, number>();
  const vote = (id: string): number | null => {
    const score = new Map<number, number>();
    for (const [n, k] of adj.all.get(id) ?? []) { const s = stepOf.get(n) ?? stepAt.get(n); if (s !== undefined) score.set(s, (score.get(s) ?? 0) + k * (stepOf.has(n) ? 4 : 1)); }
    let best: number | null = null, bv = 0; for (const [s, v] of [...score].sort((a, b) => a[0] - b[0])) if (v > bv) { bv = v; best = s; }
    return best;
  };
  for (const id of side) { const s = (() => { const score = new Map<number, number>(); for (const [n, k] of adj.all.get(id) ?? []) { const t = stepOf.get(n); if (t !== undefined) score.set(t, (score.get(t) ?? 0) + k); } let b: number | null = null, bv = 0; for (const [t, v] of [...score].sort((p, q) => p[0] - q[0])) if (v > bv) { bv = v; b = t; } return b; })(); if (s !== null) stepAt.set(id, s); }
  for (let round = 0; round < 6; round++) { let changed = false; for (const id of side) if (!stepAt.has(id)) { const s = vote(id); if (s !== null) { stepAt.set(id, s); changed = true; } } if (!changed) break; }
  // A side card whose relations reach only people or outside systems stands by the step those meet (else the row's first).
  const endStep = new Map<string, number>();
  for (const id of ends) { const s = vote(id); if (s !== null) endStep.set(id, s); }
  for (const id of side) if (!stepAt.has(id)) { const ns = [...(adj.all.get(id)?.keys() ?? [])].map(n => endStep.get(n)).filter((x): x is number => x !== undefined); stepAt.set(id, ns.length ? Math.round(ns.reduce((a, b) => a + b, 0) / ns.length) : 0); }
  // One grid of cells (column, row; row 0 is the flow's row, negative rows above it, positive under it), so every line has corridors of its
  // own between the columns and the rows (planChannels): the steps in columns 0…n-1 on row 0, a step's alternatives in its column on the
  // rows next to the row (1, −1, 2, …).
  const cw = Math.max(...cards.filter(c => !c.shelf).map(c => c.w), 1), pitch = cw + FLOW_STEP_GAP, colX = (i: number) => i * pitch;
  const cell = new Map<string, { c: number; r: number }>(), taken = new Set<string>();
  const put = (id: string, c: number, r: number) => { cell.set(id, { c, r }); taken.add(`${c}|${r}`); };
  const free = (c: number, r: number) => !taken.has(`${c}|${r}`);
  const ring = (k: number) => (k === 0 ? 0 : k % 2 ? (k + 1) / 2 : -k / 2);
  steps.forEach((s, i) => s.forEach((id, k) => put(id, i, ring(k))));
  // The way back: a relation from a later step to an earlier one (its lines run under the row).
  const back: { from: string; to: string }[] = [];
  for (const l of lines) { const a = stepOf.get(l.from), b = stepOf.get(l.to); if (a !== undefined && b !== undefined && l.directed && b < a) back.push({ from: l.from, to: l.to }); }
  // Rows beside the row: above for what feeds its step (more relations into the step than out of it), below for what its step feeds;
  // a card takes the free cell nearest its step's column on the nearest row of its side (a row further out only when that is nearer).
  const order = [...side].sort((a, b) => stepAt.get(a)! - stepAt.get(b)! || weight(adj.all, b, rowSet) - weight(adj.all, a, rowSet) || cards.findIndex(c => c.id === a) - cards.findIndex(c => c.id === b));
  let balance = 0;
  for (const id of order) {
    const s = stepAt.get(id)!, step = new Set(steps[s] ?? []);
    const into = weight(adj.out, id, step), from = weight(adj.inn, id, step);
    const up = into > from ? true : from > into ? false : balance <= 0;
    balance += up ? 1 : -1;
    let best: { c: number; r: number; cost: number } | null = null;
    for (let t = 1; t <= side.length + steps.length + 2; t++) {
      if (best && (t - 1) * 1.25 >= best.cost) break;
      const r = up ? -t : t;
      for (let d = 0; d <= steps.length + side.length + 2; d++) {
        const cost = (t - 1) * 1.25 + d; if (best && cost >= best.cost) break;
        const c = [s + d, s - d].find(c => free(c, r)); if (c !== undefined) { best = { c, r, cost }; break; }
      }
    }
    put(id, best!.c, best!.r);
  }
  // People and outside systems at the row's ends, in columns past the leftmost and rightmost used: the left end for those that meet the
  // row's first half, the right for the rest; each column takes the rows next to the row first (0, −1, 1, …), five at most.
  const usedC = [...cell.values()].map(x => x.c), minC = Math.min(0, ...usedC), maxC = Math.max(steps.length - 1, ...usedC);
  const mid = (steps.length - 1) / 2, left: string[] = [], right: string[] = [];
  for (const id of ends) { const s = endStep.get(id); (s === undefined || s <= mid ? left : right).push(id); }
  const endCols = (ids: string[], toLeft: boolean) => {
    const sorted = [...ids].sort((a, b) => (endStep.get(a) ?? 0) - (endStep.get(b) ?? 0) || cards.findIndex(c => c.id === a) - cards.findIndex(c => c.id === b));
    const per = Math.min(5, Math.max(3, Math.ceil(sorted.length / Math.max(1, Math.ceil(sorted.length / 5)))));
    sorted.forEach((id, i) => put(id, toLeft ? minC - 1 - Math.floor(i / per) : maxC + 1 + Math.floor(i / per), ring(i % per)));
  };
  endCols(left, true); endCols(right, false);
  // The build lane under everything, in the order its own recorded relations run (sources first), wrapped to the map's columns; then the
  // cards with no recorded relation (the map's 「이은 선 없음」 caption reads over them); then the shelf.
  const cs = [...cell.values()], c0 = Math.min(...cs.map(x => x.c)), c1 = Math.max(...cs.map(x => x.c)), per = Math.max(3, c1 - c0 + 1);
  let nextRow = Math.max(0, ...cs.map(x => x.r)) + 1;
  const laneRows = new Map<number, 'build' | 'lone' | 'shelf'>();
  const putRows = (ids: string[], kind: 'build' | 'lone' | 'shelf') => { if (!ids.length) return; ids.forEach((id, i) => { const r = nextRow + Math.floor(i / per); laneRows.set(r, kind); put(id, c0 + (i % per), r); }); nextRow += Math.ceil(ids.length / per); };
  const buildIds = topoOrder([...build], adj, cards.map(c => c.id));
  putRows(buildIds, 'build'); putRows(lone, 'lone'); putRows(shelf, 'shelf');
  // Heights: each row's cards with their contact points on one line; the gap under the flow's row keeps room for the way back, a lane
  // stands apart from what is over it.
  const rowsUsed = [...new Set([...cell.values()].map(x => x.r))].sort((a, b) => a - b), rowY = new Map<number, number>(), rowLv = new Map<number, { a: number; h: number }>();
  for (const r of rowsUsed) rowLv.set(r, levelRow([...cell].filter(([, x]) => x.r === r).map(([id]) => byId.get(id)!)));
  const backRoom = back.length ? FLOW_BACK_ROOM + 10 * (back.length - 1) : 0;
  let y = 0;
  rowsUsed.forEach((r, i) => {
    if (i) { const prev = rowsUsed[i - 1]!, lane = laneRows.get(r), was = laneRows.get(prev); y += lane && lane !== was ? FLOW_LANE_GAP : FLOW_TIER_GAP + (prev === 0 ? backRoom : 0); }
    rowY.set(r, y); y += rowLv.get(r)!.h;
  });
  for (const [id, x] of cell) { const c = byId.get(id)!, lv = rowLv.get(x.r)!; at.set(id, { x: colX(x.c) + (cw - c.w) / 2, y: rowY.get(x.r)! + lv.a - anchorOf(c) }); }
  if (buildIds.length) {
    const rs = buildIds.map(id => ({ ...at.get(id)!, w: byId.get(id)!.w, h: byId.get(id)!.h }));
    const x0 = Math.min(...rs.map(r => r.x)), y0 = Math.min(...rs.map(r => r.y)), x1 = Math.max(...rs.map(r => r.x + r.w)), y1 = Math.max(...rs.map(r => r.y + r.h));
    lanes.push({ kind: 'build', text: BUILD_LANE_WORD, rect: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, count: buildIds.length, ids: buildIds });
  }
  void aspect;
  return { at, lanes, back, row: steps.flat(), lone };
}
/** Cards in the order their recorded directed relations run among themselves (sources first; a cycle broken at the earliest card in the
 * given order), ties in the given order. */
function topoOrder(ids: string[], adj: Adj, given: readonly string[]): string[] {
  const set = new Set(ids), rank = new Map(given.map((id, i) => [id, i])), indeg = new Map(ids.map(id => [id, 0]));
  for (const id of ids) for (const [n] of adj.out.get(id) ?? []) if (set.has(n) && n !== id) indeg.set(n, indeg.get(n)! + 1);
  const out: string[] = [], left = new Set(ids);
  while (left.size) {
    const ready = [...left].filter(id => indeg.get(id) === 0).sort((a, b) => rank.get(a)! - rank.get(b)!);
    const pick = ready[0] ?? [...left].sort((a, b) => rank.get(a)! - rank.get(b)!)[0]!;
    out.push(pick); left.delete(pick);
    for (const [n] of adj.out.get(pick) ?? []) if (left.has(n)) indeg.set(n, indeg.get(n)! - 1);
  }
  return out;
}

/** 층 gaps (map units): cards side by side, rows within a band, between bands, and the label room left of the bands. */
export const LAYER_GAP_X = 96, LAYER_ROW_GAP = 64, LAYER_BAND_GAP = 104, LAYER_LABEL_ROOM = 150;
/** 층's placement (see the head of this file). hint: each card's place in the 구성 map (the order a band starts from, so a card keeps its
 * left-to-right neighbours where the record allows); aspect: the window's width over height. */
export function layersPlace(cards: readonly FormCard[], lines: readonly FormLine[], hint: ReadonlyMap<string, Pt> = new Map(), aspect = 1.8): FormPlace {
  const byId = new Map(cards.map(c => [c.id, c])), adj = adjacency(lines.filter(l => byId.has(l.from) && byId.has(l.to)));
  const live = cards.filter(c => !c.shelf), shelf = cards.filter(c => c.shelf).map(c => c.id);
  const bands = BAND_ORDER.map(b => ({ b, ids: live.filter(c => bandOf(c) === b).map(c => c.id) })).filter(x => x.ids.length);
  const bandIx = new Map<string, number>(); bands.forEach((x, i) => x.ids.forEach(id => bandIx.set(id, i)));
  const linked = (id: string) => (adj.all.get(id)?.size ?? 0) > 0;
  const hx = (id: string) => hint.get(id)?.x ?? 0, hy = (id: string) => hint.get(id)?.y ?? 0;
  for (const x of bands) x.ids.sort((a, b) => hx(a) - hx(b) || hy(a) - hy(b));
  // Barycentres: each card at the mean place of its neighbours in the other bands (nearer bands count more), sweeping down and up.
  const posOf = new Map<string, number>(); const index = () => { for (const x of bands) x.ids.forEach((id, i) => posOf.set(id, (i + 0.5) / x.ids.length)); };
  index();
  for (let sweep = 0; sweep < 8; sweep++) {
    const seq = sweep % 2 ? [...bands.keys()].reverse() : [...bands.keys()];
    for (const bi of seq) {
      const x = bands[bi]!, bary = new Map<string, number>();
      for (const id of x.ids) {
        let s = 0, w = 0;
        for (const [n, k] of adj.all.get(id) ?? []) { const nb = bandIx.get(n); if (nb === undefined || nb === bi) continue; const f = k / Math.abs(nb - bi); s += posOf.get(n)! * f; w += f; }
        bary.set(id, w ? s / w : posOf.get(id)!);
      }
      x.ids.sort((a, b) => bary.get(a)! - bary.get(b)! || posOf.get(a)! - posOf.get(b)!);
      x.ids.forEach((id, i) => posOf.set(id, (i + 0.5) / x.ids.length));
    }
  }
  // A card with no relation goes to its band's end (its order says nothing).
  for (const x of bands) x.ids = [...x.ids.filter(linked), ...x.ids.filter(id => !linked(id))];
  // The wrap: the most cards a row takes, chosen so the whole block is closest to the window's shape.
  const cw = Math.max(...live.map(c => c.w), 1), maxBand = Math.max(...bands.map(x => x.ids.length), 1);
  const bandRows = (ids: string[], per: number): string[][] => {
    if (ids.length <= per) return [ids];
    // A long band: cards meeting the bands above it in its first rows, those meeting the bands below in its last, each row in barycentre order.
    const bi = bandIx.get(ids[0]!)!, tend = (id: string) => { let s = 0, n = 0; for (const [m, k] of adj.all.get(id) ?? []) { const nb = bandIx.get(m); if (nb === undefined || nb === bi) continue; s += Math.sign(nb - bi) * k; n += k; } return n ? s / n : 0; };
    const rows = Math.ceil(ids.length / per), size = Math.ceil(ids.length / rows), byTend = ids.map((id, i) => ({ id, i, t: linked(id) ? tend(id) : 2 })).sort((a, b) => a.t - b.t || a.i - b.i);
    const out: string[][] = []; for (let r = 0; r < rows; r++) out.push(byTend.slice(r * size, (r + 1) * size).sort((a, b) => a.i - b.i).map(x => x.id));
    return out.filter(r => r.length);
  };
  const rowH = (r: string[]) => levelRow(r.map(id => byId.get(id)!)).h;
  const shape = (per: number) => {
    const rs = bands.map(x => bandRows(x.ids, per)), W = Math.min(per, maxBand) * (cw + LAYER_GAP_X) - LAYER_GAP_X + LAYER_LABEL_ROOM;
    const H = rs.reduce((a, r) => a + r.reduce((s, row) => s + rowH(row), 0) + LAYER_ROW_GAP * (r.length - 1), 0) + LAYER_BAND_GAP * (rs.length - 1);
    return { rs, need: Math.max(W, H * aspect) };
  };
  let best = shape(maxBand);
  for (let per = Math.max(3, Math.ceil(Math.sqrt(live.length))); per < maxBand; per++) { const s = shape(per); if (s.need < best.need - 1e-6) best = s; }
  // One grid of columns for every band (corridors run straight down between them): each row's cards take columns in their order, each
  // as near as it can to the columns of its neighbours already placed (the first row centred), then once more over all of them.
  const at = new Map<string, Pt>(), lanes: FormLane[] = [];
  const cols = Math.max(...best.rs.flat().map(r => r.length), 1), pitch = cw + LAYER_GAP_X;
  const colOf = new Map<string, number>();
  const assign = (r: string[], pass: number) => {
    const centred = (i: number) => Math.floor((cols - r.length) / 2) + i;
    const want = r.map((id, i) => { let s = 0, w = 0; for (const [n, k] of adj.all.get(id) ?? []) { const c = colOf.get(n); if (c === undefined || r.includes(n)) continue; s += c * k; w += k; } return w ? s / w : pass ? colOf.get(id) ?? centred(i) : centred(i); });
    const ord = r.map((id, i) => ({ id, i, w: want[i]! })).sort((p, q) => p.w - q.w || p.i - q.i);
    const n = ord.length, INF = 1e18, cost: number[][] = [], from: number[][] = [];
    for (let i = 0; i < n; i++) { cost.push(new Array(cols).fill(INF)); from.push(new Array(cols).fill(-1)); for (let j = i; j <= cols - (n - i); j++) { const own = Math.abs(j - ord[i]!.w); if (!i) { cost[0]![j] = own; continue; } for (let k = i - 1; k < j; k++) if (cost[i - 1]![k]! + own < cost[i]![j]!) { cost[i]![j] = cost[i - 1]![k]! + own; from[i]![j] = k; } } }
    let j = cost[n - 1]!.reduce((bj, v, jj) => (v < cost[n - 1]![bj]! - 1e-9 ? jj : bj), n - 1);
    for (let i = n - 1; i >= 0; i--) { colOf.set(ord[i]!.id, j); j = from[i]![j]!; }
  };
  for (let pass = 0; pass < 3; pass++) for (const rows of best.rs) for (const r of rows) assign(r, pass);
  let y = 0;
  best.rs.forEach((rows, bi) => {
    const top = y;
    rows.forEach((r, ri) => {
      const lv = levelRow(r.map(id => byId.get(id)!));
      for (const id of r) { const c = byId.get(id)!; at.set(id, { x: colOf.get(id)! * pitch + (cw - c.w) / 2, y: y + lv.a - anchorOf(c) }); }
      y += rowH(r) + (ri < rows.length - 1 ? LAYER_ROW_GAP : 0);
    });
    const widest = cols * pitch - LAYER_GAP_X;
    const ids = bands[bi]!.ids;
    lanes.push({ kind: 'band', band: bands[bi]!.b, text: bandWord(bands[bi]!.b, ids.map(id => byId.get(id)!)), rect: { x: 0, y: top, w: widest, h: y - top }, count: ids.length, ids: [...ids] });
    y += LAYER_BAND_GAP;
  });
  if (shelf.length) { let x = 0; for (const id of shelf) { at.set(id, { x, y }); x += byId.get(id)!.w + LAYER_GAP_X; } }
  return { at, lanes, back: [], row: [], lone: live.filter(c => !linked(c.id)).map(c => c.id) };
}

/** The crossings of straight segments between card centres (a measure for the tests and the bands' order; never drawn). */
export function crossings(at: ReadonlyMap<string, Pt>, size: ReadonlyMap<string, { w: number; h: number }>, lines: readonly FormLine[]): number {
  const c = (id: string) => { const p = at.get(id)!, s = size.get(id)!; return { x: p.x + s.w / 2, y: p.y + s.h / 2 }; };
  const segs = lines.filter(l => at.has(l.from) && at.has(l.to) && l.from !== l.to).map(l => ({ a: c(l.from), b: c(l.to), ends: [l.from, l.to] }));
  const ccw = (p: Pt, q: Pt, r: Pt) => (r.y - p.y) * (q.x - p.x) - (q.y - p.y) * (r.x - p.x);
  let n = 0;
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const s = segs[i]!, t = segs[j]!; if (s.ends.some(e => t.ends.includes(e))) continue;
    if (ccw(s.a, s.b, t.a) * ccw(s.a, s.b, t.b) < 0 && ccw(t.a, t.b, s.a) * ccw(t.a, t.b, s.b) < 0) n++;
  }
  return n;
}

/* ---------- the routes a form reserves ---------- */
/** A form's cards stand on one grid, so every line has a corridor of its own, as the layered map reserves (Channel, map-layout hintPath):
 * out of its card's side into the column gap facing the other end, along a row gap when the ends stand in different rows (or round the
 * cards between two ends of one row; 흐름's way back always under its row), and in at the other end's side from the column gap facing it.
 * In each gap the runs are given tracks LANE_TRACK apart: a run that ends at the card on a gap's right takes the tracks counted from its
 * left edge, one that ends at the card on its left those counted from its right (so the last run before every arrowhead is long), and
 * runs that never share heights share a track. A stroke whose ends are not both on the grid, or a grid a moved card has broken (columns or
 * rows that overlap), gets no reserved route: the router searches as before. Pure. */
export interface PlanBox { id: string; x: number; y: number; w: number; h: number }
export interface PlanStroke { key: string; from: string; to: string }
export interface PlanChannel { xs: number[]; ys: number[] }
export const PLAN_TRACK = 10, PLAN_MARGIN = 16, PLAN_OUTER = 72;
export function planChannels(boxes: readonly PlanBox[], strokes: readonly PlanStroke[], under: ReadonlySet<string> = new Set()): Map<string, PlanChannel> {
  const out = new Map<string, PlanChannel>(); if (boxes.length < 2) return out;
  const byId = new Map(boxes.map(b => [b.id, b]));
  // Columns by centre, rows by overlapping heights.
  const sx = [...boxes].sort((p, q) => p.x + p.w / 2 - (q.x + q.w / 2));
  const cols: { l: number; r: number; c: number }[] = [], colOf = new Map<string, number>();
  for (const b of sx) { const c = b.x + b.w / 2, last = cols.at(-1); if (last && c - last.c < 40) { last.l = Math.min(last.l, b.x); last.r = Math.max(last.r, b.x + b.w); } else cols.push({ l: b.x, r: b.x + b.w, c }); colOf.set(b.id, cols.length - 1); }
  const sy = [...boxes].sort((p, q) => p.y - q.y);
  const rows: { t: number; b: number }[] = [], rowOf = new Map<string, number>();
  for (const b of sy) { const last = rows.at(-1); if (last && b.y < last.b - 1) last.b = Math.max(last.b, b.y + b.h); else rows.push({ t: b.y, b: b.y + b.h }); rowOf.set(b.id, rows.length - 1); }
  for (let i = 1; i < cols.length; i++) if (cols[i]!.l < cols[i - 1]!.r + 2 * PLAN_MARGIN) return out;
  for (let j = 1; j < rows.length; j++) if (rows[j]!.t < rows[j - 1]!.b + 2 * PLAN_MARGIN) return out;
  // Gap i lies right of column i (−1: left of the first); row gap j under row j (−1: over the first).
  const gapX = (i: number) => ({ l: i < 0 ? cols[0]!.l - PLAN_OUTER : cols[i]!.r, r: i + 1 >= cols.length ? cols.at(-1)!.r + PLAN_OUTER : cols[i + 1]!.l });
  const gapY = (j: number) => ({ t: j < 0 ? rows[0]!.t - PLAN_OUTER : rows[j]!.b, b: j + 1 >= rows.length ? rows.at(-1)!.b + PLAN_OUTER : rows[j + 1]!.t });
  type Run = { key: string; gap: number; lo: number; hi: number; fam: 'l' | 'r' | 't'; entry: boolean };
  const vr: Run[] = [], hr: Run[] = [], plan = new Map<string, { xg: number[]; yg: number[] }>();
  const mid = (b: PlanBox) => b.y + b.h / 2, cx = (b: PlanBox) => b.x + b.w / 2;
  for (const s of strokes) {
    const a = byId.get(s.from), b = byId.get(s.to); if (!a || !b || a === b) continue;
    const ca = colOf.get(a.id)!, cb = colOf.get(b.id)!, ra = rowOf.get(a.id)!, rb = rowOf.get(b.id)!;
    const exitG = cb >= ca ? ca : ca - 1, entryG = cb > ca ? cb - 1 : cb;
    // Whether b stands right of its entry gap (the run into it is counted from the gap's left edge).
    const bRight = cb > ca, aLeft = cb >= ca;
    const straight = exitG === entryG && (ra === rb ? Math.abs(ca - cb) <= 1 : true) && !under.has(s.key);
    if (straight) {
      vr.push({ key: s.key, gap: exitG, lo: Math.min(mid(a), mid(b)), hi: Math.max(mid(a), mid(b)), fam: bRight ? 'l' : 'r', entry: true });
      plan.set(s.key, { xg: [exitG], yg: [] }); continue;
    }
    const yg = ra === rb ? (under.has(s.key) ? ra : ra) : rb > ra ? rb - 1 : rb;
    const y = gapY(yg), ym = (y.t + y.b) / 2;
    vr.push({ key: s.key, gap: exitG, lo: Math.min(mid(a), ym), hi: Math.max(mid(a), ym), fam: aLeft ? 'l' : 'r', entry: false });
    vr.push({ key: s.key, gap: entryG, lo: Math.min(mid(b), ym), hi: Math.max(mid(b), ym), fam: bRight ? 'l' : 'r', entry: true });
    const xa = gapX(exitG), xb = gapX(entryG);
    hr.push({ key: s.key, gap: yg, lo: Math.min(xa.l, xb.l), hi: Math.max(xa.r, xb.r), fam: 't', entry: false });
    plan.set(s.key, { xg: [exitG, entryG], yg: [yg] });
    void cx;
  }
  // Tracks: entries first (their last runs are the arrowheads'), then the rest; a track is shared by runs whose spans keep apart.
  const tracks = (runs: Run[]) => { const at = new Map<string, number>(); const used = new Map<string, Run[]>();
    for (const r of [...runs].sort((p, q) => Number(q.entry) - Number(p.entry) || p.lo - q.lo)) {
      for (let k = 0; ; k++) { const id = `${r.gap}|${r.fam}|${k}`, list = used.get(id) ?? []; if (list.every(o => r.hi + 8 < o.lo || o.hi + 8 < r.lo)) { list.push(r); used.set(id, list); at.set(`${r.key}|${r.gap}|${r.entry ? 1 : 0}`, k); break; } }
    }
    return at; };
  const tv = tracks(vr), th = tracks(hr);
  const trackX = (g: number, fam: 'l' | 'r', k: number) => { const x = gapX(g), room = Math.max(0, x.r - x.l - 2 * PLAN_MARGIN), off = Math.min(room, k * PLAN_TRACK); return fam === 'l' ? x.l + PLAN_MARGIN + off : x.r - PLAN_MARGIN - off; };
  for (const [key, p] of plan) {
    const rs = vr.filter(r => r.key === key);
    const xs = p.xg.map((g, i) => { const r = rs.find(x => x.gap === g && (p.xg.length === 1 || x.entry === (i === 1)))!; return trackX(g, r.fam as 'l' | 'r', tv.get(`${key}|${g}|${r.entry ? 1 : 0}`) ?? 0); });
    const ys = p.yg.map(j => { const y = gapY(j), room = Math.max(0, y.b - y.t - 2 * PLAN_MARGIN); return y.t + PLAN_MARGIN + Math.min(room, (th.get(`${key}|${j}|0`) ?? 0) * PLAN_TRACK); });
    out.set(key, { xs, ys });
  }
  return out;
}

/* ---------- the morph ---------- */
/** The switch's motion (ms): the lines step out, the cards fly to their new places (eased), the lines come back on their new routes. */
export const FORM_LINES_OUT_MS = 120, FORM_FLY_MS = 520, FORM_LINES_IN_MS = 220;
/** Ease-in-out (cubic) for the flight. */
export const formEase = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
