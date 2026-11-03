/* The scenario on the map (map design spec §3, cycle 3), as pure helpers the client draws from: whether a pasted text is a
 * scenario record, where each visit's badge goes (the card that stands for its part, visits of one part stacked in visit order),
 * which visits have no place on the map, the first broken place of a partial path, and the start and end heads' texts. Nothing
 * here reads the DOM or changes the scenario: the badges sit on existing cards, the path lights existing lines. */
import type { ScenarioUnderstanding, ScenarioVisitView } from '../shared/scenario-record.js';
import type { ScenarioDiagnostic, ScenarioKind, ScenarioLink, ScenarioLinkKind, ScenarioPathStatus, ScenarioSaid } from '../shared/types.js';

export const LINK_WORD: Record<ScenarioLinkKind, string> = { next: '다음', branch: '분기', parallel: '병렬', loop: '반복', wait: '대기' };
/** The glyph a link's kind leaves on its destination's badge; a plain next leaves none. */
export const LINK_GLYPH: Record<ScenarioLinkKind, string> = { next: '', branch: '⑂', parallel: '∥', loop: '↻', wait: '⏳' };
export const KIND_WORD: Record<ScenarioKind, string> = { designed: '설계 경로', observed: '관측 실행', tour: '설명용 투어' };
export const PATH_WORD: Record<ScenarioPathStatus, string> = { complete: '완결', partial: '부분', rejected: '거절' };
/** A cell as the record said it: its words, 모름, or 없음. */
export const saidText = (s: ScenarioSaid | undefined, none = '없음'): string => (s === undefined || s === 'unknown' ? '모름' : s === null ? none : s);
/** The number a badge shows for a visit: V01 → 1, V12 → 12. */
export const visitNumber = (id: string): string => { const n = Number(id.replace(/^V/i, '')); return Number.isFinite(n) ? String(n) : id; };

const plain = (c: string) => c.replace(/[*`]/g, '').trim();
function splitRow(line: string): string[] {
  let t = line.trim(); if (t.startsWith('|')) t = t.slice(1); if (t.endsWith('|') && !t.endsWith('\\|')) t = t.slice(0, -1);
  return t.split(/(?<!\\)\|/).map(x => x.replace(/\\\|/g, '|').trim());
}
const isRule = (line: string) => /^[|:\-\s]+$/.test(line.trim()) && line.includes('-');
/** The six tables' first header cells, as the scenario record reader knows them (scenario-record.ts TABLES). */
const HEADS: [string, RegExp][] = [['scenario', /^시나리오\s*ID$/], ['start', /^시작\s*ID$/], ['visits', /^방문(\s*V)?$/], ['links', /^이어짐(\s*L)?$/],
  ['end', /^끝(\s*ID)?$/], ['evidence', /^(근거\s*:?\s*)?E$|^근거(\s*ID)?$/], ['portMaps', /^대응(\s*ID)?$/], ['gaps', /^(빈칸\s*:?\s*)?G$|^빈칸$/]];
/** The table kinds whose header rows the text has (a header row is a '|' line right after a non-table line). */
export function recordTables(text: string): Set<string> {
  const found = new Set<string>(), lines = text.split(/\r?\n/); let inTable = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith('|')) { inTable = false; continue; }
    if (inTable) continue;
    inTable = true; const head = plain(splitRow(line)[0] ?? '');
    for (const [k, re] of HEADS) if (re.test(head)) found.add(k);
  }
  return found;
}
/** Whether a pasted text reads as a scenario record (시나리오 기록 v2): its visit and link tables both, or four of its six groups. */
export function scenarioRecordLike(text: string): boolean {
  const t = recordTables(text);
  if (t.has('visits') && t.has('links')) return true;
  const groups = ['scenario', 'start', 'visits', 'links', 'end', 'evidence'].filter(k => t.has(k)).length;
  return groups >= 4;
}
/** One table's data rows as written (cells split, header and rule left out), in order; rows of one table written in two pieces
 * are one table, as the reader counts them. */
export function recordRows(text: string, kind: string): string[][] {
  const re = HEADS.find(([k]) => k === kind)?.[1]; if (!re) return [];
  const out: string[][] = [], lines = text.split(/\r?\n/); let inTable = false, mine = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line.startsWith('|')) { inTable = false; mine = false; continue; }
    if (!inTable) { inTable = true; mine = re.test(plain(splitRow(line)[0] ?? '')); if (isRule(lines[i + 1] ?? '')) i++; continue; }
    if (mine && !isRule(line)) out.push(splitRow(line));
  }
  return out;
}
const vid = (c: string | undefined) => { const m = /(?<![A-Za-z0-9_])V(\d{1,3})(?![A-Za-z0-9_])/.exec(plain(c ?? '')); return m ? `V${String(Number(m[1])).padStart(2, '0')}` : null; };

/* ---------- badges ---------- */
export interface BadgeGlyph { kind: ScenarioLinkKind; glyph: string; link: string; title: string }
export interface BadgeVisit { id: string; n: string; glyphs: BadgeGlyph[]; title: string }
/** The badge on one drawn card: its visits in visit order, the first two shown ([03 · 07]) and how many more (+N). */
export interface BadgePlace { box: string; areaIds: string[]; visits: BadgeVisit[]; shown: BadgeVisit[]; more: number }
export interface BadgeLayout { places: BadgePlace[]; gone: ScenarioVisitView[]; outside: ScenarioVisitView[] }
/** What a link says on its destination's badge: its kind, id and ends, its condition, and for a wait what resumes it. */
export function linkTitle(l: ScenarioLink): string {
  const cond = l.condition === null ? null : l.condition === 'unknown' ? (l.kind === 'branch' ? '조건 미상' : null) : `조건: ${l.condition}`;
  const policy = l.policy === null || l.policy === 'unknown' ? (l.kind === 'wait' ? '재개 조건 미상' : null) : l.policy;
  return [`${LINK_WORD[l.kind]} ${l.id} (${l.from}→${l.to})`, cond, policy].filter(Boolean).join(' · ');
}
/** Badges per drawn card from the scenario's visits per area (byArea). rep: the card that stands for an area in this view (itself or
 * its nearest drawn ancestor), null when it is not in this view. A visit whose part is gone from the map has no badge (gone); one
 * whose part is outside the view has none here (outside). Several areas drawn as one card share its badge, in visit order. */
export function badgePlaces(u: ScenarioUnderstanding, rep: (areaId: string) => string | null): BadgeLayout {
  const order = new Map(u.visits.map((v, i) => [v.id, i])), byId = new Map(u.visits.map(v => [v.id, v]));
  const places = new Map<string, { areaIds: string[]; ids: string[] }>(), gone: ScenarioVisitView[] = [], outside: ScenarioVisitView[] = [];
  for (const [areaId, ids] of Object.entries(u.byArea)) {
    const vs = ids.map(id => byId.get(id)).filter((v): v is ScenarioVisitView => !!v);
    if (!vs.length) continue;
    if (!vs[0]!.partOnMap) { gone.push(...vs); continue; }
    const box = rep(areaId); if (!box) { outside.push(...vs); continue; }
    const p = places.get(box) ?? { areaIds: [], ids: [] }; p.areaIds.push(areaId); p.ids.push(...vs.map(v => v.id)); places.set(box, p);
  }
  const into = (id: string) => u.links.filter(l => l.to === id && l.kind !== 'next');
  const out: BadgePlace[] = [...places].map(([box, p]) => {
    const visits = [...p.ids].sort((a, b) => order.get(a)! - order.get(b)!).map(id => {
      const v = byId.get(id)!, glyphs = into(id).map(l => ({ kind: l.kind, glyph: LINK_GLYPH[l.kind], link: l.id, title: linkTitle(l) }));
      const step = v.step && v.step !== 'unknown' ? ` · ${v.step.name}` : '';
      return { id, n: visitNumber(id), glyphs, title: [`방문 ${visitNumber(id)} (${id}) · ${v.partName}${step}`, ...glyphs.map(g => g.title)].join('\n') };
    });
    return { box, areaIds: p.areaIds, visits, shown: visits.length > 2 ? visits.slice(0, 2) : visits, more: Math.max(0, visits.length - 2) };
  });
  const sort = (a: ScenarioVisitView, b: ScenarioVisitView) => order.get(a.id)! - order.get(b.id)!;
  return { places: out.sort((a, b) => order.get(a.visits[0]!.id)! - order.get(b.visits[0]!.id)!), gone: gone.sort(sort), outside: outside.sort(sort) };
}
/** The relation ids the path runs on (links that cite a relation the map still holds), each once. */
export function pathRelations(u: ScenarioUnderstanding): string[] {
  return [...new Set(u.links.filter(l => l.relation && l.relationOnMap).map(l => l.relation!.relationId))];
}
/** The links into and out of a visit. */
export function visitLinks(u: ScenarioUnderstanding, id: string): { into: ScenarioUnderstanding['links']; out: ScenarioUnderstanding['links'] } {
  return { into: u.links.filter(l => l.to === id), out: u.links.filter(l => l.from === id) };
}

/* ---------- the broken place of a partial path ---------- */
export interface BrokenPlace {
  /** The last valid visit before the break (its badge says 여기서 끊김); null when the break comes before any valid visit. */
  visit: string | null;
  /** What was set aside: a visit row, a link row, or (nothing set aside) the end the path does not reach. */
  kind: 'visit' | 'link' | 'end';
  /** The table row as written (visits[2] is the third row), null for the end. */
  row: number | null;
  /** The set-aside visit or link id as the record wrote it, when it can be read. */
  ref: string | null;
  explanation: string;
}
/** The first broken place of a partial path: the earliest set-aside visit or link along the path (by the valid visit it comes
 * after; a visit before a link at the same place), else the end that is not reached. Rows are told apart by the diagnostics'
 * paths (visits[k], links[k]: a row set aside whole) and read from the record as pasted; no row is renumbered or re-joined. */
export function brokenPlace(u: ScenarioUnderstanding, diagnostics: readonly ScenarioDiagnostic[], recordText: string): BrokenPlace | null {
  if (u.pathStatus !== 'partial') return null;
  const valid = new Map(u.visits.map((v, i) => [v.id, i]));
  const vrows = recordRows(recordText, 'visits'), lrows = recordRows(recordText, 'links');
  // Where each valid visit stands in the visit table (its first row).
  const rowOf = new Map<string, number>(); vrows.forEach((r, k) => { const id = vid(r[0]); if (id && valid.has(id) && !rowOf.has(id)) rowOf.set(id, k); });
  const before = (k: number): string | null => { let best: string | null = null, at = -1; for (const [id, r] of rowOf) if (r < k && r > at) { at = r; best = id; } return best; };
  const whole = (re: RegExp) => diagnostics.map(d => ({ d, m: re.exec(d.path) })).filter(x => x.m).map(x => ({ d: x.d, k: Number(x.m![1]) }));
  type Cand = { place: string | null; rank: number; tie: number; b: BrokenPlace };
  const cands: Cand[] = [];
  for (const { d, k } of whole(/^visits\[(\d+)\]$/)) {
    const place = before(k);
    cands.push({ place, rank: place === null ? -1 : valid.get(place)!, tie: 0, b: { visit: place, kind: 'visit', row: k, ref: vid(vrows[k]?.[0]), explanation: d.explanation } });
  }
  for (const { d, k } of whole(/^links\[(\d+)\]$/)) {
    const row = lrows[k], from = vid(row?.[1]), to = vid(row?.[2]);
    // After its start visit when that one holds; a link whose start was set aside is that visit's break (counted above).
    let place: string | null | undefined = from && valid.has(from) ? from : undefined;
    if (place === undefined && from && !valid.has(from) && vrows.some(r => vid(r[0]) === from)) continue;
    if (place === undefined && to && valid.has(to)) place = before(rowOf.get(to) ?? 0);
    if (place === undefined) place = u.visits.at(-1)?.id ?? null;
    const ref = /(?<![A-Za-z0-9_])L(\d{1,3})(?![A-Za-z0-9_])/.exec(plain(row?.[0] ?? ''));
    cands.push({ place, rank: place === null ? -1 : valid.get(place)!, tie: 1, b: { visit: place, kind: 'link', row: k, ref: ref ? `L${String(Number(ref[1])).padStart(2, '0')}` : null, explanation: d.explanation } });
  }
  if (cands.length) return cands.sort((a, b) => a.rank - b.rank || a.tie - b.tie || (a.b.row ?? 0) - (b.b.row ?? 0))[0]!.b;
  // Nothing set aside: the path stops short of its end (no reached visit, or the last confirmed point is not it).
  const e = u.end, last = e?.lastConfirmedVisit && valid.has(e.lastConfirmedVisit) ? e.lastConfirmedVisit : u.visits.at(-1)?.id ?? null;
  const why = !e ? '끝 표를 읽지 못함' : e.reached === null || e.reached === 'unknown' ? '도달 방문이 확인되지 않음' : !e.lastConfirmedVisit ? '마지막 확인 지점이 방문으로 확인되지 않음' : `마지막 확인 지점 ${e.lastConfirmedVisit}가 도달 방문 ${e.reached}와 다름`;
  return { visit: last, kind: 'end', row: null, ref: null, explanation: why };
}

/* ---------- start and end heads ---------- */
export interface HeadLine { label: string; text: string }
export interface Heads {
  /** The visit whose card the start head stands above (the first visit on the map), and the one the end head stands below (the
   * last confirmed visit, else the reached one, else the last visit on the map); null when none is on the map. */
  startVisit: string | null; endVisit: string | null;
  start: HeadLine[]; end: HeadLine[];
  /** Said on the end head of a path that is not complete: the result is not shown as reached. */
  short: string | null;
}
/** The heads' texts (spec §3.2): above, the trigger and the wanted result; below, what the design produces, the exits and what
 * is still apart. Each as the record said it (모름, 없음), never one copied into another. */
export function headTexts(u: ScenarioUnderstanding): Heads {
  const on = u.visits.filter(v => v.partOnMap), has = (id: string | null | undefined) => !!id && on.some(v => v.id === id);
  const e = u.end, reached = e && e.reached !== null && e.reached !== 'unknown' ? e.reached : null;
  const endVisit = has(e?.lastConfirmedVisit) ? e!.lastConfirmedVisit! : has(reached) ? reached! : on.at(-1)?.id ?? null;
  const exits = !e ? '모름' : e.exits === 'unknown' ? '모름' : e.exits.length ? e.exits.join(' · ') : '없음';
  return {
    startVisit: on[0]?.id ?? null, endVisit,
    start: [{ label: '촉발', text: saidText(u.start?.trigger) }, { label: '바라는 결과', text: saidText(e?.desired) }],
    end: [{ label: '설계가 내놓는 결과', text: saidText(e?.produced) }, { label: '이탈 결과', text: exits }, { label: '남은 차이', text: saidText(e?.gap) }],
    short: u.pathStatus === 'complete' ? null : '끝까지 이어진 경로가 아니에요 · 결과 도달은 확인되지 않음',
  };
}
/** A stored scenario's line in the selector: name · kind · pathStatus. */
export function scenarioLabel(name: ScenarioSaid | undefined, kind: ScenarioKind | null | undefined, status: ScenarioPathStatus): string {
  return [name && name !== 'unknown' ? name : '이름 모름', kind ? KIND_WORD[kind] : '종류 모름', PATH_WORD[status]].join(' · ');
}
/** The paste result line: 시나리오 C01 · 방문 N · 이어짐 M · pathStatus. */
export function scenarioResultLine(id: string | null | undefined, visits: number, links: number, status: ScenarioPathStatus): string {
  return `시나리오 ${id ?? '?'} · 방문 ${visits} · 이어짐 ${links} · ${PATH_WORD[status]}(${status})`;
}
