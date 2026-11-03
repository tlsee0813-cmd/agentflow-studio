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

/* ---------- the grammar drawn on the path (spec §3.3, cycle 6): 분기 마름모 · 병렬 막대 · 반복 프레임 · 대기 제어 선 ----------
 * Marks sit on the lines the path already lights, never move a card and never add a line: a branch draws a small diamond where
 * its line leaves the source part, its condition 8–16px from that exit; a parallel link a short double bar across its line near
 * the source; a loop a thin frame round the drawn cards of the visits it spans (by visit order), its repeat unit at the frame's
 * head; a wait its line as a control line (open V head, dashed near the destination) with what resumes it. A label with no clear
 * place reads on hover only. The glyphs on the badges stay. */
type Pt = { x: number; y: number };
export type MarkKind = 'branch' | 'parallel' | 'loop' | 'wait';
export interface GrammarMark {
  kind: MarkKind; link: string; from: string; to: string; relation: string | null;
  /** The one-line label as the record said it (조건 · 합류 정책 · 반복 단위 · 재개 사건), or its explicit blank. */
  label: string; blank: boolean;
  /** The full words on hover. */
  title: string;
  /** For a loop: the visits it spans, from its earlier to its later end by visit order (both ends included). */
  span: string[];
}
const said = (s: ScenarioSaid): string | null => (s === null || s === 'unknown' ? null : s.trim() || null);
/** The marks of a scenario's links, in link order: every branch, parallel, loop and wait link between two visits that hold
 * (a next link draws nothing). Each label as the record wrote it; a blank as its words (조건 미상, 재개 조건 미상, …). */
export function grammarMarks(u: ScenarioUnderstanding): GrammarMark[] {
  const order = new Map(u.visits.map((v, i) => [v.id, i]));
  return u.links.flatMap((l): GrammarMark[] => {
    if (l.kind === 'next' || !order.has(l.from) || !order.has(l.to)) return [];
    const base = { kind: l.kind, link: l.id, from: l.from, to: l.to, relation: l.relation && l.relationOnMap ? l.relation.relationId : null, span: [] as string[] };
    const head = `${LINK_WORD[l.kind]} ${l.id} (${l.from}→${l.to})`;
    if (l.kind === 'branch') {
      const c = said(l.condition), label = c ?? (l.condition === null ? '조건 없음' : '조건 미상');
      return [{ ...base, label, blank: !c, title: `${head} · ${c ? `조건: ${c}` : label} · 선택 방식 미상(배타성은 기록에 없음)` }];
    }
    if (l.kind === 'parallel') {
      const p = said(l.policy), label = p ?? '합류 정책 미상';
      return [{ ...base, label, blank: !p, title: `${head} · 동시 (어느 쪽이 먼저라는 뜻 없음) · ${p ? `합류: ${p}` : label}` }];
    }
    if (l.kind === 'loop') {
      const p = said(l.policy), label = p ?? '반복 단위 미상', a = order.get(l.from)!, b = order.get(l.to)!;
      const span = u.visits.slice(Math.min(a, b), Math.max(a, b) + 1).map(v => v.id);
      return [{ ...base, label, blank: !p, span, title: `${head} · ${p ? `반복 단위: ${p}` : label} · 방문 ${span.map(visitNumber).join(' · ')}` }];
    }
    const p = said(l.policy), label = p ?? '재개 조건 미상';
    return [{ ...base, label, blank: !p, title: `${head} · ${p ? `재개: ${p}` : label}` }];
  });
}
/** Which way a drawn line runs for a link: 'forward' when the line's start is the card of the link's source visit, 'reverse' when
 * its end is, null when the line does not join the two cards (the mark has no place on it). */
export function linkDirection(lineFrom: string, lineTo: string, repFrom: string | null, repTo: string | null): 'forward' | 'reverse' | null {
  if (!repFrom || !repTo) return null;
  if (lineFrom === repFrom && lineTo === repTo) return 'forward';
  if (lineFrom === repTo && lineTo === repFrom) return 'reverse';
  return null;
}
/** The polyline read from the link's source end (reversed when the line runs the other way). */
export const fromSource = (pts: readonly Pt[], dir: 'forward' | 'reverse'): Pt[] => (dir === 'forward' ? [...pts] : [...pts].reverse());
/** The point d px along a polyline from its start, with the unit direction of the run it lies on; past the end, its last point. */
export function pointAlong(pts: readonly Pt[], d: number): { x: number; y: number; dx: number; dy: number } | null {
  if (pts.length < 2) return null;
  let left = Math.max(0, d);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!, len = Math.hypot(b.x - a.x, b.y - a.y); if (len < 0.01) continue;
    const dx = (b.x - a.x) / len, dy = (b.y - a.y) / len;
    if (left <= len || i === pts.length - 1) { const t = Math.min(left, len); return { x: a.x + dx * t, y: a.y + dy * t, dx, dy }; }
    left -= len;
  }
  return null;
}
const r1 = (n: number) => Math.round(n * 10) / 10;
/** The decision diamond of a branch: centred `at` px along the line from the source's exit, r its half-diagonal, two corners on
 * the line's axis and two across it. */
export function diamondMark(pts: readonly Pt[], at = 9, r = 6): { cx: number; cy: number; d: string } | null {
  const p = pointAlong(pts, at); if (!p) return null;
  const { x, y, dx, dy } = p, nx = -dy, ny = dx;
  return { cx: r1(x), cy: r1(y), d: `M${r1(x + dx * r)},${r1(y + dy * r)} L${r1(x + nx * r)},${r1(y + ny * r)} L${r1(x - dx * r)},${r1(y - dy * r)} L${r1(x - nx * r)},${r1(y - ny * r)} Z` };
}
/** The parallel bar: two short strokes across the line, `at` and `at + gap` px from the source's exit, each 2·half long. */
export function parallelBar(pts: readonly Pt[], at = 14, half = 7, gap = 4): string | null {
  const a = pointAlong(pts, at), b = pointAlong(pts, at + gap); if (!a || !b) return null;
  const seg = (p: { x: number; y: number; dx: number; dy: number }) => `M${r1(p.x - p.dy * half)},${r1(p.y + p.dx * half)} L${r1(p.x + p.dy * half)},${r1(p.y - p.dx * half)}`;
  return `${seg(a)} ${seg(b)}`;
}
/** The loop frame: the rectangle round the cards the loop spans, pad px clear of each; null when none is drawn. */
export function loopFrame(rects: readonly { x: number; y: number; w: number; h: number }[], pad = 14): { x: number; y: number; w: number; h: number } | null {
  if (!rects.length) return null;
  const x0 = Math.min(...rects.map(r => r.x)) - pad, y0 = Math.min(...rects.map(r => r.y)) - pad;
  const x1 = Math.max(...rects.map(r => r.x + r.w)) + pad, y1 = Math.max(...rects.map(r => r.y + r.h)) + pad;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
/** Where a loop frame's head label may sit, best first: on the frame's top edge at its left, then its right, then the bottom
 * edge's left and right (a legend over the frame line, inset 12px from the corner). */
export function frameLabelSpots(f: { x: number; y: number; w: number; h: number }, w: number, h: number): { x: number; y: number; w: number; h: number }[] {
  const left = f.x + 12, right = f.x + f.w - 12 - w;
  return [{ x: left, y: f.y - h / 2 }, { x: right, y: f.y - h / 2 }, { x: left, y: f.y + f.h - h / 2 }, { x: right, y: f.y + f.h - h / 2 }]
    .filter((_, i) => i % 2 === 0 || right > left).map(r => ({ ...r, w, h }));
}
/** A wait's line as a control line: solid, then dashed over its last `tail` px (3 on, 3 off) up to the destination; the whole
 * line dashed when it is shorter than twice the tail. */
export function waitDash(len: number, tail = 26, reverse = false): string {
  if (!(len > 0)) return '';
  if (len < tail * 2) return '4 3';
  const dashes: string[] = []; for (let left = tail; left > 0; left -= 6) dashes.push('3', '3');
  // A line drawn from the destination to the source dashes its start instead (its last gap is 0 so the pattern sums to len).
  return (reverse ? [...dashes, String(r1(len - tail)), '0'] : [String(r1(len - tail)), ...dashes]).join(' ');
}

/* ---------- 조건 선택 (spec §7: 그 조건일 때의 설계 경로, 관측 결과와 구별) ---------- */
/** The conditions a designed path offers as chips: each branch link's condition as written, each once, in link order. An
 * observed run offers none (it went one way; choosing a condition would read as a result it did not show): note says so. A tour
 * offers none. */
export function conditionChoice(u: ScenarioUnderstanding): { offer: boolean; conditions: string[]; note: string | null } {
  const conditions = [...new Set(u.links.filter(l => l.kind === 'branch').map(l => said(l.condition)).filter((c): c is string => !!c))];
  const kind = u.scenario?.kind ?? 'designed';
  if (!conditions.length) return { offer: false, conditions, note: null };
  if (kind === 'observed') return { offer: false, conditions, note: '관측 실행 · 조건 선택 없음' };
  if (kind === 'tour') return { offer: false, conditions, note: null };
  return { offer: true, conditions, note: null };
}
/** The design path under one condition: the links whose condition is that one, plus every link that carries none (a next, a
 * parallel, a loop, a wait, a branch with no condition), followed from the path's start; a branch whose condition is another
 * one (or unknown) is off, and so is what follows only from it. visits: the visits reached along the lit links (and the start). */
export function conditionPath(u: ScenarioUnderstanding, condition: string): { links: Set<string>; visits: Set<string>; off: Set<string> } {
  const allowed = (l: ScenarioUnderstanding['links'][number]) => l.kind !== 'branch' || l.condition === null || said(l.condition) === condition;
  const into = new Set(u.links.map(l => l.to));
  const starts = u.visits.filter(v => !into.has(v.id)).map(v => v.id);
  const visits = new Set(starts.length ? starts : u.visits.slice(0, 1).map(v => v.id)), links = new Set<string>();
  for (let grew = true; grew;) {
    grew = false;
    for (const l of u.links) if (!links.has(l.id) && allowed(l) && visits.has(l.from)) { links.add(l.id); visits.add(l.to); grew = true; }
  }
  return { links, visits, off: new Set(u.links.filter(l => !links.has(l.id)).map(l => l.id)) };
}

/* ---------- run gates on the path (spec §5.2) ---------- */
/** How many run gates each visit's part carries (gates: by area id), for the badge's 관문 mark; visits with none are left out. */
export function gateVisits(u: ScenarioUnderstanding, gates: (areaId: string) => number): Map<string, number> {
  const out = new Map<string, number>();
  for (const v of u.visits) { const n = v.partOnMap ? gates(v.areaId) : 0; if (n > 0) out.set(v.id, n); }
  return out;
}
