/* The growing map on screen (ruling F6 Q4, Q5; map-growth.ts). The map stays the same map: time is something one chooses to look at.
 * - Entry: a quiet chip by the lens bar when the visit's baseline differs from the current version (「이전 방문 · 지도 v04 → 지도 v07」), and
 *   the 「지도 이력」 menu in the tools (every version: number, reading time, 기록 대상 판본; pick a baseline, or open a past version).
 * - Compare: one 32px line under the lens bar (「지도 v04 → 지도 v07 · 새 3 · 이름 1 · … · 연결 +4 −1 · 설명 28」, nonzero items only, each a
 *   button lighting its parts in place; 미반영 N at its right end), and on the changed cards a 20px text tab above the card (its main change
 *   word, 「+N」 for the rest), never overlapping another tab or a card and never part of the layout box.
 * - One change picked: its scene in the pane beside the card, which stays where it is.
 * Pure helpers (items, tabs and their places) are exported for tests; the DOM pieces take what they show and callbacks. */
import { h } from './plan-dom.js';
import { CHANGE_WORD, TAB_ORDER, SUMMARY_ORDER, ROW_STATE_WORD, versionLabel, type ChangeKind, type ChangeSet, type PartChange, type MapVersion, type Unreflected } from '../shared/map-growth.js';

/* ---------- the summary line ---------- */
export type SummaryKey = ChangeKind | 'lines';
export interface SummaryItem { key: SummaryKey; text: string; count: number }
/** The summary items with a nonzero count, in the line's order: the structure changes, the lines (+ added − removed), then 설명. */
export function summaryItems(cs: ChangeSet): SummaryItem[] {
  const out: SummaryItem[] = [];
  for (const k of SUMMARY_ORDER) if (cs.counts[k]) out.push({ key: k, text: `${CHANGE_WORD[k]} ${cs.counts[k]}`, count: cs.counts[k] });
  if (cs.added.length || cs.removed.length) out.push({ key: 'lines', text: `연결${cs.added.length ? ` +${cs.added.length}` : ''}${cs.removed.length ? ` −${cs.removed.length}` : ''}`, count: cs.added.length + cs.removed.length });
  if (cs.counts.desc) out.push({ key: 'desc', text: `설명 ${cs.counts.desc}`, count: cs.counts.desc });
  return out;
}
/** The whole line as words (its accessible name, and what tests read): 「지도 v04 → 지도 v07 · 새 3 · … · 설명 28」. */
export const summaryText = (cs: ChangeSet): string => [`${versionLabel(cs.from)} → ${versionLabel(cs.to)}`, ...summaryItems(cs).map(i => i.text)].join(' · ');
/** With nothing changed between the two versions. */
export const NO_CHANGE = '구조 변화 없음';

/* ---------- the card tabs ---------- */
export const tabWord = (c: PartChange): string => (c.kind === 'dedupe' ? `중복 정리 ${(c.others?.length ?? 1) + 1}→1` : CHANGE_WORD[c.kind]);
export interface CardTab { part: string; main: PartChange; word: string; more: number; changes: PartChange[] }
/** One tab per changed part on the later version (a retired part is not there: 은퇴 reads in the line and on its successor's 승계), its main
 * change first by TAB_ORDER. A description update tabs no card until the 설명 item is picked (showDesc); then it counts in 「+N」 too. */
export function cardTabs(cs: ChangeSet, showDesc: boolean): CardTab[] {
  const by = new Map<string, PartChange[]>();
  for (const c of cs.changes) { if (c.kind === 'retire' || (c.kind === 'desc' && !showDesc)) continue; by.set(c.part, [...by.get(c.part) ?? [], c]); }
  return [...by].map(([part, list]) => {
    const sorted = [...list].sort((a, b) => TAB_ORDER.indexOf(a.kind) - TAB_ORDER.indexOf(b.kind));
    return { part, main: sorted[0]!, word: tabWord(sorted[0]!), more: sorted.length - 1, changes: sorted };
  }).sort((a, b) => TAB_ORDER.indexOf(a.main.kind) - TAB_ORDER.indexOf(b.main.kind));
}
export interface Rect { x: number; y: number; w: number; h: number }
const meets = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** Where each tab goes (in map units): above its card's top edge, left-aligned, else right-aligned, else one tab-height higher (stacked),
 * else beside the card's top corner (left, then right); never over a placed tab, another card or a group's head. Tabs come in priority order; one that finds no place is hidden (its part still
 * counts in the line). gap: the room between a tab and its card, in map units. */
export function placeTabs(tabs: readonly { part: string; w: number; h: number }[], boxes: ReadonlyMap<string, Rect>, obstacles: readonly (Rect & { id: string })[], gap: number): Map<string, Rect | null> {
  const out = new Map<string, Rect | null>(), placed: Rect[] = [];
  for (const t of tabs) {
    const b = boxes.get(t.part); if (!b) { out.set(t.part, null); continue; }
    const tries: Rect[] = [];
    for (const lift of [0, 1]) {
      const y = b.y - gap - t.h - lift * (t.h + gap);
      tries.push({ x: b.x, y, w: t.w, h: t.h }, { x: b.x + b.w - t.w, y, w: t.w, h: t.h });
    }
    // No room above (rows close at this zoom): beside the card's top corner, still outside its box.
    tries.push({ x: b.x - gap - t.w, y: b.y, w: t.w, h: t.h }, { x: b.x + b.w + gap, y: b.y, w: t.w, h: t.h });
    const ok = tries.find(r => !placed.some(p => meets(p, r)) && !obstacles.some(o => o.id !== t.part && meets(o, r)));
    out.set(t.part, ok ?? null); if (ok) placed.push(ok);
  }
  return out;
}

/* ---------- the past view: parts that were there only then ---------- */
/** Places for the parts of a past version the current map does not have (laid out automatically around the pinned common parts), moved
 * clear of every pinned box of their container: under the lowest box there, side by side. Only those that meet a pinned box move. Returns
 * container-relative places, by container (as Positions). */
export function clearPastOnly(boxes: readonly { id: string; container: string; rel: { x: number; y: number }; x: number; y: number; w: number; h: number; kind: string }[], pinned: ReadonlySet<string>, gap = 32): Record<string, Record<string, { x: number; y: number }>> {
  const out: Record<string, Record<string, { x: number; y: number }>> = {};
  const byC = new Map<string, typeof boxes[number][]>();
  for (const b of boxes) if (b.kind !== 'ghost') byC.set(b.container, [...byC.get(b.container) ?? [], b]);
  for (const [c, list] of byC) {
    const pins = list.filter(b => pinned.has(b.id)), loose = list.filter(b => !pinned.has(b.id));
    const hit = loose.filter(b => pins.some(p => meets(p, b)) || loose.some(q => q !== b && meets(q, b) && q.id < b.id));
    if (!hit.length || !list.length) continue;
    const solid = list.filter(b => !hit.includes(b)), bottom = Math.max(...solid.map(b => b.y + b.h), ...hit.map(b => b.y)), left = Math.min(...list.map(b => b.x));
    let x = left;
    for (const b of hit) { (out[c] ??= {})[b.id] = { x: b.rel.x + (x - b.x), y: b.rel.y + (bottom + gap - b.y) }; x += b.w + gap; }
  }
  return out;
}

/* ---------- DOM pieces ---------- */
export const chipText = (base: number, now: number): string => `이전 방문 · ${versionLabel(base)} → ${versionLabel(now)}`;
const time = (at: string) => { const t = new Date(at); return Number.isNaN(t.getTime()) ? '' : new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(t); };
export interface HistoryHandlers { compare: (n: number) => void; view: (n: number) => void; close: () => void }
/** The 「지도 이력」 menu: every version, newest first, with its reading time and 기록 대상 판본; the current version, the visit's baseline and
 * the person's own baseline marked. */
export function historyMenu(versions: readonly MapVersion[], marks: { current: number; visit: number | null; pick: number | null; viewing: number | null }, on: HistoryHandlers): HTMLElement {
  const rows = [...versions].reverse().map(v => {
    const tags = [v.n === marks.current ? '현재' : null, v.n === marks.visit ? '이전 방문' : null, v.n === marks.pick ? '비교 기준' : null, v.n === marks.viewing ? '보는 중' : null].filter((x): x is string => !!x);
    return h('li', { class: `gh-row${v.n === marks.viewing ? ' viewing' : ''}` },
      h('span', { class: 'gh-n' }, versionLabel(v.n)),
      h('span', { class: 'gh-meta' }, h('span', { class: 'gh-at' }, time(v.at)), v.target ? h('span', { class: 'gh-target', title: '기록 대상 판본 · 이 버전을 만든 기록이 적은 대상' }, `대상 ${v.target}`) : null,
        ...tags.map(t => h('span', { class: 'gh-tag' }, t))),
      h('span', { class: 'gh-acts' },
        v.n < marks.current ? h('button', { type: 'button', class: 'gh-act', title: `${versionLabel(v.n)}을 기준으로 지금 지도와 비교 (기준으로 기억)`, onclick: () => on.compare(v.n) }, '기준으로 비교') : null,
        v.n < marks.current ? h('button', { type: 'button', class: 'gh-act', title: `${versionLabel(v.n)}을 기록만으로 다시 그려 보기 (읽기 전용)`, onclick: () => on.view(v.n) }, '이 버전 보기') : null));
  });
  return h('div', { class: 'gh-pop', role: 'dialog', 'aria-label': '지도 이력' },
    h('header', { class: 'gh-head' }, h('strong', {}, '지도 이력'), h('span', { class: 'gh-sub' }, `지도 버전 ${versions.length}개 · 지도를 한 번 읽을 때마다 하나`),
      h('button', { type: 'button', class: 'gh-x', 'aria-label': '지도 이력 닫기', onclick: on.close }, '×')),
    h('ol', { class: 'gh-list' }, ...rows));
}
export interface LineHandlers { pick: (k: SummaryKey) => void; unreflected: () => void; history: () => void; exit: () => void }
/** The 32px compare line: the two versions, the items, 미반영 N at the right end and the way out. */
export function compareLine(cs: ChangeSet, picked: SummaryKey | null, unreflected: number | null, on: LineHandlers): HTMLElement {
  const items = summaryItems(cs);
  return h('div', { class: 'gl-row', role: 'toolbar', 'aria-label': `비교 · ${summaryText(cs)}` },
    h('button', { type: 'button', class: 'gl-pair', title: '기준 바꾸기 · 지도 이력', onclick: on.history }, `${versionLabel(cs.from)} → ${versionLabel(cs.to)}`),
    ...(items.length ? items.flatMap(i => [h('span', { class: 'gl-dot', 'aria-hidden': 'true' }, '·'),
      h('button', { type: 'button', class: `gl-item k-${i.key}${picked === i.key ? ' on' : ''}`, 'aria-pressed': String(picked === i.key), title: itemTip(i.key), onclick: () => on.pick(i.key) }, i.text)])
      : [h('span', { class: 'gl-dot', 'aria-hidden': 'true' }, '·'), h('span', { class: 'gl-none' }, NO_CHANGE)]),
    h('span', { class: 'gl-gap' }),
    unreflected !== null ? h('button', { type: 'button', class: `gl-un${unreflected ? '' : ' zero'}`, title: '미반영 · 읽은 기록의 행 가운데 지도에 들어가지 않은 것 (대기 · 보류 · 거절)', onclick: on.unreflected }, `미반영 ${unreflected}`) : null,
    h('button', { type: 'button', class: 'gl-exit', title: '비교 끝내기 · 보던 렌즈와 선택, 화면으로', 'aria-label': '비교 끝내기', onclick: on.exit }, '×'));
}
const itemTip = (k: SummaryKey): string => ({ new: '새로 생긴 부품', rename: '이름이 바뀐 부품', reimpl: '같은 부품, 구현이 바뀜', desc: '같은 부품에 대한 새 설명이 채택됨 · 고르면 카드에 표시', correct: '사람이 고친 설명',
  dedupe: '지도가 만든 같은 부품 둘을 하나로 정리', merge: '기록이 합쳤다고 적은 부품', succeed: '은퇴한 부품을 대신하는 부품', retire: '기록이 은퇴시킨 부품 · 지금 지도에는 없음', lines: '더해진 연결과 빠진 연결' } as Record<SummaryKey, string>)[k] + ' · 누르면 지도에서 밝힘';
/** The past view's banner: what is drawn and the way back. */
export function pastBanner(n: number, applied: number, undated: number, onNow: () => void): HTMLElement {
  const main = applied ? `${versionLabel(n)} 보기 중 · 기록과 날짜가 남은 사람 편집 ${applied}건으로 다시 그림 (날짜 없는 사람 편집은 포함하지 않음)` : `${versionLabel(n)} 보기 중 · 기록만으로 다시 그림 (그때의 사람 편집은 포함하지 않음)`;
  return h('div', { class: 'gp-row', role: 'status' }, h('span', { class: 'gp-text' }, main),
    undated ? h('span', { class: 'gp-fine', title: '편집 기록이 생기기 전에 사람이 한 보관·옮김·연결은 언제 했는지 몰라 넣지 않음' }, `날짜 없는 편집 ${undated}건 제외`) : null,
    h('span', { class: 'gp-fine' }, '읽기 전용'),
    h('button', { type: 'button', class: 'gp-now', onclick: onNow }, '현재로'));
}
/** One row of the 미반영 panel: what it tried, why (plain words), the part it is about and the source line. */
export function unreflectedRow(x: Unreflected, name: (id: string) => string | null, on: { part: (id: string) => void; source: (x: Unreflected) => void }): HTMLElement {
  const parts = x.parts.map(id => ({ id, name: name(id) })).filter((p): p is { id: string; name: string } => !!p.name);
  return h('li', { class: `gu-row s-${x.state}` },
    h('span', { class: 'gu-state' }, ROW_STATE_WORD[x.state]),
    h('span', { class: 'gu-body' },
      h('span', { class: 'gu-tried' }, x.tried || '내용 없는 행'),
      h('span', { class: 'gu-why' }, x.words),
      h('span', { class: 'gu-foot' }, ...parts.map(p => h('button', { type: 'button', class: 'gu-part', title: `${p.name} · 지도에서 보기`, onclick: () => on.part(p.id) }, p.name)),
        h('button', { type: 'button', class: 'gu-src link-button', title: '원문의 그 줄 보기', onclick: () => on.source(x) }, `원문 ${x.line}번째 줄`))));
}
