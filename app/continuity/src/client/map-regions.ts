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
import type { PartType } from '../shared/types.js';

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

/** The group a part sits under when that group is a lifecycle group (its 「원문 분류」, 2.2): the group's name, else null. */
export function filedUnder(v: StudioView, id: string): string | null {
  const byId = new Map(v.parts.map(p => [p.id, p])), parent = byId.get(id)?.parentId;
  return parent && groupAxis(v, parent) === 'lifecycle' ? byId.get(parent)!.name : null;
}
