/* Display slice S9: the reading pane's 구조 tab reads like an explanation for a newcomer, not a debug dump. Its pure part.
 *
 * The words the pane shows for what the record leaves out, for what the program (not the AI) carried over and for the record's own
 * bookkeeping are said in plain Korean here, once ('어느 단계에 해당하는지 기록에 없음', not '적용 위치 미해결'). Nothing is hidden:
 * an unknown stays on screen in plain words; the record's terms keep living in the tips, in 근거 and in the small 「읽는 법」 at the
 * end of 구조. The loop's fields read as one line, a small 「표에서」 right after each field the program filled (never after another
 * field), the record's loop table (every C-LOOP row) nests under the loop it runs in, and a variant reads by what it is and when it is chosen.
 * No DOM; app.ts renders it. Other surfaces (the cards, the detail view, the handover) keep their own words. */
import { RULE_BLANKS, RULE_DESIGN_PROGRAM, ANCHOR_LABEL, ENFORCER_LABEL, GATE_BLANK } from './signs-view.js';
import { programLoopItems, type LoopLike, type ConditionLike } from './line-view.js';
import type { AnchorKind, EnforcerKind } from '../shared/types.js';

/** What a value the record left out reads as in the pane (never an empty cell, never '미상'). */
export const PLAIN_UNSAID = '기록에 없음';
/** The one mark for a value the program carried over from the record's tables (the cards and the detail view say 「프로그램」). */
export const PLAIN_PROGRAM = '표에서 채움';
export const PLAIN_PROGRAM_HINT = '앱이 기록의 표에서 옮겨 채운 값 · AI가 읽어 낸 답이 아님 (지도의 다른 곳에서는 「프로그램」)';

/* ---------- the head's line: how far the records of the part go ---------- */
/** The ladder (요청 · 보고 · 확인) in words a newcomer reads without the ladder's terms. */
export function ladderWords(l: { ask: boolean; report: boolean; check: boolean }): string {
  if (l.check) return l.report ? '보고와 확인 자료가 모두 있음' : '확인 자료가 있음';
  if (l.report) return l.ask ? '요청과 결과 보고가 있음 · 확인 자료는 아직 없음' : '결과 보고만 있음 · 확인 자료는 아직 없음';
  if (l.ask) return '요청만 있음 · 결과 보고는 아직 없음';
  return '이 부분의 요청·보고·확인 기록이 아직 없음';
}

/* ---------- a line's row in 받는 것 · 내는 것 ---------- */
/** How a line was read, as its row says it: a line seen running says so ('실행에서 봄'); one read from code or documents (설계, most
 * lines) says nothing on the row (its tip keeps 「설계」), so 「· 설계」 does not end every row. */
export const portModeWord = (mode: 'design' | 'observed' | null | undefined): string | null => (mode === 'observed' ? '실행에서 봄' : null);
/** A condition row inside 조건: its words without the leading 「조건 」 the section's title already says. */
export const conditionPlain = (text: string): string => text.replace(/^조건\s+/, '');

/* ---------- a rule's fields ---------- */
const BLANK_WORDS: Record<string, string> = {
  [RULE_BLANKS.anchors]: '어느 단계·입출력에 해당하는지 기록에 없음',
  [RULE_BLANKS.design]: '이 규칙을 지키는 코드·조건이 기록에 없음',
  [RULE_BLANKS.check]: '이 규칙을 확인하는 검사가 기록에 없음',
  [RULE_BLANKS.enforce]: '무엇이 이 규칙을 지키는지 기록에 없음',
  [RULE_BLANKS.scope]: '어디까지 적용되는지 기록에 없음',
  [RULE_BLANKS.nowhere]: '이 지도에 그 자리가 없음',
  '시각 미기재': '작성 시각 기록에 없음',
  '자리 미기재': '파일 위치 기록에 없음',
  '단계 미상': '어느 단계인지 기록에 없음',
  [GATE_BLANK]: '경로 위의 판정인지 개발 중 검사인지 기록에 없음',
  '미상': PLAIN_UNSAID
};
/** A blank or record term as the pane says it; other words as they are. */
export const plainBlank = (text: string): string => BLANK_WORDS[text] ?? text;
/** A rule's reach ('범위 · 부분 전체' → '이 부분 전체에 적용'); a scope found nowhere keeps saying so. */
export function plainScope(text: string): string {
  if (text === RULE_BLANKS.scope) return plainBlank(text);
  const m = /^범위 · (.+)$/.exec(text); if (!m) return text;
  const parts = m[1]!.split(' · ').map(x => x.trim()).filter(Boolean);
  const head = parts[0]!, rest = parts.slice(1).map(x => (x === RULE_BLANKS.nowhere ? plainBlank(x) : x === '세부 접점 미정' ? '정확한 단계는 기록에 없음' : x));
  const where = head === '부분 전체' ? '이 부분 전체' : head === '프로젝트 전체' ? '프로젝트 전체' : head;
  return [`${where}에 적용`, ...rest].join(' · ');
}
/** Where a rule's place came from, in plain words (명시 · 해석 · 프로그램). */
export const ANCHOR_PLAIN: Record<AnchorKind | 'program', string> = { stated: '기록에 적힘', inferred: '다른 줄에서 이어 읽음', program: PLAIN_PROGRAM };
export const anchorPlain = (label: string): string => (label === ANCHOR_LABEL.stated ? ANCHOR_PLAIN.stated : label === ANCHOR_LABEL.inferred ? ANCHOR_PLAIN.inferred : label === '프로그램' ? ANCHOR_PLAIN.program : label);
/** What keeps a rule, in plain words: '코드 · X' stays (a name), the two blanks say what is missing. */
export function enforcePlain(kind: EnforcerKind, line: string): string {
  if (kind === 'none') return '지키는 장치가 없다고 기록됨';
  if (kind === 'unknown') return '무엇이 지키는지 기록에 없음';
  return line.startsWith(`${ENFORCER_LABEL[kind]} · `) ? `${ENFORCER_LABEL[kind]} ${line.slice(ENFORCER_LABEL[kind].length + 3)}` : line;
}
/** The 설계 대응 line when only the program's code device answers it: said once, and not at all when a 보장 line already carries the
 * program's mark (the same fact twice). */
export function designProgramLine(designProgram: string | null, enforce: readonly { program: boolean }[]): string | null {
  if (designProgram !== RULE_DESIGN_PROGRAM) return null;
  return enforce.some(e => e.program) ? null : '지키는 코드는 앱이 조건 표에서 이어 붙임';
}
/** The rules group's count of rules standing at no precise place ('배치 미정 K'), plainly; only when there is more than one rule
 * (one rule's own row already says it). */
export const unplacedPlain = (unplaced: number, rules: number): string | null => (unplaced && rules > 1 ? `${unplaced}개는 어느 단계에 붙는지 기록에 없음` : null);

/* ---------- the loop in one line ---------- */
/** The small mark right after a field the program filled ('단위 빈 명령 1회 「표에서」'): on that field only, never after a field the
 * program did not fill (contract map-reading.13: a value the program carried over is marked, never read as the model's answer). */
export const PLAIN_PROGRAM_FIELD = '표에서';
export type LoopField = 'unit' | 'stop' | 'resume';
export const LOOP_FIELD_WORD: Record<LoopField, string> = { unit: '단위', stop: '멈춤', resume: '다시 시작' };
const sameWords = (a: string, b: string) => { const k = (s: string) => s.replace(/`/g, '').replace(/\s+/g, ' ').trim().toLowerCase(); return k(a) === k(b); };
/** The loop's fields in one compact line ('단위 빈 명령 1회 · 멈춤 끝 또는 측정 실패 · 다시 시작 기록에 없음'), each field with whether
 * the program filled it (segs: its own 「표에서」 goes right after it, never after another field); program: the filled fields' words.
 * shown: the record's loop table rows read right under the line: a unit or a stop one of those rows already says is left out of the
 * line (the table says it; the same words twice is noise); the resume always stays (no row says it). only: the fields to read (the
 * picked step's 실패·재개 reads the stop and the resume). */
export function loopLinePlain(loop: LoopLike, config: readonly string[], conditions: readonly ConditionLike[],
  o: { shown?: readonly { unit: string | null; stop: string | null }[]; only?: readonly LoopField[] } = {}): { text: string; program: string[]; segs: { key: LoopField; text: string; program: boolean }[] } {
  const p = programLoopItems(loop, config, conditions), rows = o.shown ?? [];
  const said = (key: 'unit' | 'stop', v: string | null) => !!v && rows.some(r => !!r[key] && sameWords(r[key]!, v));
  const all: { key: LoopField; text: string; program: boolean }[] = [
    { key: 'unit', text: `${LOOP_FIELD_WORD.unit} ${loop.unit ?? PLAIN_UNSAID}`, program: p.unit },
    { key: 'stop', text: `${LOOP_FIELD_WORD.stop} ${loop.stop ?? PLAIN_UNSAID}`, program: p.stop },
    { key: 'resume', text: `${LOOP_FIELD_WORD.resume} ${loop.resume ?? PLAIN_UNSAID}`, program: p.resume }];
  const segs = all.filter(x => (!o.only || o.only.includes(x.key)) && !(x.key === 'unit' && said('unit', loop.unit)) && !(x.key === 'stop' && said('stop', loop.stop)));
  return { text: segs.map(x => x.text).join(' · '), program: segs.filter(x => x.program).map(x => LOOP_FIELD_WORD[x.key]), segs };
}
/** The record's loop table (C-LOOP rows) as a tree: each row after the row it runs in (depth 1, 2, ...), the rows whose outer loop
 * is not among them first in their own order; outer: the outer loop named outside this part ('Scheduler'), else null. A cycle of
 * parents never loops: a row is placed once. */
export interface LoopRowLike { recordRef: string; parentRef: string | null; parentPart: string | null; unit: string | null; count: string | null; stop: string | null }
export function loopTree<T extends LoopRowLike>(loops: readonly T[]): { loop: T; depth: number; outer: string | null }[] {
  const refs = new Set(loops.map(l => l.recordRef)), out: { loop: T; depth: number; outer: string | null }[] = [], seen = new Set<T>();
  const visit = (l: T, depth: number) => {
    if (seen.has(l)) return; seen.add(l);
    out.push({ loop: l, depth, outer: l.parentRef && !refs.has(l.parentRef) ? (l.parentPart ?? l.parentRef) : null });
    for (const x of loops) if (x.parentRef === l.recordRef && x !== l) visit(x, depth + 1);
  };
  for (const l of loops) if (!l.parentRef || !refs.has(l.parentRef)) visit(l, 0);
  for (const l of loops) visit(l, 0);
  return out;
}
/** Whether the loop table reads beside the loop line: two rows or more, or one row when the part carries no loop line. */
export const showLoopRows = (rows: number, hasLoop: boolean): boolean => rows > 1 || (rows === 1 && !hasLoop);
/** One loop table row in words: what it repeats over, how many times and when it stops (each only when said; unit always). */
export const loopRowPlain = (l: LoopRowLike, outer: string | null): string =>
  [l.unit ?? `단위 ${PLAIN_UNSAID}`, l.count, l.stop ? `멈춤 ${l.stop}` : null, outer ? `${outer}의 반복 안에서` : null].filter(Boolean).join(' · ');

/* ---------- a variant ---------- */
const TOGETHER_PLAIN: Record<string, string> = { exclusive: '한 번에 하나만', combined: '함께 쓸 수 있음', unknown: '함께 쓸 수 있는지 기록에 없음' };
/** A variant (C-VARIANT row) by what it is and when it is chosen: its implementing part ('사용자 지정' for the user's), the choice
 * condition (or its blank), and whether it goes beside the others (with the range the record gives). */
export function variantPlain(v: { implementer: string; condition: string | null; together: string; togetherScope: string | null; selector: { who: string | null } }): { name: string; when: string; note: string } {
  return { name: v.implementer === 'user' ? '사용자 지정 구현' : v.implementer, when: v.condition ? `${v.condition}일 때` : `고르는 조건 ${PLAIN_UNSAID}`,
    note: [`${TOGETHER_PLAIN[v.together] ?? v.together}${v.togetherScope ? ` (${v.togetherScope})` : ''}`, v.selector.who ? `고르는 쪽 ${v.selector.who}` : null].filter(Boolean).join(' · ') };
}

/* ---------- 「읽는 법」: the few words the pane still uses, at the end of 구조 ---------- */
export const READING_GUIDE: readonly { term: string; text: string }[] = [
  { term: '• 점', text: '그 줄이 기대는 원문이 있다는 표시예요. 가리키거나 초점을 두면 근거 번호와 원문이 보이고, 누르면 근거 탭의 그 자리로 가요.' },
  { term: `${PLAIN_PROGRAM} · ${PLAIN_PROGRAM_FIELD}`, text: '앱이 기록의 표에서 옮겨 채운 값이에요. AI가 읽어 낸 답이 아니에요. 줄 안의 「표에서」는 바로 앞의 칸만 그렇다는 뜻이에요.' },
  { term: PLAIN_UNSAID, text: '기록이 말하지 않은 것이에요. 없다는 뜻이 아니라, 모른다는 뜻이에요.' },
  { term: '기록에 적힘 · 다른 줄에서 이어 읽음', text: '규칙이 붙는 자리를 기록이 직접 말했는지, 다른 줄에서 이어 읽었는지예요.' },
  { term: '목록으로만 적힌 값', text: '정리가 목록 칸에만 적은 값이라 줄마다 원문을 짚을 수 없어요. 근거 탭에서도 같은 이름으로 모여 있어요.' }];
/** One word for the state a part keeps between runs, on 구조 and 근거 alike (the record's term 「유지 상태」 stays in the tips). */
export const PLAIN_KEPT = '기억하는 값';
/** 받는 것 · 내는 것 when the reading lists no inputs/outputs item for the part (map-reading.16; its lines attach at the card): with
 * lines below, the rows read from those lines; with none, a neutral blank. Never 「…의 이름은 기록에 없음」 over rows that name them. */
export const noPortsPlain = (lines: boolean): string => (lines ? '이 부분이 받는 것·내는 것을 항목으로 적은 기록은 없음 · 아래는 선에서 읽은 것' : '받는 것·내는 것을 적은 기록 없음');
