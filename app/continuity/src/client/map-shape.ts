/* v14 (spec items 3 and 5): the map's shape fits the project, read from the record's facts only. Pure: no DOM, no storage.
 * - What a card is to a reader (shapeKind): a person who uses the product (user), a person or bot who builds and releases it (crew), an
 *   outside system or someone else's code (outside), or a part of the program (part). Only recorded facts decide: the card's type word
 *   (사람 · 세션 · 외부 시스템), its family (참여), the role word the record wrote beside the family (「소유자·메인테이너」, 「의존성 갱신
 *   봇」, 「외부 배포처」) and its own name (「메인테이너(…)」, 「…(외부)」). A program part is never re-kinded.
 * - The build and release lane (laneIds): a part of the build kind or name (map-forms buildLike), every crew card, and the cards whose every
 *   recorded relation stays among the lane (a registry only the release publishes to); every form keeps it in the bottom lane
 *   「만들고 배포하는 길」.
 * - The main flow chosen for display (pathRank): a recorded candidate is ranked by what its cards are, never by importance: one that runs
 *   through the build lane ranks lowest, one whose later cards are logs or progress output next (plumbing), then a runtime path, and a
 *   runtime path that starts at a person who uses the product (or a card such a person hands to) highest. The rank only moves a candidate
 *   ahead of one of a lower rank: among runtime paths the record's own order of rules stands.
 * - A recorded group of user roles (roleGroups): a C-GROUP row whose 묶음 뜻 is 참여자 and whose name says roles or permissions
 *   (「builtin 인증 사람 역할」), with its members as written (row IDs).
 * - The record's coverage (coverageOf): its 「읽은 범위」 and 「못 읽은 범위」 head rows, said in plain words (each unit of the 읽은 범위 with
 *   code paths and file names left to the hover, never reworded). */
import { buildLike } from './map-forms.js';
import { codeToken } from './word-level.js';

export type ShapeKind = 'user' | 'crew' | 'outside' | 'part';
export interface ShapeFacts { name: string; type: string | null; family: string | null;
  /** The role word the record wrote beside the family (familyRead.role: 「소유자·메인테이너」, 「외부 배포처」). */
  familyRole?: string | null }

/** Words that name the people and bots who make and release the product (on a participant's name or its recorded role word). */
export const CREW_WORD = /메인테이너|maintainer|기여자|contributor|번역자|translator|(?:^|[^가-힣])봇(?:$|[^가-힣])|\bbots?\b|dependabot|병합|판본 (?:관리|올림)|변경 (?:제안|작성)|PR 작성|원 작성자|의존성 갱신|\bCI\b|github actions|릴리스 실행/i;
/** Words that say a card stands outside the program (its recorded role word or its own name). */
export const OUTSIDE_WORD = /외부|external|바깥/i;
/** Words that name a person using the product (a participant's name or role word). */
export const USER_WORD = /사용자|요청자|호출자|열람자|운영자|관리자|실행자|방문자|플레이어|player|\busers?\b|소비자|손님|고객|슈퍼유저|superuser|사람/i;
/** Words that name someone else's code (「사용자 코드」, 「모드 코드」): outside the program, never a person. */
const CODE_WORD = /(?<!레)코드|code|스크립트|script|인터셉터|플러그인|plugin|프로그램|도구/i;
const PEOPLE_TYPES = new Set(['person', 'session']);

/** What a card is to a reader (see the head of this file). */
export function shapeKind(c: ShapeFacts): ShapeKind {
  const type = c.type ?? null, fam = c.family ?? null, role = c.familyRole ?? '', said = `${c.name} ${role}`;
  const participant = fam === 'participant' || (!!type && (PEOPLE_TYPES.has(type) || type === 'external'));
  if (!participant) return 'part';
  if (CREW_WORD.test(said)) return 'crew';
  if (type === 'external' || OUTSIDE_WORD.test(role) || /[(（]\s*외부|외부\s*[)）,]|^외부\s/.test(c.name)) return 'outside';
  if (type && PEOPLE_TYPES.has(type)) return 'user';
  if (CODE_WORD.test(said)) return 'outside';
  return USER_WORD.test(said) ? 'user' : 'outside';
}
/** Whether a crew card is a bot (its name or role word says so), not a person. */
export const botLike = (c: ShapeFacts): boolean => /(?:^|[^가-힣])봇(?:$|[^가-힣])|\bbots?\b|dependabot|\bCI\b|actions/i.test(`${c.name} ${c.familyRole ?? ''}`);
/** Someone else's code (outside, named as code): 「사용자 코드」, 「사이트 소유자 코드」. */
export const codeLike = (c: ShapeFacts): boolean => CODE_WORD.test(`${c.name} ${c.familyRole ?? ''}`);

/** The mark a card carries at 쉽게 (and in its name tag): 사람 for a person, 자동 봇 for a bot of the release, 외부 시스템 for an outside
 * system, 외부 코드 for someone else's code; null for a part of the program. */
export function kindMark(c: ShapeFacts): string | null {
  const k = shapeKind(c);
  if (k === 'part') return null;
  if (k === 'crew') return botLike(c) && !(c.type && PEOPLE_TYPES.has(c.type)) ? '자동 봇' : '사람';
  if (k === 'user') return '사람';
  return codeLike(c) && c.type !== 'external' ? '외부 코드' : '외부 시스템';
}
/** The one-line legend at 쉽게: the three shapes and what they stand for. */
export const KIND_LEGEND: readonly { kind: 'person' | 'outside' | 'part'; word: string; tip: string }[] = Object.freeze([
  { kind: 'person', word: '사람', tip: '둥근 카드 · 이 프로그램을 쓰거나 만드는 사람(과 봇)' },
  { kind: 'outside', word: '외부 시스템', tip: '점선 카드 · 프로그램 밖의 서비스·라이브러리·다른 사람의 코드' },
  { kind: 'part', word: '프로그램 부분', tip: '각진 카드 · 이 프로그램 안의 부분' },
]);

/* ---------- the build and release lane ---------- */
export interface LaneCard extends ShapeFacts { id: string }
export interface LaneLine { from: string; to: string }
/** The lane's cards: the build kind or name (buildLike), every crew card, then the people and outside systems whose every recorded
 * relation stays among the lane, one at least meeting it (the largest such set). */
export function laneIds(cards: readonly LaneCard[], lines: readonly LaneLine[]): Set<string> {
  const ids = new Set(cards.map(c => c.id)), nb = new Map<string, Set<string>>();
  for (const l of lines) { if (l.from === l.to || !ids.has(l.from) || !ids.has(l.to)) continue; (nb.get(l.from) ?? nb.set(l.from, new Set()).get(l.from)!).add(l.to); (nb.get(l.to) ?? nb.set(l.to, new Set()).get(l.to)!).add(l.from); }
  const lane = new Set(cards.filter(c => buildLike({ name: c.name, type: c.type }) || shapeKind(c) === 'crew').map(c => c.id));
  if (!lane.size) return lane;
  const near = new Set(cards.filter(c => !lane.has(c.id) && shapeKind(c) !== 'part' && (nb.get(c.id)?.size ?? 0) > 0).map(c => c.id));
  for (let changed = true; changed;) { changed = false; for (const id of [...near]) if (![...nb.get(id)!].every(n => lane.has(n) || near.has(n))) { near.delete(id); changed = true; } }
  const reach = new Set<string>();
  for (let grow = true; grow;) { grow = false; for (const id of near) if (!reach.has(id) && [...nb.get(id)!].some(n => lane.has(n) || reach.has(n))) { reach.add(id); grow = true; } }
  for (const id of reach) lane.add(id);
  return lane;
}

/* ---------- the main flow chosen for display ---------- */
/** A card whose own name says it holds logs or progress output (plumbing a reader does not follow first). */
export const LOG_NAME = /로그|\blogs?\b|logger|출력 파일|진행 표시|진행 막대|progress/i;
export interface RankFacts {
  /** The build lane's cards. */
  lane: ReadonlySet<string>;
  /** Whether a card is log-like (LOG_NAME). */
  log: (id: string) => boolean;
  /** Whether a card is a person who uses the product, or one such a person hands to directly (a recorded relation from it). */
  start: (id: string) => boolean;
}
/** The rank of a candidate by its steps' cards (see the head of this file): 0 build, 1 plumbing, 2 runtime, 3 runtime from a user. */
export function pathRank(steps: readonly (readonly string[])[], f: RankFacts): number {
  const cards = steps.flat(); if (!cards.length) return 2;
  if (cards.some(id => f.lane.has(id))) return 0;
  if (cards.slice(steps[0]?.length ?? 1).some(f.log)) return 1;
  return (steps[0] ?? []).some(f.start) ? 3 : 2;
}
/** The candidate shown first among lists in the record's order of rules (each list in its own order): the first one, unless it ranks 0 or
 * 1 and a later one ranks higher (then the highest, the earliest among equals). Returns [list index, item index]. */
export function preferRuntime<T>(lists: readonly (readonly T[])[], rank: (x: T) => number): [number, number] | null {
  let first: [number, number] | null = null, best: [number, number] | null = null, bestR = -1;
  lists.forEach((l, i) => l.forEach((x, j) => { const r = rank(x); if (!first) first = [i, j]; if (r > bestR) { bestR = r; best = [i, j]; } }));
  if (!first) return null;
  const [fi, fj] = first as [number, number]; const fr = rank(lists[fi]![fj]!);
  return fr <= 1 && bestR > fr ? best : first;
}
/** A list with the candidates of rank 0 and 1 after the others (each group in its own order). */
export function demoteLow<T>(list: readonly T[], rank: (x: T) => number): T[] {
  return [...list.filter(x => rank(x) > 1), ...list.filter(x => rank(x) <= 1)];
}

/* ---------- recorded groups of user roles ---------- */
export interface RoleGroup { name: string; members: string[] }
/** A group row's name that says roles or permissions. */
export const ROLE_GROUP_NAME = /역할|권한|role|permission/i;
/** The recorded groups of user roles in a record's text: C-GROUP rows (「| G08 | 이름 | B05·B06 | 참여자 | 근거 |」) whose 묶음 뜻 is 참여자
 * and whose name says roles, with their member row IDs; a later row of the same name replaces an earlier one. */
export function roleGroups(text: string): RoleGroup[] {
  const out = new Map<string, RoleGroup>();
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim().startsWith('|')) continue;
    const c = line.split('|').slice(1, -1).map(x => x.trim());
    if (c.length < 4 || !/^(?:교체\s+)?G(?:R)?\d+$/.test(c[0]!) || !/^참여자$/.test(c[3]!)) continue;
    const name = c[1]!, members = (c[2]!.match(/\bB\d{2,}\b/g) ?? []);
    if (!ROLE_GROUP_NAME.test(name) || members.length < 2) continue;
    out.set(name, { name, members: [...new Set(members)] });
  }
  return [...out.values()];
}

/* ---------- the record's coverage ---------- */
export interface Coverage { read: string; unread: string | null; shown: string }
/** A head row's value (「| 읽은 범위 | … | 근거 |」), the last one written in the text; null when none. */
export function headValue(text: string, item: string): string | null {
  let last: string | null = null;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim().startsWith('|')) continue;
    const c = line.split('|').slice(1, -1).map(x => x.trim());
    if (c.length >= 2 && c[0]!.replace(/^교체\s+(?:항목\s+)?/, '') === item && c[1]) last = c[1];
  }
  return last;
}
/** Words that only qualify what was read (how much of it, which kind of file), never what it is. */
const QUALIFIER = /^(?:일부|전부|대부분|핵심|머리|루트|파일|함수|트리거|목록|본문|내용|\d+개)$/;
/** Words of a unit about the project's housekeeping (its history, documents, CI files), not the program: no such unit is said. */
const HOUSEKEEPING = /이력|문서|워크플로|README|CHANGELOG|CONTRIBUTING|CODEOWNERS|dependabot|\bCI\b|검색|git/i;
/** The 읽은 범위's units: split at its commas and semicolons outside brackets. */
export function scopeUnits(read: string): string[] {
  const out: string[] = []; let depth = 0, cur = '';
  for (const ch of read) {
    if ('(（'.includes(ch)) depth++; else if (')）'.includes(ch)) depth = Math.max(0, depth - 1);
    if (!depth && ',，;；'.includes(ch)) { if (cur.trim()) out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
/** One unit of the 읽은 범위 in plain words: what it names before its brackets (「수집 경로(tracker, …)」 → 「수집 경로」), its code tokens
 * (paths, file names, globs, code names) left out and the words around them kept as written; null when no Korean word is left that says
 * what was read (only 「일부」, 「핵심」, a count …). */
export function plainUnit(u: string): string | null {
  const head = u.replace(/[(（][\s\S]*$/, '').trim();
  const words = (head || u).split(/\s+/).filter(Boolean);
  const kept = words.filter(w => { const bare = w.replace(/(?:의|에서|에|와|과|만|은|는)$/, ''); return !!bare && !(codeToken(bare) || /[/*\\]|\.[A-Za-z]{1,4}$|^\./.test(bare)); })
    .map(w => w.replace(/(?:의|에서|에)$/, ''));
  const t = kept.join(' ').trim();
  if (HOUSEKEEPING.test(t)) return null;
  return kept.some(w => /[가-힣]{2,}/.test(w) && !QUALIFIER.test(w)) ? t : null;
}
/** The caption's words: 「기록이 다룬 범위: …」 from the record's 읽은 범위 (its units in plain words, the first that fit max characters,
 * 「외」 when a unit was left out), then 「· 못 읽은 곳 있음」; with no unit in plain words, 「기록이 읽은 곳만 그렸어요」. The whole 읽은 범위
 * and 못 읽은 범위 read in its hover. null without both rows (a record that does not say it left anything out is not called partial). */
export function coverageOf(texts: readonly string[], max = 56): Coverage | null {
  for (let i = texts.length - 1; i >= 0; i--) {
    const read = headValue(texts[i]!, '읽은 범위'); if (!read) continue;
    const unread = headValue(texts[i]!, '못 읽은 범위');
    if (!unread || /^(?:없음|모름|—|-)$/.test(unread)) return null;
    const all = scopeUnits(read), units = all.map(plainUnit).filter((x): x is string => !!x);
    let shown = '', n = 0;
    for (const u of units) { const next = shown ? `${shown}, ${u}` : u; if (next.length > max && shown) break; shown = next; n++; }
    const what = shown ? `${shown}${n < all.length ? ' 외' : ''}` : COVERAGE_NONE;
    return { read, unread, shown: `${COVERAGE_WORD}: ${what} · ${COVERAGE_UNREAD}` };
  }
  return null;
}
export const COVERAGE_NONE = '프로젝트 일부', COVERAGE_UNREAD = '못 읽은 곳 있음';
export const COVERAGE_WORD = '기록이 다룬 범위';
