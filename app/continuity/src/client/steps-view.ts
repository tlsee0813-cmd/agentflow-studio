/* The detail view's inside (map spec 4, 외부 관계 R → 입력 포트 O → 내부 단계 S): the part's steps as a vertical list inside its
 * boundary, its ports on the sides, and a link from a port to a step only where the record explicitly maps them (map-reading.9
 * portMap). A port the record maps to no step ends at the boundary with '진입 단계 미상' (in) or '출구 단계 미상' (out): it is never
 * joined to a step by guess, and steps are never joined to one another (their order is not read; the list keeps the record's row
 * order). Pure: no DOM, so the rule is tested on its own. */

export const UNMAPPED_IN = '진입 단계 미상', UNMAPPED_OUT = '출구 단계 미상';
export const unmappedMark = (direction: 'in' | 'out') => (direction === 'in' ? UNMAPPED_IN : UNMAPPED_OUT);

export interface ChainStep { name: string; does: string | null; uses: string[] }
/** One explicit correspondence of a line to a port and a step at this part (the part's own rows of portMap). */
export interface ChainMapRow { relationId: string; port: string; step: string; direction: 'in' | 'out' }
/** A link drawn inside the boundary: from an input port to a step (in), or from a step to an output port (out); relationIds are
 * the lines the record maps through it (several lines may reach the same port and step: one link). */
export interface ChainLink { port: string; step: number; direction: 'in' | 'out'; relationIds: string[] }
/** A port on the boundary: the steps it is mapped to (indexes into rows), and its blank when it is mapped to none. */
export interface ChainPort { port: string; direction: 'in' | 'out'; steps: number[]; mark: string | null }
/** A step box: its place in the record's list (index), and the ports mapped into it and out of it. */
export interface ChainRow extends ChainStep { index: number; ins: string[]; outs: string[] }
/** stray: rows naming a step or a port the part's list does not hold (not drawn, never re-attached elsewhere). */
export interface DetailChain { rows: ChainRow[]; ports: { in: ChainPort[]; out: ChainPort[] }; links: ChainLink[]; stray: ChainMapRow[] }

/** The detail chain: steps in the record's order, every port of each side with its mapped steps or its blank, the links (one per
 * port and step and direction) and the rows that could not be placed. inputs and outputs are the boundary's named ports. */
export function detailChain(steps: readonly ChainStep[], portMap: readonly ChainMapRow[], inputs: readonly string[], outputs: readonly string[]): DetailChain {
  const rows: ChainRow[] = steps.map((s, index) => ({ name: s.name, does: s.does, uses: [...s.uses], index, ins: [], outs: [] }));
  const at = new Map(rows.map(r => [r.name, r.index] as const));
  const links: ChainLink[] = [], stray: ChainMapRow[] = [];
  for (const m of portMap) {
    const step = at.get(m.step), names = m.direction === 'in' ? inputs : outputs;
    if (step === undefined || !names.includes(m.port)) { stray.push({ ...m }); continue; }
    const had = links.find(l => l.port === m.port && l.step === step && l.direction === m.direction);
    if (had) { if (!had.relationIds.includes(m.relationId)) had.relationIds.push(m.relationId); continue; }
    links.push({ port: m.port, step, direction: m.direction, relationIds: [m.relationId] });
    const row = rows[step]!; (m.direction === 'in' ? row.ins : row.outs).push(m.port);
  }
  const side = (names: readonly string[], direction: 'in' | 'out'): ChainPort[] => names.map(port => {
    const mapped = [...new Set(links.filter(l => l.direction === direction && l.port === port).map(l => l.step))].sort((a, b) => a - b);
    return { port, direction, steps: mapped, mark: mapped.length ? null : unmappedMark(direction) };
  });
  return { rows, ports: { in: side(inputs, 'in'), out: side(outputs, 'out') }, links, stray };
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
