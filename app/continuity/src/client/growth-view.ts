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
import { CHANGE_WORD, CHANGE_KINDS, SCENE_ORDER, SUMMARY_ORDER, ROW_STATE_WORD, versionLabel, historyWord, type ChangeKind, type ChangeSet, type PartChange, type MapVersion, type Unreflected, type ReflectGroup } from '../shared/map-growth.js';

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
    // Review of v8 (first user, e): the kind with its two ends.
    case 'impl': return c.impl?.mode === 'add' ? '구현 정보 추가' : `구현 상태 변경 · ${c.before ?? '정보 없음'} → ${c.after ?? ''}`;
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
    case 'reimpl': return `${c.before ?? '정보 없음'} → ${c.after ?? ''}`;
    // Review of v8 (first user, e): the part by its name (its kind line says the two ends).
    case 'impl': return nm(c.part);
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
  const tabOf = (s: Scene, on: boolean, kind: ChangeKind = s.main.kind): CardTab => ({ part: s.part, word: kind === s.main.kind ? tabWord(s.main) : tabKindWord(kind), more: otherKinds(s.changes), kind, on, changes: s.changes });
  const out: CardTab[] = [], cur = current ? scenes.find(s => s.part === current) : undefined;
  // The shown scene's own tab, whatever its kind (v10, review of v9: a 새 scene's card had no mark on one map while the other map's had its
  // tab); the quieter tabs of the next scenes still leave out 새 and 설명.
  if (cur && cur.main.kind !== 'retire') out.push(tabOf(cur, true, filter && cur.changes.some(c => c.kind === filter) ? filter : cur.main.kind));
  for (const s of scenes) {
    if (out.length >= TAB_CAP) break;
    if (s.part === current || s.main.kind === 'new' || s.main.kind === 'desc' || s.main.kind === 'retire') continue;
    out.push(tabOf(s, false));
  }
  return out;
}
/** Review of v8 (first user, b): how many other kinds of change a card has (its tab's 「+N」 and the pane's 「이 카드의 다른 변화 N가지」). */
export const otherKinds = (changes: readonly PartChange[]): number => Math.max(0, new Set(changes.map(c => c.kind)).size - 1);
/** A tab's tooltip: what its word is and what 「+N」 counts (the other kinds of change on that card, by name). */
export function tabTip(t: Pick<CardTab, 'kind' | 'more' | 'changes' | 'word'>): string {
  const rest = [...new Set(t.changes.filter(c => c.kind !== t.kind).map(c => c.kind))].map(tabKindWord);
  return `${t.word}${t.more ? ` · +${t.more}: 이 카드의 다른 변화 ${t.more}가지 (${rest.join(' · ')})` : ''} · 눌러서 이 변화 장면 보기`;
}
/** Review of v8 (first user, g): the card the past view outlines for a scene: the scene's part when that version has it, else the part it
 * came from by identity (a 승계's predecessor, a 중복 정리's folded duplicate); null when the past has none of them. */
export function pastMark(scene: Scene | undefined, has: (id: string) => boolean): string | null {
  if (!scene) return null;
  if (has(scene.part)) return scene.part;
  for (const c of scene.changes) for (const id of [...(c.predecessor ? [c.predecessor] : []), ...c.others ?? []]) if (has(id)) return id;
  return null;
}
/** Review of v8 (first user, c): the line a renamed card shows under its title while comparing. */
export const oldNameWord = (before: string): string => `옛 이름 ${plainName(before)}`;
/** Review of v8 (first user, i): a group of 기록 반영 상태 names its part as the map shows it: the part's own card, or the card it is drawn
 * inside (a folded group) with the part's name after it. */
export const heldName = (own: string, holder: string | null): string => (holder && holder !== own ? `${holder} 안의 ${own}` : own);
export interface Rect { x: number; y: number; w: number; h: number }
const meets = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** Where each tab goes (in map units), always on its own card's edge (review of v8, first user j: a tab never floats apart from its card;
 * v10, review of v9: never in a gap where it reads as the next card's): on its top edge, left-aligned, else right-aligned; else on its bottom
 * edge (left, then right); inside the card's own span; never over a placed tab, a card or a group's head, and every other card or head at
 * least `clear` from it (so it is clearly nearer its own card than any other). Tabs come in priority order; one that finds no place is hidden
 * (its part still counts in the line). gap: the room between a tab and its card, in map units. */
export function placeTabs(tabs: readonly { part: string; w: number; h: number }[], boxes: ReadonlyMap<string, Rect>, obstacles: readonly (Rect & { id: string })[], gap: number, clear = 0): Map<string, Rect | null> {
  const out = new Map<string, Rect | null>(), placed: Rect[] = [];
  const near = (o: Rect, r: Rect, m: number) => meets({ x: o.x - m, y: o.y - m, w: o.w + 2 * m, h: o.h + 2 * m }, r);
  for (const t of tabs) {
    const b = boxes.get(t.part); if (!b) { out.set(t.part, null); continue; }
    // Inside its card's span: left-aligned, right-aligned; a tab wider than its card stands centred on it.
    const xs = t.w <= b.w ? [b.x, b.x + b.w - t.w] : [b.x + (b.w - t.w) / 2];
    const at = (y: number): Rect[] => xs.map(x => ({ x, y, w: t.w, h: t.h }));
    const tries: Rect[] = [...at(b.y - gap - t.h), ...at(b.y + b.h + gap)];
    const ok = tries.find(r => !placed.some(p => meets(p, r)) && !obstacles.some(o => o.id !== t.part && near(o, r, clear)));
    out.set(t.part, ok ?? null); if (ok) placed.push(ok);
  }
  return out;
}
/** v10 (review of v9: 「사건 때」 under the guide at 1280): what the guide box must never stand over besides the cards: every label, badge,
 * chip, tab and note (marks), and each drawn line's ends (its arrowhead and the port it leaves): a line may pass under the box only where it
 * stays visible on both sides. end: the side of the square kept clear around a line's end. */
export function guideBlocks(cards: readonly Rect[], marks: readonly Rect[], routes: readonly (readonly { x: number; y: number }[])[], end = 12): Rect[] {
  const ends = routes.filter(p => p.length > 1).flatMap(p => [p[0]!, p[p.length - 1]!]).map(q => ({ x: q.x - end / 2, y: q.y - end / 2, w: end, h: end }));
  return [...cards, ...marks, ...ends];
}
/** v10 (review of v9: a note covered a card at 1440): where a note stands (its left and top in the host's frame): its usual place (centred
 * over the bars, at top) first, then along that row, then a row higher at a time; the first place that covers no card; none free: the
 * place covering the least of them. */
export function toastSpot(size: { w: number; h: number }, area: Rect, top: number, cards: readonly Rect[]): { x: number; y: number } {
  const cx = Math.round(area.x + (area.w - size.w) / 2), lo = area.x + 8, hi = area.x + area.w - size.w - 8;
  const cover = (r: Rect) => cards.reduce((s, c) => s + Math.max(0, Math.min(r.x + r.w, c.x + c.w) - Math.max(r.x, c.x)) * Math.max(0, Math.min(r.y + r.h, c.y + c.h) - Math.max(r.y, c.y)), 0);
  let best: { x: number; y: number; c: number } | null = null;
  for (let y = top; y >= area.y + 8; y -= size.h + 8) {
    const xs = [cx, ...Array.from({ length: 24 }, (_, i) => [cx - (i + 1) * 40, cx + (i + 1) * 40]).flat()].filter(x => x >= lo && x <= hi);
    for (const x of xs.length ? xs : [cx]) { const c = cover({ x, y, w: size.w, h: size.h }); if (!c) return { x, y }; if (!best || c < best.c) best = { x, y, c }; }
  }
  return best ? { x: best.x, y: best.y } : { x: cx, y: top };
}
/** v10 (review of v9: the note said 「보던 위치로 돌아왔어요」 where the map came back elsewhere): what leaving the comparison says, only what
 * is true: the camera as it was before the comparison (zoom and place), the card picked before it. */
export function exitWord(camera: boolean, picked: boolean): string {
  const back = camera && picked ? '비교 전에 고른 카드와 보던 위치로 돌아왔어요' : camera ? '비교 전에 보던 위치로 돌아왔어요' : picked ? '비교 전에 고른 카드로 돌아왔어요' : '';
  return `비교를 끝냈어요${back ? ` · ${back}` : ''}`;
}
/** The same for coming back from a past version: the camera as it was before 이전 모습, the card picked then. */
export function nowWord(camera: boolean, picked: boolean): string {
  const back = camera && picked ? '고른 카드와 화면 위치는 이전 모습을 보기 전 그대로예요' : camera ? '화면 위치는 이전 모습을 보기 전 그대로예요' : picked ? '고른 카드는 그대로예요' : '';
  return `현재 지도로 돌아왔어요${back ? ` · ${back}` : ''}`;
}
/** Whether two cameras are the same (zoom and place, within half a pixel). */
export const sameCamera = (a: { x: number; y: number; k: number }, b: { x: number; y: number; k: number }): boolean => Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.k - b.k) < 1e-4;

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

/** Review of v8 (first user, k): the least pan (screen pixels, sideways, up or down, or both) after which no card (nor a group's head) is
 * under the guide, keeping the scene's card readable in the area (when it is now); [0, 0] when none is under it; null when no pan within
 * the caps clears it (the guide then goes to the pane's top for that state). Never a zoom. */
export function guidePan(guide: Rect, cards: readonly Rect[], keep: Rect | null, area: Rect, cap: { x: number; y: number }): [number, number] | null {
  const hit = (s: Rect, dx: number, dy: number) => s.x + dx < guide.x + guide.w && guide.x < s.x + s.w + dx && s.y + dy < guide.y + guide.h && guide.y < s.y + s.h + dy;
  if (!cards.some(s => hit(s, 0, 0))) return [0, 0];
  const near = cards.filter(s => s.x < guide.x + guide.w + cap.x && guide.x - cap.x < s.x + s.w && s.y < guide.y + guide.h + cap.y && guide.y - cap.y < s.y + s.h);
  const hold = keep && readableInView(keep, area) ? keep : null;
  const dxs = new Set([0, ...near.flatMap(s => [guide.x + guide.w - s.x + 1, guide.x - s.x - s.w - 1])].filter(d => Math.abs(d) <= cap.x));
  const dys = new Set([0, ...near.flatMap(s => [guide.y + guide.h - s.y + 1, guide.y - s.y - s.h - 1])].filter(d => Math.abs(d) <= cap.y));
  let best: { dx: number; dy: number; cost: number } | null = null;
  for (const dx of dxs) for (const dy of dys) {
    const cost = Math.abs(dx) + Math.abs(dy); if (best && cost >= best.cost) continue;
    if (hold && !readableInView({ ...hold, x: hold.x + dx, y: hold.y + dy }, area)) continue;
    if (near.some(s => hit(s, dx, dy))) continue;
    best = { dx, dy, cost };
  }
  return best ? [best.dx, best.dy] : null;
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

/* ---------- notes (review of v8, first user f) ---------- */
/** A baseline changed while comparing: said, with the changes counted again for it, and whether they came out as many as before. */
export function baseWord(prev: number, now: number, total: number, same: boolean): string {
  const to = versionLabel(now);
  return `비교 기준을 ${versionLabel(prev)}에서 ${to}${josa(to, '으로/로')} 바꿨어요 · 변화 ${total}건을 ${to} 기준으로 다시 셌어요${same ? ` · ${versionLabel(prev)} 기준과 같은 결과예요` : ''}`;
}
/** How long a note stays (a few seconds). */
export const TOAST_MS = 4500;
/** The note's distance from its host's bottom edge: above every bar at the bottom (the toolbar, the compare line), 72px at least. */
export const toastBottom = (hostBottom: number, barTops: readonly number[], gap = 10): number => Math.max(72, ...barTops.map(t => Math.ceil(hostBottom - t + gap)));

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
export interface LineHandlers { pick: (k: SummaryKey) => void; reflect: () => void; history: () => void; exit: () => void;
  /** Review of v8: the record's 철회·변경 rows that are no part's change (the pane's own list). */
  withdrawals?: () => void }
/** The 32px compare line: the two versions, the counts, the two filters, 「대기·보류 N행」 at the right end and the way out. */
export function compareLine(cs: ChangeSet, picked: SummaryKey | 'history' | null, waiting: number | null, on: LineHandlers): HTMLElement {
  const items = summaryItems(cs);
  return h('div', { class: 'gl-row', role: 'toolbar', 'aria-label': `비교 · ${summaryText(cs)}` },
    h('button', { type: 'button', class: 'gl-pair', title: '기준 바꾸기 · 지도 이력', onclick: on.history }, `${versionLabel(cs.from)} → ${versionLabel(cs.to)}`),
    ...(items.length ? items.flatMap(i => [h('span', { class: 'gl-dot', 'aria-hidden': 'true' }, '·'),
      h('button', { type: 'button', class: `gl-item k-${i.key}${i.filter ? ' gl-filter' : ''}${picked === i.key ? ' on' : ''}`, 'aria-pressed': String(picked === i.key), title: itemTip(i.key), onclick: () => on.pick(i.key) }, i.text)])
      : [h('span', { class: 'gl-dot', 'aria-hidden': 'true' }, '·'), h('span', { class: 'gl-none' }, NO_CHANGE)]),
    h('span', { class: 'gl-gap' }),
    // Review of v8: the right end (the history rows, 대기·보류 and the way out) never leaves the line: it stays put while the counts give way.
    h('span', { class: 'gl-end' },
    cs.history.length && on.withdrawals ? h('button', { type: 'button', class: `gl-hist${picked === 'history' ? ' on' : ''}`, 'aria-pressed': String(picked === 'history'), title: `${historyWord(cs.history.length)} · 기록이 적은 철회·변경 가운데 지도의 부품 설명을 거두지 않은 것 (프로젝트 이력) · 정정이 아님 · 변화 집계와 따로 셈 · 누르면 목록`, onclick: on.withdrawals }, historyShort(cs.history.length)) : null,
    waiting !== null ? h('button', { type: 'button', class: `gl-un${waiting ? '' : ' zero'}`, title: `기록 반영 상태 · 지도 ${short(cs.to)} 기준 · 기록의 행 가운데 지도에 아직 들어가지 않은 대기·보류 행 (변화 집계와 따로 셈)`, onclick: on.reflect }, waitingWord(waiting)) : null,
    h('button', { type: 'button', class: 'gl-exit', title: '비교 끝내기 · 비교 전에 고른 카드와 보던 위치로 돌아가요', 'aria-label': '비교 끝내기 · 고른 카드와 위치는 비교 전대로', onclick: on.exit }, '×')));
}
/** The line's short word for the history rows (the pane and the title say 「기록된 철회·변경 N건」). */
export const historyShort = (n: number): string => `철회·변경 ${n}건`;
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
    h('button', { type: 'button', class: 'gp-now', title: '현재 지도로 · 이전 모습을 보기 전의 화면 위치로', onclick: onNow }, '현재로'));
}
/* 기록 반영 상태 (F7). */
/** A group's title and its line: 「문서 소비기에 관한 미반영 기록 3행」, 「연결 2행 · 단계 1행」, and 「이 부품은 현재 지도에 있습니다」 only for a part
 * checked by its ID on the map. */
export function groupTitle(g: ReflectGroup, name: (id: string) => string): { title: string; sub: string; onMap: boolean } {
  const n = g.rows.length, sub = g.byItem.map(x => `${x.item} ${x.n}행`).join(' · ');
  if (g.kind === 'part') return { title: `${name(g.part!)}에 관한 미반영 기록 ${n}행`, sub, onMap: true };
  // Review of v7: a part of a record no map part can be, by the record's own name for it (its rows together).
  // Review of v8: only when the map was given that part (never sent: unknown, neither claim).
  if (g.kind === 'unplaced') return { title: `${g.name ? plainName(g.name) : '이름 없는 부분'}에 관한 미반영 기록 ${n}행`, sub: g.sure ? `${sub} · 이 부품은 아직 지도에 놓이지 않았습니다` : sub, onMap: false };
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
