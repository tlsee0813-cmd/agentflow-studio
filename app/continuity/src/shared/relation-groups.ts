/* Relations read from one end, grouped by verb and direction: a part's lens, a scope's reading and a group's inside. Read-only:
 * the kinds, directions, ends and notes are the project's own; nothing here makes a relation more or less certain, and no
 * relation is counted that the project does not store. */
import type { StudioView, RelationView } from './studio.js';

export const REL_LABEL: Record<string, string> = { flow: '넘겨줌', needs: '필요로 함', shares: '함께 씀', related: '관련' };
/** Who the verb is read from: this part, this scope, or the parts inside a group (each row then names its own inner end). */
export type RelSubject = '부분' | '범위' | '안쪽';
/** A relation read from one end: the verb with that end as its subject ("이 부분이 필요로 함") or its object ("이 부분을 필요로
 * 함"). */
export function relLabel(kind: string, out: boolean, subject: RelSubject = '부분'): string {
  const it = subject === '안쪽' ? '안쪽' : `이 ${subject}`, verb = REL_LABEL[kind] ?? kind, batchim = subject !== '범위';
  if (kind === 'needs') return out ? `${it}${batchim ? '이' : '가'} 필요로 함` : `${it}${batchim ? '을' : '를'} 필요로 함`;
  if (kind === 'flow') return out ? `${it}${batchim ? '이' : '가'} 넘겨줌` : `${it}에 넘겨줌`;
  // A plain relation has no direction to read: one neutral verb, whichever end was recorded first.
  if (kind === 'related') return verb;
  return out ? `${verb} →` : `← ${verb}`;
}
/** Relations of one end, grouped by verb and direction: what it uses before what uses it. */
export function relationGroups<T extends { r: { kind: string }; out: boolean }>(ends: T[], subject: RelSubject = '부분'): { label: string; list: T[] }[] {
  const order = ['flow', 'needs', 'shares', 'related'], groups = new Map<string, { label: string; list: T[] }>();
  const sorted = [...ends].sort((a, b) => Number(b.out) - Number(a.out) || order.indexOf(a.r.kind) - order.indexOf(b.r.kind));
  for (const x of sorted) { const k = `${x.r.kind === 'related' ? '' : x.out}|${x.r.kind}`; const g = groups.get(k) ?? { label: relLabel(x.r.kind, x.out, subject), list: [] }; g.list.push(x); groups.set(k, g); }
  return [...groups.values()];
}
/** The direction mark of a relation row: from or to this end; none for a plain relation, which only says the two are related. */
export const dirMark = (kind: string, out: boolean) => (kind === 'related' ? '–' : out ? '→' : '←');
export const dirTitle = (kind: string, out: boolean) => (kind === 'related' ? '방향 없는 관련' : out ? '이 부분에서 나감' : '이 부분으로 들어옴');

/** One stored relation read from one of its ends: near is that end, far the other. */
export interface RelEnd { r: RelationView; near: string; far: string; out: boolean }
/** A group's inside seen from the group: every stored relation with one end strictly inside it (a descendant) and the other
 * outside it, read from the inner end; and how many stored relations join two of its descendants (counted, never listed).
 * The group's own relations (one end is the group itself) are the group's and are not part of either. */
export function insideEnds(v: StudioView, groupId: string): { outside: RelEnd[]; within: number } {
  const inside = new Set<string>(), stack = [...(v.parts.find(p => p.id === groupId)?.childIds ?? [])];
  while (stack.length) { const id = stack.pop()!; if (inside.has(id) || id === groupId) continue; inside.add(id); stack.push(...(v.parts.find(p => p.id === id)?.childIds ?? [])); }
  const outside: RelEnd[] = []; let within = 0;
  for (const r of v.relations) {
    const a = inside.has(r.from), b = inside.has(r.to);
    if (a && b) within++;
    else if (a && r.to !== groupId) outside.push({ r, near: r.from, far: r.to, out: true });
    else if (b && r.from !== groupId) outside.push({ r, near: r.to, far: r.from, out: false });
  }
  return { outside, within };
}
