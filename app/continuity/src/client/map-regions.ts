/* What a group on the map means, and where the scope's outside roles sit (map design v3 2.1–2.3, slice S7, display only). Pure: no
 * DOM, so the rules are tested on their own.
 * - A group's axis (groupAxis, 2.3-1): read from what the record says of its children, never from a name alone. 참여자
 *   (participants: every child a person, a session or an external system that runs nothing of its own, and every line between them
 *   and the rest leaves them), 실행 위치 미기록 (lifecycle: a group the record named with its lifecycle word — 설계만 · 폐기 · 미구현 —
 *   whose every child is retired or unbuilt; the shelf says what the record did not say, the children keep 「원문 분류: 폐기」),
 *   시스템 경계 (boundary: a group named 외부 whose typed children are all external systems, none running anything of its own), 구성 (composition: a part with a type word
 *   whose inside is shown). Anything else has no axis word (a neutral group). 실행 위치 itself is never guessed: only a record can
 *   say where something runs (map-reading.18 groupAxis, pipeline).
 * - The scope's bands (bandsOf): an outside role (a person or session that runs nothing of its own, or a participants group) sits in
 *   the 참여자 band on the left, where inputs come in; an external system that runs nothing of its own (or a boundary group) sits
 *   behind the quiet 시스템 경계 on the right; a lifecycle group sits on the 실행 위치 미기록 shelf under everything. A part with
 *   recorded steps, a loop or an inside is an executor and stays inside, whatever its type (CI that the record says runs the
 *   system is not sent out). Bands are a placement preference of the automatic arrangement only: a place the person set wins, and
 *   nothing is banded when it would leave the middle empty. */
import type { StudioView, PartView } from '../shared/studio.js';
import { isMapReading, type PartType, type Project, type ReadingPart } from '../shared/types.js';
import { laneIds, type LaneCard } from './map-shape.js';

export type GroupAxis = 'participants' | 'boundary' | 'lifecycle' | 'composition' | null;
export type Band = 'outside' | 'boundary' | 'shelf';
/** The axis word a group's head says before its name (12px, text-3); none for a group of no known axis. */
export const AXIS_WORD: Record<Exclude<GroupAxis, null>, string> = { participants: '참여자', boundary: '시스템 경계', lifecycle: '실행 위치 미기록', composition: '구성' };
/** The shelf's title, exactly (2.2): what the record did not say, not where the parts went. */
export const SHELF_TITLE = '실행 위치 미기록';
/** The band captions (2.1): the outside roles' band and the system boundary, as the map reads them. */
export const OUTSIDE_TITLE = '참여자', BOUNDARY_TITLE = '시스템 경계 · 기록 기준';
export const OUTSIDE_TIP = '참여자 · 시스템 밖에서 판단·입력을 주는 역할 (사람·세션, 스스로 실행하는 단계가 기록되지 않은 것) · 배치 선호일 뿐 기록의 묶음이 아님';
export const BOUNDARY_TIP = '시스템 경계 · 기록 기준 · 바깥 시스템 (스스로 실행하는 단계가 기록되지 않은 외부 시스템) · 배치 선호일 뿐 기록의 묶음이 아님';
export const SHELF_TIP = '실행 위치 미기록 · 기록이 이 부분들을 설계만·폐기 같은 생애 묶음 아래에만 두었다 · 그 분류는 실행 위치의 근거가 아니어서 실행 영역으로 그리지 않는다 (카드에 「원문 분류」로 남김)';
/** The record's lifecycle words a group may be named with (2.3-1). */
export const LIFE_NAME = /설계만|폐기|미구현/;
const PEOPLE: readonly PartType[] = ['person', 'session'];

const typeOf = (p: PartView | undefined): PartType | null => p?.reading?.typeRead?.type ?? null;
const stateOf = (p: PartView | undefined) => p?.reading?.stateRead?.state ?? null;
/** A part the record says runs something of its own (steps, a loop) or that holds parts: an executor, never sent to a band. */
export const executes = (p: PartView | undefined): boolean => !!p && (p.childIds.length > 0 || (p.reading?.steps?.length ?? 0) > 0 || !!p.reading?.loop);

/** The axis of a group (a part with children) by what the record says of them (2.3-1); null when none is known. */
export function groupAxis(v: StudioView, id: string): GroupAxis {
  const byId = new Map(v.parts.map(p => [p.id, p])), g = byId.get(id); if (!g || !g.childIds.length) return null;
  const kids = g.childIds.map(k => byId.get(k)), inside = new Set<string>();
  const walk = (x: string, d = 0) => { if (d > 64 || inside.has(x)) return; inside.add(x); for (const k of byId.get(x)?.childIds ?? []) walk(k, d + 1); };
  walk(id);
  if (LIFE_NAME.test(g.name) && kids.every(k => stateOf(k) === 'retired' || stateOf(k) === 'unbuilt')) return 'lifecycle';
  // A group the record named 외부: its typed children are all external systems (one it left untyped stays with them) and none runs
  // anything of its own.
  if (/외부/.test(g.name) && kids.some(k => typeOf(k) === 'external') && kids.every(k => (typeOf(k) ?? 'external') === 'external' && !executes(k))) return 'boundary';
  if (kids.every(k => { const t = typeOf(k); return !!t && (PEOPLE.includes(t) || t === 'external') && !executes(k); })) {
    // Only lines that leave them for the rest: nothing of the rest flows into them.
    const across = v.relations.filter(r => inside.has(r.from) !== inside.has(r.to));
    if (across.every(r => inside.has(r.from))) return 'participants';
  }
  return typeOf(g) ? 'composition' : null;
}

/** The band each of a scope's direct parts takes (ids: the scope's children), or none; empty when banding would leave the middle
 * of the map empty. */
export function bandsOf(v: StudioView, ids: readonly string[]): Map<string, Band> {
  const byId = new Map(v.parts.map(p => [p.id, p])), out = new Map<string, Band>();
  for (const id of ids) {
    const p = byId.get(id); if (!p) continue;
    if (p.childIds.length) {
      const a = groupAxis(v, id);
      if (a === 'participants') out.set(id, 'outside'); else if (a === 'boundary') out.set(id, 'boundary'); else if (a === 'lifecycle') out.set(id, 'shelf');
      continue;
    }
    if (executes(p)) continue;
    const t = typeOf(p);
    if (t && PEOPLE.includes(t)) out.set(id, 'outside');
    else if (t === 'external') out.set(id, 'boundary');
  }
  return out.size >= ids.length ? new Map() : out;
}

/* ---------- a group as the record names it (display slice S8) ---------- */
/** The axes a record's C-GROUP 「묶음 뜻」 column gives a parent (map-reading.18 groupAxis; 목록 is a list, not an axis). */
export type RecordedAxis = Exclude<GroupAxisRead, 'members'>;
type GroupAxisRead = NonNullable<ReadingPart['groupAxis']>;
/** The record's own words for those axes (record-table GROUP_WORDS, the column's fixed words), read on a group's card and head. */
export const RECORD_AXIS_WORD: Record<RecordedAxis, string> = { place: '실행 위치', composition: '구성', participants: '참여자', boundary: '외부' };
/** The axis the newest map reading that names one gives this part as a parent (its 「묶음 뜻」 with the row it rests on); null when no
 * reading names one, or names 목록 (a list group: its rows, not an axis). The record wins over the app's own reading (2.3-3). */
export function recordedAxis(project: Pick<Project, 'readings'>, id: string): RecordedAxis | null {
  for (let i = project.readings.length - 1; i >= 0; i--) {
    const r = project.readings[i]!; if (!isMapReading(r)) continue;
    const a = r.parts.find(x => x.areaId === id)?.groupAxis;
    if (a && a !== 'members') return a;
  }
  return null;
}
/** What a group is, as its card and head say it: the record's axis in the record's word when one is written, else the axis the app
 * reads from its children (groupAxis; 실행 위치 never, only a record says where something runs), else none. A part with no children
 * is no group (null). */
export interface GroupWord { axis: RecordedAxis | Exclude<GroupAxis, null>; word: string; recorded: boolean }
export function groupWordOf(v: StudioView, id: string, recorded: RecordedAxis | null): GroupWord | null {
  const g = v.parts.find(p => p.id === id); if (!g || !g.childIds.length) return null;
  if (recorded) return { axis: recorded, word: RECORD_AXIS_WORD[recorded], recorded: true };
  const a = groupAxis(v, id);
  return a ? { axis: a, word: AXIS_WORD[a], recorded: false } : null;
}

/** The group a part sits under when that group is a lifecycle group (its 「원문 분류」, 2.2): the group's name, else null. */
export function filedUnder(v: StudioView, id: string): string | null {
  const byId = new Map(v.parts.map(p => [p.id, p])), parent = byId.get(id)?.parentId;
  return parent && groupAxis(v, parent) === 'lifecycle' ? byId.get(parent)!.name : null;
}

/* ---------- two heads of one kind (ruling F8 Q5) ----------
 * Where the map would draw the same kind head (「참여자」) over two or more sets of cards, each set's head says what the record says about
 * that set and nothing else: the name of a recorded group holding the whole set leads, the kind small beside it; else a recorded place
 * holding it, 「참여자 · 〈place〉」; else, when the record keeps the set as a group of its own with no name, the kind and 「구성원: 〈names〉」;
 * a set the record says nothing of keeps the plain kind, and plain heads that still repeat are taken off the map (the sets were only split by
 * the layout: the kind reads once in the legend). Cards and boundaries never change; no word the record does not have. */
/** A group the record writes as a C-GROUP row whose parent is a label (no part of its own): its name as written, what kind of group (its
 * 묶음 뜻: 참여자 · 실행 위치 · another), and its members as parts. */
export interface RecordedSet { name: string; axis: 'participants' | 'place' | 'other'; members: readonly string[] }
export type KindHeadCase = 'named' | 'place' | 'members' | 'plain';
export interface KindHead { text: string; small: string | null; how: KindHeadCase }
/** A row reference standing for a name (「B21」): no name to show. */
const ROW_REF = /^\s*[A-Z]{1,3}\d{1,3}\s*$/;
export function kindHeads(sets: readonly (readonly string[])[], recorded: readonly RecordedSet[], word: string, nameOf: (id: string) => string): { heads: (KindHead | null)[]; legend: boolean } {
  if (sets.length < 2) return { heads: sets.map(() => ({ text: word, small: null, how: 'plain' as const })), legend: false };
  const holds = (g: RecordedSet, set: readonly string[]) => set.length > 0 && set.every(id => g.members.includes(id));
  const heads: KindHead[] = sets.map(set => {
    const named = recorded.find(g => g.axis !== 'place' && g.name.trim() && !ROW_REF.test(g.name) && holds(g, set));
    if (named) return { text: named.name.trim(), small: word, how: 'named' };
    const place = recorded.find(g => g.axis === 'place' && g.name.trim() && !ROW_REF.test(g.name) && holds(g, set));
    if (place) return { text: `${word} · ${place.name.trim()}`, small: null, how: 'place' };
    const own = recorded.find(g => holds(g, set) && !sets.some(o => o !== set && o.some(id => g.members.includes(id))));
    if (own) return { text: word, small: `구성원: ${set.map(nameOf).join(', ')}`, how: 'members' };
    return { text: word, small: null, how: 'plain' };
  });
  // The same words twice tell nothing apart: those heads leave the map and the kind reads once in the legend.
  const key = (x: KindHead) => `${x.text}\u0000${x.small ?? ''}`, count = new Map<string, number>();
  for (const x of heads) count.set(key(x), (count.get(key(x)) ?? 0) + 1);
  const out = heads.map(x => (count.get(key(x))! > 1 ? null : x));
  return { heads: out, legend: out.some(x => x === null) };
}

/* ---------- v14 (spec 3): the build and release lane of the whole map ---------- */
/** The scope's direct parts (ids) that stand in the build and release lane (map-shape laneIds over the record's names, type words,
 * families and role words, with the relations lifted to these parts), in the order their own recorded relations run (sources first,
 * ties in the scope's order). Empty when the lane would hold every part (nothing left to put it under). */
export function laneOfScope(v: StudioView, ids: readonly string[]): string[] {
  const byId = new Map(v.parts.map(p => [p.id, p])), set = new Set(ids);
  const lift = (id: string) => { let cur = byId.get(id), g = 0; while (cur && !set.has(cur.id) && g++ < 64) cur = cur.parentId ? byId.get(cur.parentId) : undefined; return cur && set.has(cur.id) ? cur.id : null; };
  const lines: { from: string; to: string }[] = [];
  for (const r of v.relations) { const a = lift(r.from), b = lift(r.to); if (a && b && a !== b) lines.push({ from: a, to: b }); }
  const cards = ids.flatMap(id => { const p = byId.get(id); return p ? [shapeFactsOf(p)] : []; });
  const lane = laneIds(cards, lines); if (!lane.size || lane.size >= ids.length) return [];
  // Sources first along the lane's own relations (a cycle broken at the earliest in the scope's order).
  const rank = new Map(ids.map((id, i) => [id, i])), indeg = new Map([...lane].map(id => [id, 0]));
  for (const l of lines) if (lane.has(l.from) && lane.has(l.to)) indeg.set(l.to, indeg.get(l.to)! + 1);
  const out: string[] = [], left = new Set(lane);
  while (left.size) {
    const pick = [...left].filter(id => indeg.get(id) === 0).sort((a, b) => rank.get(a)! - rank.get(b)!)[0] ?? [...left].sort((a, b) => rank.get(a)! - rank.get(b)!)[0]!;
    out.push(pick); left.delete(pick);
    for (const l of lines) if (l.from === pick && left.has(l.to)) indeg.set(l.to, indeg.get(l.to)! - 1);
  }
  return out;
}
/** A part's facts as map-shape reads them (its name, its recorded type word, family and the role word beside the family). */
export function shapeFactsOf(p: PartView): LaneCard {
  const r = p.reading;
  return { id: p.id, name: p.name, type: r?.typeRead?.type ?? null, family: r?.familyRead?.family ?? null, familyRole: r?.familyRead?.role ?? null };
}
