/* The growing map on screen (rulings F6 Q4, Q5 and F7; map-growth.ts). The map stays the same map: time is something one chooses to look at.
 * - Entry: a quiet chip by the lens bar when the visit's baseline differs from the current version (「이전 방문 · 지도 v04 → 지도 v07」), and
 *   the 「지도 이력」 menu in the tools (every version: number, reading time, 기록 대상 판본; pick a baseline, or open a past version).
 * - Compare (F7): the map with its first change scene open. The top box says 「지도 변화 · v04 → v17」 and at most two sentences made only of
 *   the change ledger (kinds, names before and after, versions, counts), each clause a way to its scene or list. One 32px line under the
 *   lens bar counts the changes in the scene order (정정 · 승계 · 은퇴 · 구현 상태 · … · 연결 +56 −4), then the two filters 「설명 변경 9개
 *   보기」 and 「지도에 새로 표시 23개」, and 「대기·보류 66행」 (기록 반영 상태, its own count, never added to the changes) at its right end.
 * - At most three text tabs on cards at a time (the scene shown first, the next ones in the scene order quieter); never a tab for 새 or 설명
 *   until its filter is on; 「+N」 is how many other kinds of change the card has.
 * - A scene: the top of the pane (kind, title, one sentence, 시점, 이유, 이전 모습 / 현재 모습 / 이전 변화 / 다음 변화 / 원문, 「변화 장면 1/N」).
 * Pure helpers (the scenes and their order, the guide, the items, tabs and their places, names and code) are exported for tests; the DOM
 * pieces take what they show and callbacks. */
import { h } from './plan-dom.js';
import { josa } from '../shared/josa.js';
import { faceSplit, facePlain, faceCounts as faceCountsOf } from './face-name.js';
import { CHANGE_WORD, CHANGE_KINDS, SCENE_ORDER, SUMMARY_ORDER, ROW_STATE_WORD, versionLabel, type ChangeKind, type ChangeSet, type PartChange, type MapVersion, type Unreflected, type ReflectGroup } from '../shared/map-growth.js';

/* ---------- names and words ---------- */
/** A name as a sentence says it (F7; review of v7: exactly as its card's face says it, face-name.ts): a person's-words name keeps its
 * words, and a code identifier in brackets after it (「소비 폴더 감시기(document_consumer)」) is a secondary identifier, said in the selected
 * detail; it stays when it is the only thing that tells two names apart (others: the map's names). A bracket of plain words
 * (「문서 소비기(Consumer)」) is the name's own. */
export const plainName = (name: string, others: readonly string[] = []): string => facePlain(name, others);
/** The secondary identifier plainName leaves out (null: none), among the map's names as plainName reads them. */
export function auxName(name: string, others: readonly string[] = []): string | null {
  return faceSplit(name, faceCountsOf(others.includes(name) ? others : [...others, name])).ident;
}
/** The particle after a word (shared/josa.ts): josa('cronjob', '을/를') → '을'. */
export { josa };
/** Words a guide or a scene never says (F7: no evaluation, cause or time made up). */
export const GUIDE_BANNED: readonly string[] = Object.freeze(['개발됐', '안정적', '이를 위해', '핵심']);

/* ---------- code in the growth view's own text (F7: quiet monospace, never bold, filled or bordered; nothing reworded or left out) ---------- */
const CODE_RUN = /`[^`]+`|[A-Za-z_][A-Za-z0-9_./:%#-]*(?:\([^()\s]*\))?/g;
/** Whether a run of ASCII reads as code: an identifier with an underscore or a camelCase hump, a path or file name, a call. Plain words
 * (Broker, Consumer, OCR, WebSocket) are words; a camelCase identifier starts in lower case. */
export const isCode = (t: string): boolean => /^`.+`$/.test(t) || (t.length >= 3 && (/_/.test(t) || /^[a-z]+[A-Z]/.test(t) || /\//.test(t) || /\.[A-Za-z]/.test(t) || /\(.*\)$/.test(t)));
/** A text in pieces: words as they are, code runs marked (every character kept, in order). */
export function codePieces(text: string): { text: string; code: boolean }[] {
  const out: { text: string; code: boolean }[] = []; let at = 0;
  for (const m of text.matchAll(CODE_RUN)) {
    if (!isCode(m[0])) continue;
    if (m.index! > at) out.push({ text: text.slice(at, m.index), code: false });
    out.push({ text: m[0], code: true }); at = m.index! + m[0].length;
  }
  if (at < text.length) out.push({ text: text.slice(at), code: false });
  return out;
}
/** The text as nodes: code runs in a quiet monospace span (12px, the text's own weight and colour, no fill, no border). */
export const codeText = (text: string): (string | HTMLElement)[] => codePieces(text).map(p => (p.code ? h('span', { class: 'g-code' }, p.text) : p.text));

/* ---------- scenes (F7: 먼저 보여주는 순서, never an importance) ---------- */
export interface Scene { part: string; main: PartChange; changes: PartChange[] }
const orderOf = (k: ChangeKind) => SCENE_ORDER.indexOf(k);
/** The change scenes in their order: one per changed part, at its first kind in the scene order (정정 > 승계 > 후계 없는 은퇴 > 구현 상태 >
 * 이름 > 설명 > 중복 정리 > 새; 구현 바뀜 by 구현 상태, 통합 by 중복 정리); a retirement a 승계 holds is that 승계's scene, never its own. Within a
 * kind, the change set's order. */
export function changeScenes(cs: ChangeSet): Scene[] {
  const by = new Map<string, PartChange[]>(), first = new Map<string, number>();
  cs.changes.forEach((c, i) => {
    if (c.kind === 'retire' && c.successor) return;
    by.set(c.part, [...by.get(c.part) ?? [], c]); if (!first.has(c.part)) first.set(c.part, i);
  });
  return [...by].map(([part, list]) => { const changes = [...list].sort((a, b) => orderOf(a.kind) - orderOf(b.kind)); return { part, main: changes[0]!, changes }; })
    .sort((a, b) => orderOf(a.main.kind) - orderOf(b.main.kind) || first.get(a.part)! - first.get(b.part)!);
}
/** The kind as a scene names it (F7). */
export function sceneKind(c: PartChange): string {
  switch (c.kind) {
    case 'succeed': return '기록된 승계';
    case 'retire': return c.named ? '기록된 은퇴 · 대신하는 부품은 지금 지도에 없음' : '기록된 은퇴 · 대신하는 부품 없음';
    case 'correct': return c.by === 'record' ? '정정 · 기록이 적은 철회' : '정정 · 사람이 바로잡은 설명';
    case 'impl': return c.impl?.mode === 'add' ? '구현 정보 추가' : '구현 상태 변경';
    case 'reimpl': return '구현 바뀜';
    case 'rename': return '이름 변경';
    case 'desc': return c.by === 'person' ? '설명 변경 · 사람이 새로 씀' : '설명 변경';
    case 'dedupe': return '중복 정리';
    case 'merge': return '통합';
    default: return '지도에 새로 표시';
  }
}
type Name = (id: string) => string;
/** A name given as text (a rename's before and after) as the card's face says it (review of v7: one helper for every name). */
type Say = (name: string) => string;
const q = (n: string) => `‘${n}’`;
/** A scene's title (F7: 「cronjob → 소비 폴더 감시기」). */
export function sceneTitle(c: PartChange, nm: Name, say: Say = n => plainName(n)): string {
  switch (c.kind) {
    case 'succeed': return `${nm(c.predecessor!)} → ${nm(c.part)}`;
    case 'rename': return `${say(c.before ?? '')} → ${say(c.after ?? '')}`;
    case 'reimpl': case 'impl': return `${c.before ?? '정보 없음'} → ${c.after ?? ''}`;
    case 'dedupe': return `${[...(c.others ?? []).map(nm), nm(c.part)].join(' · ')} → ${nm(c.part)}`;
    default: return nm(c.part);
  }
}
/** A scene's one sentence: what the change ledger says, as the record has it; no evaluation, cause or time. */
export function sceneSentence(c: PartChange, nm: Name, say: Say = n => plainName(n)): string {
  const n = nm(c.part);
  switch (c.kind) {
    case 'succeed': return `${q(n)}${josa(n, '이/가')} ${q(nm(c.predecessor!))}${josa(nm(c.predecessor!), '을/를')} 대신한다는 기록이 반영됐습니다.`;
    // Review of v7: a successor the record names that is off the map is never 「none in the record」.
    case 'retire': return `${q(n)}${josa(n, '이/가')} 은퇴했다는 기록이 반영됐습니다. ${c.named ? '대신하는 부품은 지금 지도에 없습니다.' : '대신하는 부품은 기록에 없습니다.'}`;
    case 'correct': return c.by === 'record' ? `기록이 ${q(n)}에 대한 철회를 적었습니다.` : `${q(n)}의 설명이 틀렸다고 사람이 바로잡았습니다.`;
    case 'impl': return c.impl?.mode === 'add' ? `${q(n)}에 구현 정보 ${q(c.after ?? '')}${josa(c.after ?? '', '이/가')} 더해졌습니다. 구현됨은 가동 중이라는 뜻이 아닙니다.`
      : `${q(n)}의 구현 상태가 ${q(c.before ?? '')}에서 ${q(c.after ?? '')}${josa(c.after ?? '', '으로/로')} 기록됐습니다.`;
    case 'reimpl': return `${q(n)}의 구현이 ${q(c.before ?? '')}에서 ${q(c.after ?? '')}${josa(c.after ?? '', '으로/로')} 바뀌었다는 기록이 반영됐습니다.`;
    case 'rename': { const a = say(c.after ?? n); return `${q(say(c.before ?? ''))}의 이름이 ${q(a)}${josa(a, '으로/로')} 바뀌었다는 기록이 반영됐습니다.`; }
    case 'desc': return c.by === 'person' ? `${q(n)}의 설명을 사람이 새로 썼습니다.` : `${q(n)}의 설명이 같은 부품에 대한 새 설명으로 바뀌었습니다.`;
    case 'dedupe': return `지도가 두 번 만든 ${q(n)}${josa(n, '을/를')} 하나로 정리했습니다.`;
    case 'merge': return `${q(n)}에 다른 부품을 합쳤다는 기록이 반영됐습니다.`;
    default: return `${q(n)}${josa(n, '이/가')} 지도에 새로 표시됐습니다.`;
  }
}
/** 「변화 장면 1/N」, or a filter's 「설명 변경 1/9」. */
export const stepWord = (filter: 'new' | 'desc' | null, i: number, n: number): string => `${filter === 'new' ? '지도에 새로 표시' : filter === 'desc' ? '설명 변경' : '변화 장면'} ${i + 1}/${n}`;

/* ---------- the guide (F7: 「지도 변화 · v04 → v17」 and at most two sentences, in the top box's place) ---------- */
/** One clause of the guide: its words, where it leads (a scene, or a kind's list or filter) and the ledger fact it says (kind, count, parts). */
export interface GuideSeg { text: string; to: { scene: string } | { kind: SummaryKey } | null; fact: { kind: ChangeKind | null; count: number | null; parts: string[] } | null }
export interface Guide { head: string; sentences: GuideSeg[][] }
const short = (n: number) => `v${String(n).padStart(2, '0')}`;
/** How a kind is counted in the guide's second sentence (a noun phrase with its count). */
const PHRASE: Readonly<Record<ChangeKind, (n: number) => string>> = Object.freeze({
  correct: n => `정정이 적힌 부품 ${n}개`, succeed: n => `승계 ${n}건`, retire: n => `지금 지도에 대신하는 부품이 없는 은퇴 부품 ${n}개`, impl: n => `구현 상태 기록이 달라진 부품 ${n}개`,
  reimpl: n => `구현이 바뀐 부품 ${n}개`, rename: n => `이름이 달라진 부품 ${n}개`, desc: n => `설명이 바뀐 부품 ${n}개`, dedupe: n => `중복을 정리한 부품 ${n}개`, merge: n => `합쳐진 부품 ${n}개`,
  new: n => `지도에 새로 표시된 부품 ${n}개` });
/** The lead of the second sentence when the first sentence's kind has more than one change (「승계는 총 2건이며,」). */
const LEAD: Readonly<Record<ChangeKind, string>> = Object.freeze({ correct: '정정', succeed: '승계', retire: '지금 지도에 대신하는 부품이 없는 은퇴', impl: '구현 상태 기록의 변화', reimpl: '구현 바뀜',
  rename: '이름 변경', desc: '설명 변경', dedupe: '중복 정리', merge: '통합', new: '새로 표시된 부품' });
/** How many changes of a kind the guide and the line count: a retirement a 승계 holds counts in that 승계. */
export const kindCount = (cs: ChangeSet, k: ChangeKind): number => (k === 'retire' ? cs.changes.filter(c => c.kind === 'retire' && !c.successor).length : cs.counts[k]);
/** The guide: its head, the first scene in one named sentence (the change shown first), and the counts in a second (the first scene's kind
 * when it has more, then up to three other kinds in the scene order, 지도에 새로 표시 always last when there is any; 설명 has its own
 * filter on the line). Only confirmed changes: a held row or a candidate is never one. */
export function guideOf(cs: ChangeSet, scenes: readonly Scene[], nm: Name, say: Say = n => plainName(n)): Guide {
  const head = `지도 변화 · ${short(cs.from)} → ${short(cs.to)}`, first = scenes[0];
  if (!first) return { head, sentences: [[{ text: '두 지도 버전 사이에 반영된 구조 변화가 없습니다.', to: null, fact: null }]] };
  const c = first.main, n = nm(c.part);
  const s1: GuideSeg = { text: c.kind === 'succeed' ? `${q(nm(c.predecessor!))}${josa(nm(c.predecessor!), '을/를')} ${q(n)}${josa(n, '이/가')} 대신한다는 기록이 반영됐습니다.` : sceneSentence(c, nm, say).split(/(?<=다\.)\s/)[0]!,
    to: { scene: first.part }, fact: { kind: c.kind, count: null, parts: [c.part, ...(c.predecessor ? [c.predecessor] : [])] } };
  const kinds = SCENE_ORDER.filter(k => k !== 'desc' && k !== c.kind && kindCount(cs, k) > 0);
  const pick = kinds.includes('new') ? [...kinds.filter(k => k !== 'new').slice(0, 2), 'new' as const] : kinds.slice(0, 3);
  const s2: GuideSeg[] = [], total = kindCount(cs, c.kind);
  if (total > 1) { const w = LEAD[c.kind]; s2.push({ text: `${w}${josa(w, '은/는')} 총 ${total}${c.kind === 'succeed' || c.kind === 'correct' ? '건' : '개'}`, to: { kind: c.kind }, fact: { kind: c.kind, count: total, parts: [] } }); }
  const phrases = pick.map(k => ({ k, text: PHRASE[k](kindCount(cs, k)) }));
  if (s2.length) s2.push({ text: phrases.length ? '이며, ' : '입니다.', to: null, fact: null });
  phrases.forEach((p, i) => {
    s2.push({ text: p.text, to: { kind: p.k }, fact: { kind: p.k, count: kindCount(cs, p.k), parts: [] } });
    const last = i === phrases.length - 1;
    s2.push({ text: last ? `${josa(p.text, '이/가')} 있습니다.` : i === phrases.length - 2 ? `${josa(p.text, '과/와')} ` : ', ', to: null, fact: null });
  });
  return { head, sentences: s2.length ? [[s1], s2] : [[s1]] };
}
/** Every change the line counts (a retirement a 승계 holds counted in that 승계; the lines apart). */
export const kindTotal = (cs: ChangeSet): number => CHANGE_KINDS.reduce((a, k) => a + kindCount(cs, k), 0);
/** Review of v7 (first user, a): why 「변화 장면 1/32」 and the line's items (summing to 36) differ, in one line; null when they agree. */
export function sceneWhy(cs: ChangeSet, scenes: readonly Scene[]): string | null {
  const n = kindTotal(cs); if (n === scenes.length) return null;
  return `장면은 부품마다 하나 · 변화 ${n}건이 부품 ${scenes.length}개에 있어 한 부품의 여러 변화는 한 장면에 함께 보임`;
}
export const guideText = (g: Guide): string => g.sentences.map(s => s.map(x => x.text).join('')).join(' ');

/* ---------- the summary line ---------- */
export type SummaryKey = ChangeKind | 'lines';
export interface SummaryItem { key: SummaryKey; text: string; count: number; filter: boolean }
/** The line's items with a nonzero count, in the scene order (a retirement a 승계 holds is counted there), the lines (+ added − removed),
 * then the two filters (F7): 「설명 변경 N개 보기」 and 「지도에 새로 표시 N개」. */
export function summaryItems(cs: ChangeSet): SummaryItem[] {
  const out: SummaryItem[] = [];
  for (const k of SUMMARY_ORDER) { const n = kindCount(cs, k); if (n) out.push({ key: k, text: `${CHANGE_WORD[k]} ${n}`, count: n, filter: false }); }
  if (cs.added.length || cs.removed.length) out.push({ key: 'lines', text: `연결${cs.added.length ? ` +${cs.added.length}` : ''}${cs.removed.length ? ` −${cs.removed.length}` : ''}`, count: cs.added.length + cs.removed.length, filter: false });
  if (cs.counts.desc) out.push({ key: 'desc', text: `설명 변경 ${cs.counts.desc}개 보기`, count: cs.counts.desc, filter: true });
  if (cs.counts.new) out.push({ key: 'new', text: `지도에 새로 표시 ${cs.counts.new}개`, count: cs.counts.new, filter: true });
  return out;
}
/** The whole line as words (its accessible name, and what tests read). */
export const summaryText = (cs: ChangeSet): string => [`${versionLabel(cs.from)} → ${versionLabel(cs.to)}`, ...summaryItems(cs).map(i => i.text)].join(' · ');
/** With nothing changed between the two versions. */
export const NO_CHANGE = '구조 변화 없음';
/** 기록 반영 상태's entry (F7): the waiting and held rows of the later version, never the rejected ones, never a record not yet read. */
export const waitingWord = (n: number): string => `대기·보류 ${n}행`;

/* ---------- the card tabs ---------- */
/** A card tab's word for a kind (review of v7: the panel's own words for its two filters, 「새로 표시」 and 「설명 변경」). */
export const tabKindWord = (k: ChangeKind): string => (k === 'new' ? '새로 표시' : k === 'desc' ? '설명 변경' : CHANGE_WORD[k]);
export const tabWord = (c: PartChange): string => (c.kind === 'dedupe' ? `중복 정리 ${(c.others?.length ?? 1) + 1}→1` : tabKindWord(c.kind));
/** At most three tabs at a time. */
export const TAB_CAP = 3;
export interface CardTab { part: string; word: string; more: number; kind: ChangeKind; on: boolean; changes: PartChange[] }
/** The tabs shown (F7: at most three always-on; the change shown first, the next scenes in the scene order quieter; no tab for 새 or 설명 by
 * default; 「+N」 = how many other kinds of change the card has). A filter's current part shows the filter's word. A retired part is not on
 * the current map: it has no tab. */
export function shownTabs(scenes: readonly Scene[], current: string | null, filter: 'new' | 'desc' | null): CardTab[] {
  const kinds = (s: Scene) => new Set(s.changes.map(c => c.kind)).size;
  const tabOf = (s: Scene, on: boolean, kind: ChangeKind = s.main.kind): CardTab => ({ part: s.part, word: kind === s.main.kind ? tabWord(s.main) : tabKindWord(kind), more: kinds(s) - 1, kind, on, changes: s.changes });
  const out: CardTab[] = [], cur = current ? scenes.find(s => s.part === current) : undefined;
  // The shown scene's own tab, but never a 새 tab with no filter on (F7: no 새 tab by default; its card is outlined all the same).
  if (cur && cur.main.kind !== 'retire' && (cur.main.kind !== 'new' || filter === 'new')) out.push(tabOf(cur, true, filter && cur.changes.some(c => c.kind === filter) ? filter : cur.main.kind));
  for (const s of scenes) {
    if (out.length >= TAB_CAP) break;
    if (s.part === current || s.main.kind === 'new' || s.main.kind === 'desc' || s.main.kind === 'retire') continue;
    out.push(tabOf(s, false));
  }
  return out;
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

/* ---------- the camera (F7) ---------- */
/** Whether a scene's card is readable where it is: wholly inside the area (in screen pixels). Then the camera never moves. */
export const readableInView = (card: Rect, area: Rect): boolean => card.x >= area.x && card.y >= area.y && card.x + card.w <= area.x + area.w && card.y + card.h <= area.y + area.h;
/** The least pan (screen pixels) that brings a card (its first 420×220 at most) inside the area with a margin; [0, 0] when it is readable
 * already. Never a zoom. */
export function leastPan(card: Rect, area: Rect, margin = 16): [number, number] {
  if (readableInView(card, area)) return [0, 0];
  const w = Math.min(card.w, 420), hh = Math.min(card.h, 220), L = area.x + margin, R = area.x + area.w - margin, T = area.y + margin, B = area.y + area.h - margin;
  let dx = 0, dy = 0;
  if (card.x + w > R) dx = R - (card.x + w); if (card.x + dx < L) dx = L - card.x;
  if (card.y + hh > B) dy = B - (card.y + hh); if (card.y + dy < T) dy = T - card.y;
  return [dx, dy];
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
export interface LineHandlers { pick: (k: SummaryKey) => void; reflect: () => void; history: () => void; exit: () => void }
/** The 32px compare line: the two versions, the counts, the two filters, 「대기·보류 N행」 at the right end and the way out. */
export function compareLine(cs: ChangeSet, picked: SummaryKey | null, waiting: number | null, on: LineHandlers): HTMLElement {
  const items = summaryItems(cs);
  return h('div', { class: 'gl-row', role: 'toolbar', 'aria-label': `비교 · ${summaryText(cs)}` },
    h('button', { type: 'button', class: 'gl-pair', title: '기준 바꾸기 · 지도 이력', onclick: on.history }, `${versionLabel(cs.from)} → ${versionLabel(cs.to)}`),
    ...(items.length ? items.flatMap(i => [h('span', { class: 'gl-dot', 'aria-hidden': 'true' }, '·'),
      h('button', { type: 'button', class: `gl-item k-${i.key}${i.filter ? ' gl-filter' : ''}${picked === i.key ? ' on' : ''}`, 'aria-pressed': String(picked === i.key), title: itemTip(i.key), onclick: () => on.pick(i.key) }, i.text)])
      : [h('span', { class: 'gl-dot', 'aria-hidden': 'true' }, '·'), h('span', { class: 'gl-none' }, NO_CHANGE)]),
    h('span', { class: 'gl-gap' }),
    waiting !== null ? h('button', { type: 'button', class: `gl-un${waiting ? '' : ' zero'}`, title: `기록 반영 상태 · 지도 ${short(cs.to)} 기준 · 기록의 행 가운데 지도에 아직 들어가지 않은 대기·보류 행 (변화 집계와 따로 셈)`, onclick: on.reflect }, waitingWord(waiting)) : null,
    h('button', { type: 'button', class: 'gl-exit', title: '비교 끝내기 · 비교 전에 고른 카드와 보던 위치로 돌아가요', 'aria-label': '비교 끝내기 · 고른 카드와 위치는 비교 전대로', onclick: on.exit }, '×'));
}
const itemTip = (k: SummaryKey): string => ({ new: '기준 지도보다 새로 표시된 부품 · 새로 만들었다는 뜻이 아님 · 누르면 지도에서 밝히고 목록으로 하나씩 보기', rename: '이름이 바뀐 부품', reimpl: '같은 부품, 기록이 구현이 바뀌었다고 적음',
  impl: '기록의 구현 상태 칸이 달라진 부품 (구현 상태 변경 · 구현 정보 추가) · 가동 여부가 아님', desc: '같은 부품에 대한 새 설명이 채택되었거나 사람이 설명을 새로 쓴 부품 · 누르면 지도에서 밝히고 하나씩 보기', correct: '오류나 철회가 적힌 정정 (기록의 철회, 사람이 바로잡은 설명) · 문구를 다듬은 것은 설명 변경',
  dedupe: '지도가 만든 같은 부품 둘을 하나로 정리', merge: '기록이 합쳤다고 적은 부품', succeed: '은퇴한 부품을 대신하는 부품', retire: '지금 지도에 대신하는 부품이 없는 은퇴 부품 · 은퇴한 부품은 지금 지도에 없음', lines: '더해진 연결과 빠진 연결' } as Record<SummaryKey, string>)[k] + (k === 'new' || k === 'desc' ? '' : ' · 누르면 목록');
/** The scene's line over the earlier description: a person's correction is never a description update, and the other way round. */
export const wasLabel = (kind: 'desc' | 'correct' | null, target: string | null, by: PartChange['by'] = undefined): string => (kind === 'correct' ? '이전 설명 · 사람이 고친 설명으로 바뀜'
  : kind === 'desc' && by === 'person' ? '이전 설명 · 사람이 새로 쓴 설명으로 바뀜'
  : target ? `이전 설명 · 대상 ${target} 기록의 설명으로 갱신됨` : '이전 설명 · 같은 부품에 대한 새 설명이 채택됨');
/** A 새 change's line in its scene: the version whose reading made the part, or the person who added it and when. */
export const newTitle = (c: PartChange, from: number): string => (c.by === 'person' ? `사람이 추가함${c.madeAt && time(c.madeAt) ? ` · ${time(c.madeAt)}` : ''}`
  : c.since ? `${versionLabel(c.since)}에서 처음 표시됨` : `${versionLabel(from)} 뒤에 처음 표시됨`);
/** The past view's banner: what is drawn and the way back. */
export function pastBanner(n: number, applied: number, undated: number, onNow: () => void): HTMLElement {
  const main = applied ? `${versionLabel(n)} 보기 중 · 기록과 날짜가 남은 사람 편집 ${applied}건으로 다시 그림 (날짜 없는 사람 편집은 포함하지 않음)` : `${versionLabel(n)} 보기 중 · 기록만으로 다시 그림 (그때의 사람 편집은 포함하지 않음)`;
  return h('div', { class: 'gp-row', role: 'status' }, h('span', { class: 'gp-text' }, main),
    undated ? h('span', { class: 'gp-fine', title: '편집 기록이 생기기 전에 사람이 고친 이름·설명, 보관·옮김·연결은 언제 했는지 몰라 넣지 않음 · 이름은 그때 기록의 이름' }, `날짜 없는 편집 ${undated}건 제외`) : null,
    h('span', { class: 'gp-fine' }, '읽기 전용'),
    h('button', { type: 'button', class: 'gp-now', title: '현재 지도로 · 고른 카드와 화면 위치는 그대로', onclick: onNow }, '현재로'));
}
/* 기록 반영 상태 (F7). */
/** A group's title and its line: 「문서 소비기에 관한 미반영 기록 3행」, 「연결 2행 · 단계 1행」, and 「이 부품은 현재 지도에 있습니다」 only for a part
 * checked by its ID on the map. */
export function groupTitle(g: ReflectGroup, name: (id: string) => string): { title: string; sub: string; onMap: boolean } {
  const n = g.rows.length, sub = g.byItem.map(x => `${x.item} ${x.n}행`).join(' · ');
  if (g.kind === 'part') return { title: `${name(g.part!)}에 관한 미반영 기록 ${n}행`, sub, onMap: true };
  // Review of v7: a part of a record no map part can be, by the record's own name for it (its rows together).
  if (g.kind === 'unplaced') return { title: `${g.name ? plainName(g.name) : '이름 없는 부분'}에 관한 미반영 기록 ${n}행`, sub: `${sub} · 이 부품은 아직 지도에 놓이지 않았습니다`, onMap: false };
  return { title: g.kind === 'several' ? `여러 부품 관련 기록 ${n}행` : g.kind === 'whole' ? `특정 부품을 가리키지 않는 기록 ${n}행` : `대상 미확정 기록 ${n}행`, sub, onMap: false };
}
/** One row: its state, 「연결 · 보내는 → 받는」 (the item's own title), why (plain words), the other parts it is about and the source line. */
export function reflectRow(x: Unreflected, name: (id: string) => string | null, on: { part: (id: string) => void; source: (x: Unreflected) => void }): HTMLElement {
  const parts = x.related.map(id => ({ id, name: name(id) })).filter((p): p is { id: string; name: string } => !!p.name);
  return h('li', { class: `gu-row s-${x.state}` },
    h('span', { class: 'gu-state' }, ROW_STATE_WORD[x.state]),
    h('span', { class: 'gu-body' },
      h('span', { class: 'gu-tried' }, h('span', { class: 'gu-item' }, `${x.item} · `), ...codeText(x.title)),
      x.unplaced ? h('span', { class: 'gu-why' }, '아직 지도에 놓이지 않음') : null,
      h('span', { class: 'gu-why' }, x.words),
      x.title !== x.tried && x.tried ? h('span', { class: 'gu-said' }, ...codeText(x.tried)) : null,
      h('span', { class: 'gu-foot' }, ...parts.map(p => h('button', { type: 'button', class: 'gu-part', title: `관련 부품 · ${p.name} · 지도에서 보기`, onclick: () => on.part(p.id) }, p.name)),
        h('button', { type: 'button', class: 'gu-src link-button', title: '원문의 그 줄 보기', onclick: () => on.source(x) }, `원문 ${x.line}번째 줄`))));
}
