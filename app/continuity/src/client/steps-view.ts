/* The detail view's inside (map spec 4, 외부 관계 R → 입력 포트 O → 내부 단계 S): the part's steps as a vertical list inside its
 * boundary, its ports on the sides, and a link from a port to a step only where the record explicitly maps them (map-reading.9
 * portMap). A port the record maps to no step ends at the boundary with '진입 단계 미상' (in) or '출구 단계 미상' (out): it is never
 * joined to a step by guess, and steps are never joined to one another (their order is not read; the list keeps the record's row
 * order). Pure: no DOM, so the rule is tested on its own. */

import { ruleSigns, placeName, type RuleClaim } from './signs-view.js';

export const UNMAPPED_IN = '진입 단계 미상', UNMAPPED_OUT = '출구 단계 미상';
export const unmappedMark = (direction: 'in' | 'out') => (direction === 'in' ? UNMAPPED_IN : UNMAPPED_OUT);

/** program (map-reading.14): a step the program cut from the part's own 3절 arrow chain (name only: it does nothing and uses nothing as read). */
export interface ChainStep { name: string; does: string | null; uses: string[]; program?: boolean }
/** One explicit correspondence of a line to a port and a step at this part (the part's own rows of portMap). program
 * (map-reading.14): a row the program put there (the one step of that end the records tie to the other end). */
export interface ChainMapRow { relationId: string; port: string; step: string; direction: 'in' | 'out'; program?: boolean }
/** A link drawn inside the boundary: from an input port to a step (in), or from a step to an output port (out); relationIds are
 * the lines the record maps through it (several lines may reach the same port and step: one link). program: true only when every
 * row through it is the program's (a row the reading itself wrote makes it the model's). */
export interface ChainLink { port: string; step: number; direction: 'in' | 'out'; relationIds: string[]; program?: boolean }
/** A port on the boundary: the steps it is mapped to (indexes into rows), and its blank when it is mapped to none. */
export interface ChainPort { port: string; direction: 'in' | 'out'; steps: number[]; mark: string | null }
/** A step box: its place in the record's list (index), and the ports mapped into it and out of it. */
export interface ChainRow extends ChainStep { index: number; ins: string[]; outs: string[] }
/** stray: rows naming a step or a port the part's list does not hold (not drawn, never re-attached elsewhere). */
export interface DetailChain { rows: ChainRow[]; ports: { in: ChainPort[]; out: ChainPort[] }; links: ChainLink[]; stray: ChainMapRow[] }

/** The detail chain: steps in the record's order, every port of each side with its mapped steps or its blank, the links (one per
 * port and step and direction) and the rows that could not be placed. inputs and outputs are the boundary's named ports. */
export function detailChain(steps: readonly ChainStep[], portMap: readonly ChainMapRow[], inputs: readonly string[], outputs: readonly string[]): DetailChain {
  const rows: ChainRow[] = steps.map((s, index) => ({ name: s.name, does: s.does, uses: [...s.uses], ...(s.program === true ? { program: true } : {}), index, ins: [], outs: [] }));
  const at = new Map(rows.map(r => [r.name, r.index] as const));
  const links: ChainLink[] = [], stray: ChainMapRow[] = [];
  for (const m of portMap) {
    const step = at.get(m.step), names = m.direction === 'in' ? inputs : outputs;
    if (step === undefined || !names.includes(m.port)) { stray.push({ ...m }); continue; }
    const had = links.find(l => l.port === m.port && l.step === step && l.direction === m.direction);
    if (had) { if (!had.relationIds.includes(m.relationId)) had.relationIds.push(m.relationId); if (m.program !== true) delete had.program; continue; }
    links.push({ port: m.port, step, direction: m.direction, relationIds: [m.relationId], ...(m.program === true ? { program: true } : {}) });
    const row = rows[step]!; (m.direction === 'in' ? row.ins : row.outs).push(m.port);
  }
  const side = (names: readonly string[], direction: 'in' | 'out'): ChainPort[] => names.map(port => {
    const mapped = [...new Set(links.filter(l => l.direction === direction && l.port === port).map(l => l.step))].sort((a, b) => a - b);
    return { port, direction, steps: mapped, mark: mapped.length ? null : unmappedMark(direction) };
  });
  return { rows, ports: { in: side(inputs, 'in'), out: side(outputs, 'out') }, links, stray };
}

/* ---------- what the program put inside (map-reading.14) ----------
 * A program step (steps[].program: a piece of the part's own 3절 arrow chain where the records give it no 4절 row) draws its box
 * with the 「프로그램」 chip and no does / uses area: it is a name only, never the model's reading of what the step does. A program
 * port-map row (portMap[].program) draws its port → step line dashed with the chip at the step end, and the pane's step view
 * says 「프로그램 대응」 beside the port. */
export const PROGRAM_STEP_HINT = '3절 흐름에서 프로그램이 나눈 단계 · 모델 답 아님';
export const PROGRAM_PORT_LABEL = '프로그램 대응';
export const PROGRAM_PORT_HINT = '기록이 이 선의 그쪽 끝에 묶은 단계가 하나뿐이라 프로그램이 이은 포트 대응 · 모델 답 아님';
/** A step box's face: the chip (program) and what it does and uses; a program step shows neither (whatever it carries). */
export function stepFace(s: ChainStep): { program: boolean; does: string | null; uses: string[]; hint: string | null } {
  return s.program === true ? { program: true, does: null, uses: [], hint: PROGRAM_STEP_HINT } : { program: false, does: s.does, uses: [...s.uses], hint: null };
}
/** A port → step line inside the boundary: dashed with the chip at its step end when the program made the correspondence. */
export function linkFace(l: Pick<ChainLink, 'program'>): { dashed: boolean; chipAt: 'step' | null } {
  return l.program === true ? { dashed: true, chipAt: 'step' } : { dashed: false, chipAt: null };
}
/** The ports a step is mapped to on each side (the pane's step view), each once, with whether only the program mapped it. */
export interface StepPort { port: string; program: boolean }
export function stepPorts(step: string, portMap: readonly ChainMapRow[]): { ins: StepPort[]; outs: StepPort[] } {
  const side = (direction: 'in' | 'out'): StepPort[] => {
    const out: StepPort[] = [];
    for (const m of portMap) {
      if (m.direction !== direction || m.step !== step) continue;
      const had = out.find(x => x.port === m.port);
      if (had) { if (m.program !== true) had.program = false; } else out.push({ port: m.port, program: m.program === true });
    }
    return out;
  };
  return { ins: side('in'), outs: side('out') };
}
/** How many steps the record wrote (its 4절 rows) and how many the program cut from the 3절 chain. */
export function stepCounts(steps: readonly { program?: boolean }[]): { recorded: number; program: number } {
  const program = steps.filter(s => s.program === true).length;
  return { recorded: steps.length - program, program };
}

/** A relation leaving the part (a line from it, or from inside it, to a part outside): its id and the part at the far end. */
export interface OutLine { relationId: string; far: string }
/** Who takes what a step hands over (spec 7, 단계에서 소비자): the far ends of the lines the record maps out of this step through a
 * port (mapped: true), else every line leaving the part, with no port (mapped: false: which of them this step feeds is not said). */
export function stepConsumers(step: string, portMap: readonly ChainMapRow[], out: readonly OutLine[]): { mapped: boolean; list: (OutLine & { port: string | null })[] } {
  const rows = portMap.filter(m => m.direction === 'out' && m.step === step);
  if (rows.length) {
    const list: (OutLine & { port: string | null })[] = [];
    for (const m of rows) { const line = out.find(o => o.relationId === m.relationId); if (line && !list.some(x => x.relationId === line.relationId)) list.push({ ...line, port: m.port }); }
    if (list.length) return { mapped: true, list };
  }
  return { mapped: false, list: out.map(o => ({ ...o, port: null })) };
}

/** The rule signs of the detail view (map spec 5.1, signs at the places they act): each rule on the step boxes, ports and ledger
 * cells its scope's name or its anchors name (signs-view rulePlacement: by name only, never by guess), a part rule at the
 * boundary head, a project rule at the view head, and a rule placed nowhere among the unplaced (배치 미정). steps: by the step's
 * index in the chain; ports by name per side; cells by field name. A part rule an anchor places is at the head and at its places. */
/** open: the boundary's rules that stand at no precise place as well (the head's '세부 접점 미정'). */
export interface DetailSigns<T> { steps: Map<number, T[]>; ports: { in: Map<string, T[]>; out: Map<string, T[]> }; cells: Map<string, T[]>; boundary: T[]; open: T[]; project: T[]; unplaced: T[] }
export function detailSigns<T extends RuleClaim>(chain: DetailChain, fields: readonly string[], rules: readonly T[]): DetailSigns<T> {
  const places = { steps: chain.rows.map(r => r.name), inputs: chain.ports.in.map(p => p.port), outputs: chain.ports.out.map(p => p.port), fields };
  const s = ruleSigns(rules, places), placed = new Set([...s.at.values()].flat());
  const out: DetailSigns<T> = { steps: new Map(), ports: { in: new Map(), out: new Map() }, cells: new Map(), boundary: s.boundary, open: s.boundary.filter(r => !placed.has(r)), project: s.project, unplaced: s.unplaced };
  for (const [id, list] of s.at) {
    const bar = id.indexOf('|'), kind = id.slice(0, bar), name = id.slice(bar + 1);
    if (kind === 'step') { const row = chain.rows.find(r => r.name === name); if (row) out.steps.set(row.index, list); }
    else if (kind === 'in') out.ports.in.set(name, list);
    else if (kind === 'out') out.ports.out.set(name, list);
    else if (kind === 'field') out.cells.set(name, list);
  }
  return out;
}

/* ---------- a run gate's decision step (spec 5.2: 실행 관문은 판정 단계와 실제 출구) ----------
 * The step a run gate stands on: the step whose name the gate's own words name (an anchor naming it exactly first, then the
 * longest step name its quote or its text holds; spacing, case and quote marks aside), else the first step, said so (matched
 * 'first'). Its exits are only those the record wrote for that step. From map-reading.12 on (conditions given, [] included) they
 * are the part's condition rows placed on that step (conditionPlacement): '조건 {when} → {then}' and '아니면 → {else}' (source
 * 'conditions'); for a reading older than .12 (conditions null or left out) a 참이면 / 거짓이면 item among what the step uses or in
 * what it does. None written reads as one '출구 미상'. Nothing is joined by guess. */
export interface GateLike { text: string; quote: string; anchors?: readonly { text: string }[] }
/** when: '참이면' / '거짓이면' as the step wrote it (before .12), or a condition's own words with '아니면' for its else (condition:
 * the condition's index in the part's list, branch: which of its outcomes). */
export interface DecisionExit { when: string; text: string; condition?: number; branch?: 'then' | 'else' }
/** source: 'conditions' when the exits come from the condition rows (map-reading.12); absent for the step's own words. */
export interface DecisionStep { index: number; name: string; matched: 'name' | 'first'; exits: DecisionExit[]; source?: 'conditions' }
export const EXIT_BLANK = '출구 미상';
export function decisionExits(step: Pick<ChainStep, 'does' | 'uses'>): DecisionExit[] {
  const out: DecisionExit[] = [];
  for (const src of [...step.uses, step.does ?? '']) for (const piece of src.split(/[,;/|]/)) {
    const m = /(참이면|거짓이면)\s*[:：→]?\s*(.+)$/.exec(piece.trim()); if (!m) continue;
    const text = m[2]!.trim(), when = m[1] as DecisionExit['when'];
    if (text && !out.some(x => x.when === when && x.text === text)) out.push({ when, text });
  }
  return out;
}
export function decisionStep(gate: GateLike, steps: readonly Pick<ChainStep, 'name' | 'does' | 'uses'>[], conditions: readonly ConditionLike[] | null = null): DecisionStep | null {
  if (!steps.length) return null;
  const names = steps.map(s => placeName(s.name));
  let index = -1;
  for (const a of gate.anchors ?? []) { const k = names.indexOf(placeName(a.text)); if (k >= 0) { index = k; break; } }
  if (index < 0) {
    const words = [placeName(gate.quote), placeName(gate.text)];
    let best = 0;
    names.forEach((n, k) => { if (n && n.length > best && words.some(w => w.includes(n))) { best = n.length; index = k; } });
  }
  const matched = index >= 0 ? 'name' : 'first', at = index >= 0 ? index : 0, s = steps[at]!;
  if (!conditions) return { index: at, name: s.name, matched, exits: decisionExits(s) };
  const placed = conditionPlacement(conditions, steps).steps.get(at) ?? [];
  const exits = placed.flatMap(({ index, condition: c }): DecisionExit[] => [{ when: c.when, text: c.then, condition: index, branch: 'then' },
    ...(c.else ? [{ when: '아니면', text: c.else, condition: index, branch: 'else' as const }] : c.incomplete ? [{ when: '아니면', text: ELSE_BLANKED, condition: index, branch: 'else' as const }] : [])]);
  return { index: at, name: s.name, matched, exits, source: 'conditions' };
}

/* ---------- a part's condition rows (map-reading.12 conditions[]: 조건 · 거부 · 분기) ----------
 * Each condition stands on the step its words name, by the rule chips' name rule (signs-view placeName: quote marks, spacing,
 * case and one kind word aside): its when first, then its then; a step whose name, or one of whose uses, equals those words; else
 * the longest step name or uses item (two characters or more) those words hold, the name before a uses item of the same length,
 * the first step in the record's row order on a tie. A condition naming no step stands at the part's boundary (단계 미상) and is
 * listed apart (자리 없는 조건): never placed by guess. On a step box a condition reads as a compact exit list: '조건 {when} →
 * {then}', and '아니면 → {else}' only when the record wrote one. Recipe .48 fix (A7): a condition whose 거짓이면 the reading blanked (its
 * cell past the map's bound, condition-else) is incomplete: its else exit reads '아니면 → 미상 …', never as if the record wrote none (a
 * condition with no else would read as one with nothing to do otherwise). */
export interface ConditionLike { when: string; then: string; else: string | null; incomplete?: boolean }
/** The else exit of an incomplete condition (its 거짓이면 left out for its length). */
export const ELSE_BLANKED = '미상 · 거짓이면 칸이 길어 비움(조건 불완전)';
/** How the condition reached its step: its when or its then, equal to the step's name or one of its uses, or holding it. */
export interface ConditionPlace { step: number; by: 'when' | 'then'; key: 'name' | 'uses'; how: 'equal' | 'holds' }
export const CONDITION_BLANK = '단계 미상', CONDITION_UNPLACED = '자리 없는 조건';
export function conditionPlace(c: ConditionLike, steps: readonly Pick<ChainStep, 'name' | 'uses'>[]): ConditionPlace | null {
  const keys = steps.map(s => ({ name: placeName(s.name), uses: s.uses.map(u => placeName(u)) }));
  for (const by of ['when', 'then'] as const) {
    const words = placeName(c[by]); if (!words) continue;
    for (const key of ['name', 'uses'] as const) {
      const k = keys.findIndex(x => (key === 'name' ? [x.name] : x.uses).includes(words));
      if (k >= 0) return { step: k, by, key, how: 'equal' };
    }
    let step = -1, key: 'name' | 'uses' = 'name', len = 1;
    for (let k = 0; k < keys.length; k++) {
      const x = keys[k]!;
      if (x.name.length > len && words.includes(x.name)) { len = x.name.length; step = k; key = 'name'; }
      for (const u of x.uses) if (u.length > len && words.includes(u)) { len = u.length; step = k; key = 'uses'; }
    }
    if (step >= 0) return { step, by, key, how: 'holds' };
  }
  return null;
}
/** Every condition with its place: by step index (each keeping the conditions' own order) and the ones naming no step. index:
 * the condition's place in the part's list (the key the views and the rule chips link it by). */
export interface PlacedCondition<T> { index: number; condition: T; place: ConditionPlace | null }
export interface ConditionPlacement<T> { steps: Map<number, PlacedCondition<T>[]>; unplaced: PlacedCondition<T>[] }
export function conditionPlacement<T extends ConditionLike>(conditions: readonly T[], steps: readonly Pick<ChainStep, 'name' | 'uses'>[]): ConditionPlacement<T> {
  const out: ConditionPlacement<T> = { steps: new Map(), unplaced: [] };
  conditions.forEach((condition, index) => {
    const place = conditionPlace(condition, steps), x = { index, condition, place };
    if (!place) { out.unplaced.push(x); return; }
    const l = out.steps.get(place.step); if (l) l.push(x); else out.steps.set(place.step, [x]);
  });
  return out;
}
/** A condition's exit lines on a step box: '조건 {when} → {then}', then '아니면 → {else}' when the record wrote it. */
export const conditionLines = (c: ConditionLike): string[] => [`조건 ${c.when} → ${c.then}`, ...(c.else ? [`아니면 → ${c.else}`] : c.incomplete ? [`아니면 → ${ELSE_BLANKED}`] : [])];
/** Recipe .48 fix: whether a stored condition's 거짓이면 was blanked by its reading (an exclusion condition-else on the condition's own row). */
export function elseBlanked(q: QuoteLike, exclusions: readonly { category: string | null; record: string | null; from: number | null; to: number | null }[]): boolean {
  return q.from !== undefined && q.to !== undefined && exclusions.some(x => x.category === 'condition-else' && x.record === q.record && x.from !== null && x.to !== null && x.from < q.to! && q.from! < x.to);
}
/** The condition whose row is the given quote (a rule anchor's): the same record and words (spacing aside), and the same span
 * when both carry one; -1 when none. */
export interface QuoteLike { record: string; quote: string; from?: number; to?: number }
export function conditionOfQuote(q: QuoteLike, conditions: readonly { quote: QuoteLike }[]): number {
  const n = (s: string) => s.replace(/\s+/g, ' ').trim();
  return conditions.findIndex(c => c.quote.record === q.record && n(c.quote.quote) === n(q.quote)
    && (q.from === undefined || c.quote.from === undefined || (q.from === c.quote.from && q.to === c.quote.to)));
}
