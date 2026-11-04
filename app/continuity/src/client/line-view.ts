/* What a line says and what the program put on the map (map-reading.13), the client's pure part.
 *
 * Program marks: a value the program, not the model, carried over from the record (a loop's unit from the part's own cadence
 * setting, its stop or resume from one of its condition rows, a kept state by its dotted name, a rule's place from a condition row;
 * the contract's program flag) reads with a small 「프로그램」 chip wherever it is shown, never as the model's answer. A loop carries
 * one flag for all of its items, so which item the program filled is told by where it came from: a unit that is one of the part's
 * settings verbatim, a stop or resume that is a condition row's then or else verbatim; when none of them can be told apart, every
 * item the loop says is marked (a value is never shown as the model's on a guess).
 *
 * The line (spec 2.4, 7): a relation whose reading names the fields of the format artifact it carries (payloadFields) draws its
 * label as a type chip: the artifact's name with up to three of its fields, '+N' for the rest; when the chip does not fit its line
 * it gives way one field at a time (the label room rules decide; nothing moves). Clicking it, or the line, lists the fields in the
 * pane under 「데이터 계약 · N 필드」. The picked line's pane block: 넘기는 것, 박자, 방식, 채널, the fields, and its quote. No DOM. */
import { MODE_LABEL, CHANNEL_LABEL } from '../shared/claim-topic.js';
import type { Channel, RelationMode } from '../shared/types.js';

/* ---------- program marks ---------- */
export const PROGRAM_LABEL = '프로그램';
export const PROGRAM_HINT = '기록에서 프로그램이 옮긴 값 · 모델 답 아님';
/** A value marked by the contract as the program's (absent or false: the model's, as read). */
export const isProgram = (x: { program?: boolean } | null | undefined): boolean => x?.program === true;
/** A rule carries a place the program put there (map-reading.11 anchors[].program). */
export const ruleHasProgram = (c: { anchors?: readonly { program?: boolean }[] }): boolean => (c.anchors ?? []).some(isProgram);
/** A rule carries a code device the program put there (map-reading.15 enforcedBy[].program, a refusal condition row's code). */
export const ruleHasProgramEnforce = (c: { enforcedBy?: readonly { kind: string; program?: boolean }[] }): boolean => (c.enforcedBy ?? []).some(e => e.kind === 'code' && isProgram(e));

export interface LoopLike { unit: string | null; stop: string | null; resume: string | null; program?: boolean }
export interface ConditionLike { then: string; else: string | null }
/** Which of a loop's items the program filled: none when the loop is the model's; else a unit that is one of the part's settings
 * verbatim and a stop or resume that is the then or else of one of its condition rows verbatim; when none of those holds, every
 * item the loop says (the flag is the loop's, and a program value is never shown as the model's). */
export function programLoopItems(loop: LoopLike | null | undefined, config: readonly string[], conditions: readonly ConditionLike[]): { unit: boolean; stop: boolean; resume: boolean } {
  if (!loop || !isProgram(loop)) return { unit: false, stop: false, resume: false };
  const outcome = (w: string | null) => !!w && conditions.some(c => c.then === w || c.else === w);
  const told = { unit: !!loop.unit && config.includes(loop.unit), stop: outcome(loop.stop), resume: outcome(loop.resume) };
  return told.unit || told.stop || told.resume ? told : { unit: !!loop.unit, stop: !!loop.stop, resume: !!loop.resume };
}
/** The loop line in its three parts ('반복 X', '정지 Y', '재개 Z'; '미상' for one the record left out), each with whether the
 * program filled it. Joined by ' · ' they read as expansion loopLine. */
export function loopSegments(loop: LoopLike, config: readonly string[], conditions: readonly ConditionLike[], unsaid = '미상'): { key: 'unit' | 'stop' | 'resume'; text: string; program: boolean }[] {
  const p = programLoopItems(loop, config, conditions);
  return [{ key: 'unit', text: `반복 ${loop.unit ?? unsaid}`, program: p.unit }, { key: 'stop', text: `정지 ${loop.stop ?? unsaid}`, program: p.stop }, { key: 'resume', text: `재개 ${loop.resume ?? unsaid}`, program: p.resume }];
}

/* ---------- the type chip on a line ---------- */
/** At most this many fields ride on the chip; the rest read as '+N'. */
export const CHIP_FIELDS = 3;
export interface ChipForm { name: string; cells: string[]; more: number }
/** The chip's forms, widest first: the artifact's name with min(3, n) fields, then one field fewer each time down to the name
 * alone, the rest always counted ('+N'). The label room rules take the first form that fits its line. */
export function typeChipForms(name: string, fields: readonly string[], max = CHIP_FIELDS): ChipForm[] {
  const n = fields.length, top = Math.min(max, n), out: ChipForm[] = [];
  for (let k = top; k >= 0; k--) out.push({ name, cells: fields.slice(0, k), more: n - k });
  return out;
}
/** A form as one line of text (its title and what a reader hears): 'name · a · b · c +N'. */
export const chipText = (f: ChipForm): string => [f.name, ...f.cells].join(' · ') + (f.more ? ` +${f.more}` : '');
/** The fields a drawn line carries: only when every relation it draws hands over the same thing (as its label says one payload);
 * then each field once, in the relations' order. [] otherwise. */
export function edgeFields(ids: readonly string[], said: ReadonlyMap<string, { payload: string | null; fields: readonly string[] }>): string[] {
  const payloads = new Set(ids.map(id => said.get(id)?.payload ?? null));
  if (payloads.size !== 1 || [...payloads][0] === null) return [];
  const out: string[] = [];
  for (const id of ids) for (const f of said.get(id)?.fields ?? []) if (!out.includes(f)) out.push(f);
  return out;
}
/** The pane's data contract: '데이터 계약 · N 필드' over the artifact's name and its fields, one cell each. null without fields. */
export function contractList(name: string | null, fields: readonly string[]): { head: string; name: string; cells: string[] } | null {
  return fields.length ? { head: `데이터 계약 · ${fields.length} 필드`, name: name ?? '산출물 이름 미기재', cells: [...fields] } : null;
}

/* ---------- the picked line's pane block ---------- */
export interface LineRead { payload: string | null; cadence: string | null; mode: RelationMode | null; channel: Channel | null; fields: readonly string[] }
export const LINE_BLANKS = { payload: '넘기는 것 미기재', cadence: '박자 미기재', mode: '설계·관찰 미기재', channel: '채널 미기재' } as const;
/** The block's lines in order: 넘기는 것, 박자, 방식, 채널, each its blank when the record left it out (never made up). */
export function lineFacts(r: LineRead): { key: 'payload' | 'cadence' | 'mode' | 'channel'; text: string; blank: boolean }[] {
  return [
    r.payload ? { key: 'payload', text: `넘기는 것 · ${r.payload}`, blank: false } : { key: 'payload', text: LINE_BLANKS.payload, blank: true },
    r.cadence ? { key: 'cadence', text: `박자 · ${r.cadence}`, blank: false } : { key: 'cadence', text: LINE_BLANKS.cadence, blank: true },
    r.mode ? { key: 'mode', text: `방식 · ${MODE_LABEL[r.mode]}`, blank: false } : { key: 'mode', text: LINE_BLANKS.mode, blank: true },
    r.channel ? { key: 'channel', text: `채널 · ${CHANNEL_LABEL[r.channel]}`, blank: false } : { key: 'channel', text: LINE_BLANKS.channel, blank: true }];
}
