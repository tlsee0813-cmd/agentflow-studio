/* A card's family and template (map design v3 3.1–3.6, 4.1). Pure: no DOM, so the rules are tested on their own.
 * - Family from the type word alone (familyOf): 참여자 · 처리 (AI 판단 included) · 저장 · 촉발·관문, or 중립 for a part with no type
 *   word. Never from a name, never from an inside: an inside is a capability joined to the family (innerOf), so a session that
 *   gains children stays a participant and a loop with steps stays a process.
 * - Template (cardTemplate): the head (glyph tile, name, kind word with the lifecycle chip), at most three kind rows from the
 *   record's own fields (3.4), at most one quiet 「?」 slot for the kind's defining blank (3.5-1), the contract area, an inner line
 *   for a part with recorded steps, the sign row, and the bottom line (the operations report with its time and the author's tag).
 * - Contract (3.3, 3.6, principle 9, and the owner's 2026-11-04 decision in 0.1): the current contract (map-reading.16) keeps no
 *   line per item for inputs, outputs or fields, so the card shows them by name in a muted style (받는 것 · 내는 것 two names and
 *   '+N', a store's 필드 three and '+N'), each name under a dotted rule whose tip says the item has no line of its own; they never
 *   become pins or lines, and the words 「항목 근거 미연결」 read only in the panel. A pin row exists only for a port a
 *   model-written portMap row ties to a relation end (its quote is that port's evidence); a line meets the pin then, and every
 *   other line meets the card-level contact point (the contract area's middle). A name that matches a port, and the program's
 *   own port rows, stay candidates read in the panel: they never move a line. A part whose record names no input or output has
 *   no contract area on the card (「데이터 입력·출력 포트 미기록」 reads in the panel).
 * - Heights (cardHeights): the near tier's content, once, on an 8px grid; the zoom only chooses what is shown inside (card-budget
 *   tierFit), so a card's box, its contact point and its pins never move with the zoom (5.3). */
import type { PartState, PartType } from '../shared/types.js';
import { FAMILY_OF, TYPE_LABEL, type PartFamily } from '../shared/claim-topic.js';
import { LOOP_TYPES } from '../shared/map-reading.js';
import { CADENCE, loopBody } from './card-budget.js';
import type { GlyphKey } from './card-glyphs.js';
import { CARD_W } from './map-layout.js';
import { isContainer, containerBody, wellHeight, type Well } from './container-view.js';

export type CardFamily = PartFamily | 'neutral';
/** The family's word (the glyph tile's title). */
export const FAMILY_WORD: Record<CardFamily, string> = { participant: '참여자', process: '처리', store: '저장', trigger: '촉발·관문', neutral: '중립' };
/** The family of a part (recipe .45): its record family first (map-reading.19 part.family: C-PART 표현군, a v4 or v3 type word read through
 * the unambiguous words only), a gate in the trigger family's tint (its glyph its own, gateGlyph); else its type word's; else neutral (a
 * 미정 part, a part of no family or type). Given a type alone, the type word's. The rest of the arguments are accepted and never read: an
 * inside, steps or a loop never change a family (they are the capability, innerOf). */
export interface FamilyFacts { family?: string | null; type?: PartType | null }
export function familyOf(x: PartType | FamilyFacts | null | undefined, _steps = 0, _loop = false, _children = 0): CardFamily {
  if (x && typeof x === 'object') {
    if (x.family === 'gate') return 'trigger';
    if (x.family === 'participant' || x.family === 'process' || x.family === 'store' || x.family === 'trigger') return x.family;
    return x.type ? FAMILY_OF[x.type] : 'neutral';
  }
  return x ? FAMILY_OF[x] : 'neutral';
}
/** Recipe .45: the 미정 reasons (3.2) as the chip says them. */
export const UNDECIDED_WORD: Readonly<Record<string, string>> = { thin: '책임 설명 부족', mixed: '서로 다른 역할 혼재', scope: '대상 범위 불명확' };
/** The family facts a card carries (map-reading.19 familyRead): the family, its role word, 미정's reason, whether a type word's family is unclear. */
export interface CardFamilyFacts { family: string | null; role: string | null; reason: string | null; unclear: boolean }
/** The 「미정: 이유」 chip of a part the record could not give a family (3.2, 3.4), 「대응 불명확」 for a v4 word kept as written; null otherwise. */
export function undecidedChip(f: CardFamilyFacts | null | undefined): string | null {
  if (!f || f.family) return null;
  if (f.unclear) return `대응 불명확: ${f.role ?? '유형 낱말'}`;
  return f.reason ? `미정: ${UNDECIDED_WORD[f.reason] ?? f.reason}` : '미정';
}
/** The record's own family words (C-PART 표현군), by family. */
const RECORD_FAMILY_WORD: Readonly<Record<string, string>> = { participant: '참여', process: '처리', store: '저장', trigger: '촉발', gate: '관문' };
/** The pane head's family line (recipe .45 merged with display slice S9): 「표현군 처리 · 실행 조정」 for a part the record gave a family (the
 * role left off where it only repeats the kind word beside it), the 「미정: 이유」 chip, or 「대응 불명확: 루프·엔진」 for a v4 type word whose
 * family is unclear (review N8: this one reads in the pane only, never on the card); null for a part with no family facts. */
export function paneFamily(f: CardFamilyFacts | null | undefined, kindWord: string | null = null): { text: string; kind: 'family' | 'undecided' | 'unclear' } | null {
  if (!f) return null;
  if (!f.family) { const chip = undecidedChip(f); return chip ? { text: chip, kind: f.unclear ? 'unclear' : 'undecided' } : null; }
  const word = RECORD_FAMILY_WORD[f.family] ?? f.family, role = f.role && f.role !== kindWord ? f.role : null;
  return { text: `표현군 ${word}${role ? ` · ${role}` : ''}`, kind: 'family' };
}
/** A gate's own glyph in the trigger family's tint; any other family keeps its type's glyph. */
export const gateGlyph = (f: CardFamilyFacts | null | undefined, type: PartType | null | undefined): GlyphKey | null => f?.family === 'gate' ? 'gate' : type ?? null;
/** What a part holds inside, as a capability (4.1): its steps as an action well ('steps': a loop type with one recorded step, or a
 * type that may repeat with two steps and a recorded loop), its steps as a plain list ('list': two steps or more and no loop; no
 * order or repeat is given to them), its composition ('composition': it has children), both, or nothing. */
export type Inner = 'steps' | 'list' | 'composition' | 'both' | null;
export function innerOf(type: PartType | null | undefined, steps: number, loop: boolean, children: number): Inner {
  const repeats = !type || LOOP_TYPES.includes(type);
  const own: Inner = (type === 'loop' && steps >= 1) || (repeats && steps >= 2 && loop) ? 'steps' : steps >= 2 ? 'list' : null;
  return children > 0 ? (own ? 'both' : 'composition') : own;
}
/** The kind word under a card's name. */
export const kindWord = (type: PartType | null | undefined): string => (type ? TYPE_LABEL[type] : '유형 미상');
/** A part whose record names no type but records an inside of its own (steps, or a loop): its structure is a fact of the record,
 * so the card draws it (a structural outline) and says what is recorded — never a type made up for it. */
export const structuralOf = (type: PartType | null | undefined, steps: number, loop: boolean): boolean => !type && (steps > 0 || loop);
/** The kind line: the type word; for an untyped part with an inside of its own, 「유형 미기록 · 단계 N」 (or 「유형 미기록 · 반복」 for a
 * loop with no step recorded); 「유형 미상」 otherwise. */
export function kindLabel(type: PartType | null | undefined, steps: number, loop: boolean): string {
  if (type) return TYPE_LABEL[type];
  if (steps > 0) return `유형 미기록 · 단계 ${steps}`;
  return loop ? '유형 미기록 · 반복' : '유형 미상';
}
/** A group's kind line (display slice S8): a group is never 「유형 미상」. Untyped, it says what kind of group it is in the record's
 * word (실행 위치 · 구성 · 참여자 · 외부, or the app's own reading of its children; 묶음 when neither says) and how many parts it holds:
 * 「실행 위치 · 부분 5」. Typed, the type word first, then the axis and the count: 「계산 · 구성 2」 (as before for a composition). */
export function groupKind(type: PartType | null | undefined, axisWord: string | null | undefined, children: number): string {
  // Polish round fixes 1: one phrase for what a group holds on the card, the hover card and the ▸ control (「안쪽 N」).
  return type ? `${TYPE_LABEL[type]}${axisWord && axisWord !== '구성' ? ` · ${axisWord}` : ''} · 안쪽 ${children}` : `${axisWord ?? '묶음'} · 안쪽 ${children}`;
}
/** The glyph of an untyped group: a place pin for a group the record says is where things run (실행 위치), else the composition
 * squares; a typed group keeps its type's glyph (with the composition badge). */
export const groupGlyph = (axis: string | null | undefined): GlyphKey => (axis === 'place' ? 'place' : 'composition');
/** A group's 안에 row: the names of its first parts (the record's order), then how many more. */
export const MEMBER_NAMES = 3;
export function membersRow(names: readonly string[]): CardRow | null {
  const xs = names.filter(Boolean); if (!xs.length) return null;
  return { label: '안에', value: listValue(xs, MEMBER_NAMES), members: true };
}
/** A group card's tip: its kind line, whether the record named what kind of group it is or the app read it from its children, whether
 * it named a type, and every part in it by name. */
export function groupTip(t: Pick<CardTemplate, 'kind' | 'group'>, typed: boolean): string {
  const g = t.group; if (!g) return t.kind;
  const how = !g.word ? '묶음 뜻 미기록' : g.recorded ? `묶음 뜻 「${g.word}」 · 기록의 글자` : `묶음 뜻 「${g.word}」 · 안의 부분들로 읽음 (기록의 묶음 뜻 없음)`;
  return `${t.kind}\n${how}${typed ? '' : '\n기록이 이 묶음의 종류 단어를 말하지 않았다 (종류를 짐작하지 않음)'}\n안에 ${g.names.length}: ${g.names.join(' · ')}`;
}
/** The lifecycle chip (3.7): the record's state word for a part that is retired or not built ('폐기', '미구현'; '설계만' when the
 * line it rests on says so); null for any other state. Never a move to another group, never a colour. */
export function lifecycleOf(state: PartState | null | undefined, quote = ''): string | null {
  if (state === 'retired') return '폐기';
  if (state === 'unbuilt') return /설계만/.test(quote) ? '설계만' : '미구현';
  return null;
}

/** Pipeline .44: a part the record's C-STATUS rows say is deprecated or no longer maintained (유지 방침 사용 중단 권고 · 유지 종료), with
 * its successor when the row names one ('사용 중단 권고 → pump2'); null otherwise. It is not 폐기: the part still exists as recorded. */
export function maintenanceOf(claims: readonly { dimension: string; value: string; successor: string | null }[] | undefined): string | null {
  const c = (claims ?? []).find(x => x.dimension === 'maintenance' && (x.value === 'deprecated' || x.value === 'ended'));
  return c ? `${c.value === 'deprecated' ? '사용 중단 권고' : '유지 종료'}${c.successor ? ` → ${c.successor}` : ''}` : null;
}

/** What the card is made from: the part's reading and what its adopted relations say of it (names of the parts at the other ends,
 * counted by channel). Every list as the record has it. */
export interface CardFacts {
  type: PartType | null;
  /** Recipe .45 (map-reading.19): the part's record family, role word and 미정 reason (familyRead); absent before. */
  family?: CardFamilyFacts | null;
  config: readonly string[]; inputs: readonly string[]; outputs: readonly string[]; fields: readonly string[];
  loop: { unit: string | null; stop: string | null; resume: string | null } | null;
  /** Which loop items the program filled (line-view programLoopItems); each such row carries the 「프로그램」 chip. */
  loopProgram?: { unit: boolean; stop: boolean; resume: boolean };
  steps: readonly { name?: string; does: string | null; program?: boolean }[];
  /** The steps a model-written portMap row ties to a line (always kept in a container's well, 4.3). */
  portSteps?: readonly string[];
  /** A container's well (4.5): expanded by the person (every step shown), and how deep it sits among the containers drawn
   * around it on this map (1: none around it; past 2 the well reads as one nested row). */
  wellOpen?: boolean; wellDepth?: number;
  /** Beauty v2 (A1): false: the container's well is not drawn on its card (the two card sizes; its ↻ opens it in place, its steps read
   * in the detail view); absent: drawn as before. */
  wellShown?: boolean;
  conditions: readonly { then: string; else: string | null }[];
  stateVars?: number;
  /** The 파일 지도 rows (a session's 다루는 파일). */
  fileRoles?: number;
  /** The rules this part keeps by hand (enforcedBy person, the program's included). */
  personRules?: number;
  children?: number;
  /** The parts that start this one (incoming control lines) and that it starts (outgoing control lines), by name. */
  controlIn?: readonly string[]; controlOut?: readonly string[];
  /** The parts whose data lines come in (a collector's 출처) and those lines' cadences as written. */
  dataIn?: readonly string[]; dataInCadence?: readonly string[];
  /** A store's writers and readers (data relations in and out). */
  writers?: number; readers?: number;
  /** The ports a model-written portMap row ties to a relation end of this part (in: what it takes, out: what it hands over). */
  pins?: { in: readonly string[]; out: readonly string[] };
  /** The part's data lines that meet the card-level contact point (no model portMap row ties them to a pin). */
  unmapped?: number;
  /** The part carries sign tabs (규칙 · 관문 · 변경). */
  signs?: boolean;
  /** Something the record says of the part reads as failure handling (an actor's 실패 대응 is then not a blank). */
  failureSaid?: boolean;
  /** A group's parts by name, in the record's order, and what kind of group it is (map-regions groupWordOf: the axis key and its
   * word); absent for a part with no children. */
  members?: readonly string[]; groupAxis?: string | null; groupWord?: string | null; groupRecorded?: boolean;
  /** Cards v2 (spec cards v2 §1): the first sentence of what the part does (the card's 「하는 일」 line); the card has a way in (⤢ · ▸ N ·
   * 연결 N) so its foot is drawn; the display setting 「받는·내는 것 행」 (off by default) draws the contract's value rows. */
  role?: string | null; foot?: boolean; values?: boolean;
}
/** A kind row; unlinked: its value comes from a list the record keeps without a line per item (config, inputs, outputs), drawn
 * muted under a dotted rule (UNLINKED_TIP), never as structure. */
export interface CardRow { label: string; value: string; program?: boolean; blank?: boolean; unlinked?: boolean;
  /** A group's 안에 row (its first parts by name, from the record's grouping): never a kind row, never unlinked. */
  members?: boolean }
/** A row of list values shown by name (the first names, then how many more): every name is unlinked (UNLINKED_TIP). */
export interface ValueRow { label: string; names: string[]; more: number }
export type CardContract =
  | { kind: 'pins'; inTitle: string; outTitle: string; ins: string[]; outs: string[]; unmapped: number }
  | { kind: 'values'; rows: ValueRow[] };
export interface CardTemplate {
  family: CardFamily; inner: Inner; glyph: GlyphKey; kind: string;
  rows: CardRow[]; contract: CardContract;
  /** The inner line for recorded steps: its label ('단계 7', '단계 7 · 명령별'), the first recorded steps' names (steps carry their
   * quotes) and how many more, with the program's cut steps apart; null without steps to show. */
  innerLine: { text: string; names: string[]; more: number; program: number } | null;
  /** A loop container's well (container-view, 4.3): drawn at the near tier in place of the inner line, which the overview and
   * middle tiers keep; null for any other card. */
  well: Well | null;
  /** A loop container (a recorded loop with recorded steps), its well drawn or not. */
  container?: boolean;
  signs: boolean;
  /** An untyped part with recorded steps or a loop (structuralOf): drawn with the structural outline, its kind line naming what is
   * recorded (kindLabel). */
  structural: boolean;
  /** A part with children (display slice S8): drawn as a group (a stack of cards, a place's region face), its kind line the axis
   * and the count (groupKind), its 안에 row the first parts' names; null for any other card. */
  group: { axis: string | null; word: string | null; names: string[]; recorded: boolean } | null;
  /** Recipe .45: the 「미정: 이유」 chip of a part with no record family; null for any other card (review N8: 「대응 불명확」 reads in the pane only). */
  undecided?: string | null;
  /** Cards v2: the role line (null: none); the foot (the way in and the sign chips) drawn; the kind's defining blanks, by label, which
   * the card no longer draws (the pane says 「X 미기록」). */
  role?: string | null; foot?: boolean; blanks?: string[];
}

/** The most kind rows a card holds (the blank slot included), the most pins a side holds. */
export const KIND_ROWS = 3, PINS_MAX = 3;
/** The tip of a value shown without a line of its own (the words 「항목 근거 미연결」 read on the card only in this tip). */
export const UNLINKED_TIP = '항목 근거 미연결 — 정리가 이 항목의 원문 줄을 따로 저장하지 않음';
/** The names a value row shows: inputs and outputs two, a store's fields three; the first recorded steps three. */
export const IO_NAMES = 2, FIELD_NAMES = 3, STEP_NAMES = 3;
/** A list on one row: two names, then 「외 N」 (cards v2 §1: a count says what it counts; the row's label is the noun). */
const listValue = (xs: readonly string[], k = 2) => `${xs.slice(0, k).join(' · ')}${xs.length > k ? ` 외 ${xs.length - k}` : ''}`;
/** A schedule's time basis when its words name one (00:15Z, UTC, KST); null when they do not. */
export function timeBasis(texts: readonly string[]): string | null {
  for (const t of texts) {
    if (/\d{1,2}:\d{2}\s*Z\b|\bUTC\b|\bGMT\b/i.test(t)) return 'UTC';
    const m = /\b(KST|JST|PST|PDT|EST|EDT|CET|CEST)\b/.exec(t); if (m) return m[1]!;
  }
  return null;
}

/** The kind rows and the one defining blank (3.4, 3.5): in the table's order, at most KIND_ROWS together, the blank always kept
 * (it takes the place of the row it stands for). Only what the record says; a row with nothing to say is not drawn. */
export function kindRows(f: CardFacts, opts: { blanks?: boolean } = {}): CardRow[] {
  const t = f.type, rows: CardRow[] = [], cfg = f.config, withBlanks = opts.blanks !== false;
  const add = (label: string, value: string | null | undefined, extra: Partial<CardRow> = {}) => { if (value) rows.push({ label, value, ...extra }); };
  const U = { unlinked: true } as const;
  // Cards v2 §1: the card draws no blank row (the pane says 「X 미기록」); blanks: false leaves them out, so the rows that said
  // something keep the room.
  const blank = (label: string) => { if (withBlanks) rows.push({ label, value: '?', blank: true }); };
  switch (t) {
    case 'person':
      add('지키는 규칙', f.personRules ? `${f.personRules}` : null);
      add('결정', f.controlOut?.length ? listValue(f.controlOut) : null);
      break;
    case 'session':
      add('요청자', f.controlIn?.length ? listValue(f.controlIn) : null);
      add('다루는 파일', f.fileRoles ? `${f.fileRoles}` : null);
      add('설정', cfg[0], U);
      break;
    case 'external':
      add('내부', `기록 범위 밖${f.steps.length ? ` · 단계 ${f.steps.length}` : ''}`);
      break;
    case 'loop': {
      const lb = loopBody(f.loop?.unit, cfg, !!f.loopProgram?.unit);
      if (lb.text === '반복 단위 ?') blank('반복 단위'); else add('반복', lb.text.replace(/^반복 · /, ''), lb.program ? { program: true } : lb.used ? U : {});
      add('정지', f.loop?.stop, f.loopProgram?.stop ? { program: true } : {});
      add('재개', f.loop?.resume, f.loopProgram?.resume ? { program: true } : {});
      break;
    }
    case 'store':
      // Cards v2 §1: no 「관계 쓰는 쪽 N · 읽는 쪽 M」 on the card (the pane names the writers and readers).
      // 3.4 reads 「보존」 from config[0]; a setting does not say it is a retention, so it reads as the setting it is.
      add('설정', cfg[0], U);
      if (!f.fields.length) blank('행 형식'); else if (!cfg.length) blank('보존 기간');
      break;
    case 'ai':
      add('맥락', f.inputs.length ? listValue(f.inputs) : null, U);
      add('기준', cfg[0], U);
      if (f.outputs[0]) add('반환', f.outputs[0], U); else blank('반환 형식');
      add('출구', f.conditions.length ? listValue([...new Set(f.conditions.map(c => c.then).filter(Boolean))]) : null);
      break;
    case 'timer': {
      const beats = cfg.filter(c => CADENCE.test(c));
      if (!beats.length) blank('일정'); else for (const b of beats.slice(0, 2)) add('주기', b, U);
      add('시간 기준', beats.length ? timeBasis(beats) : null, U);
      add('대상', f.controlOut?.length ? listValue(f.controlOut) : null);
      break;
    }
    case 'compute':
      add('계산', f.steps.length === 1 ? f.steps[0]!.does : null);
      add('설정', cfg[0], U);
      break;
    case 'collector':
      add('출처', f.dataIn?.length ? listValue(f.dataIn) : null);
      if (f.dataInCadence?.[0]) add('박자', f.dataInCadence[0]); else add('박자', cfg.find(c => CADENCE.test(c)), U);
      break;
    case 'actor':
      add('효과', f.outputs[0], U);
      // v2 7: the failure blank stands only beside an effect exit, and only while nothing the record says of the part reads as
      // failure handling (signs-view failureBlanks).
      if (f.outputs[0] && !f.failureSaid) blank('실패 대응');
      break;
    default:
      add('설정', cfg[0], U);
  }
  // At most three, the blank kept: a row after the third gives way first, then the last row before the blank.
  const b = rows.findIndex(r => r.blank);
  if (rows.length <= KIND_ROWS) return rows;
  if (b < 0 || b < KIND_ROWS) return rows.slice(0, KIND_ROWS);
  return [...rows.filter(r => !r.blank).slice(0, KIND_ROWS - 1), rows[b]!];
}

/** The contract area (3.3): the pin rows of the ports a model portMap row ties to a line, else the list values by name (0.1, the
 * owner's decision): 받는 것 and 내는 것 two names each and '+N', a store's 필드 three and '+N' (a schema preview by name, never a
 * table), each name unlinked. A store's columns are 쓰기 / 읽기 (the data's direction). A list a kind row already names is not
 * repeated (AI 판단's 맥락 and 반환, an actor's 효과). No list at all: no rows (the panel says the ports are not recorded). */
export function contractOf(f: CardFacts): CardContract {
  const store = f.type === 'store', inT = store ? '쓰기' : '받는 것', outT = store ? '읽기' : '내는 것';
  const pins = f.pins ?? { in: [], out: [] };
  if (pins.in.length || pins.out.length)
    return { kind: 'pins', inTitle: inT, outTitle: outT, ins: [...new Set(pins.in)].slice(0, PINS_MAX), outs: [...new Set(pins.out)].slice(0, PINS_MAX), unmapped: f.unmapped ?? 0 };
  const rows: ValueRow[] = [], named = (label: string, xs: readonly string[], k: number) => { if (xs.length) rows.push({ label, names: xs.slice(0, k), more: Math.max(0, xs.length - k) }); };
  if (f.type !== 'ai') named(inT, f.inputs, IO_NAMES);
  if (f.type !== 'ai' && f.type !== 'actor') named(outT, f.outputs, IO_NAMES);
  if (store) named('필드', f.fields, FIELD_NAMES);
  return { kind: 'values', rows };
}

/** The template of a part's card from its facts. */
export function cardTemplate(f: CardFacts): CardTemplate {
  const inner = innerOf(f.type, f.steps.length, !!f.loop, f.children ?? 0), program = f.steps.filter(s => s.program === true).length, recorded = f.steps.length - program;
  const unit = f.loop?.unit ?? null;
  // The names of the first recorded steps (each carries its quote), in the record's row order; never an order or a repeat.
  const names = f.steps.filter(s => s.program !== true).map(s => s.name ?? '').filter(Boolean).slice(0, STEP_NAMES);
  const innerLine = inner === 'steps' || inner === 'list' || inner === 'both'
    ? { text: `단계 ${recorded}${inner !== 'list' && unit ? ` · ${unit}` : ''}`, names, more: Math.max(0, recorded - names.length), program } : null;
  // A loop container (4.1, 4.3): only a recorded loop with recorded steps; never from the type word, a name or step names alone.
  const ws = f.steps.map(s => ({ name: s.name ?? '', program: s.program === true }));
  const container = !!f.loop && isContainer(ws, f.loop);
  const well = f.loop && container && f.wellShown !== false
    // Polish round (spec-cards-v2 §1): the 「유지 상태 N」 compartment is no part of the card face (the pane's 구조 탭, the detail view
    // and the ⤢ tip name it; the 상태·공백 lens counts its unlinked items), so the card is measured without it.
    ? containerBody(ws, f.loop, { conditions: f.conditions, portSteps: f.portSteps ?? [], open: !!f.wellOpen, depth: f.wellDepth ?? 1 }) : null;
  // A group (S8): what kind of group in its kind line, its first parts in an 안에 row before the kind rows; never 「유형 미상」.
  const kids = f.children ?? 0, group = kids > 0 ? { axis: f.groupAxis ?? null, word: f.groupWord ?? null, names: [...(f.members ?? [])], recorded: !!f.groupRecorded } : null;
  const mr = group ? membersRow(group.names) : null;
  // Recipe .45: the record family first (a gate keeps the trigger tint with its own glyph); the kind line says the role word the record
  // wrote beside the family (「처리 · 실행 조정」 reads 「실행 조정」), or 「미정: 이유」 for a part the record could not give a family.
  // Review N8: a v4 type word whose family is unclear (「대응 불명확」) is no chip on the card (nothing to do there): the pane head says it.
  const fam = f.family ?? null, chip = fam?.unclear ? null : undecidedChip(fam), role = fam?.family && fam.role ? fam.role : null;
  return { family: familyOf({ family: fam?.family ?? null, type: f.type }), inner, glyph: gateGlyph(fam, f.type) ?? (group ? groupGlyph(group.axis) : 'neutral'),
    kind: group ? groupKind(f.type, group.word, kids) : role && !f.type ? role : chip && !f.type ? chip : kindLabel(f.type, recorded || f.steps.length, !!f.loop),
    rows: mr ? [mr, ...kindRows(f, { blanks: false })] : kindRows(f, { blanks: false }), contract: shownContract(f), innerLine, well, signs: !!f.signs,
    structural: !group && structuralOf(f.type, f.steps.length, !!f.loop), group, undecided: chip, container,
    role: f.role?.trim() ? f.role.trim() : null, foot: !!f.foot || !!f.signs, blanks: kindRows(f).filter(r => r.blank).map(r => r.label) };
}
/** Cards v2 §1: the contract's value rows (받는 것 · 내는 것 · 필드) only behind the display setting 「받는·내는 것 행」; pins (the
 * line ends attach there) always. */
function shownContract(f: CardFacts): CardContract {
  const c = contractOf(f); return c.kind === 'pins' || f.values ? c : { kind: 'values', rows: [] };
}

/* ---------- sizes (beauty v2 「읽히는 첫 전체 화면」 A1; map design v3 3.8, 5.3) ----------
 * Two card sizes at the middle and near views: 224 × 80 and 224 × 104 map px. The width never grows with a name. A name takes at most
 * two lines and the role one; a name that needs its second line beside a role takes the tall size instead of a smaller type. What a
 * part says past that (its kind rows, its inner line, its rules and changes, its relation count) reads in the hover card and the
 * pane. Groups and loop containers keep their own form under the same head: a group its 「안에」 row, a container its well (and the
 * value rows behind the display setting 「받는·내는 것 행」 keep theirs), each on the 8px grid and never under the tall size. */
/** The card's width (map px), its two heights, and its name's room: 224 − 16 left (the family stripe in it) − 12 right − 20 glyph −
 * 8 gap = 168; a card with an inside gives its fold toggle 28 more. */
export { CARD_W };
export const CARD_H = 80, CARD_H_TALL = 104, PAD_L = 16, PAD_R = 12;
export const NAME_ROOM = CARD_W - PAD_L - PAD_R - 20 - 8, TOGGLE_W = 28;
/** Padding above and below; the name lines (20), the kind line (16), the role line (18) and the gap before it; a row (20) and the
 * rows' gap; the inner line; the old pin rows (title, row, gap: the pins now sit on the card's sides). */
export const BORDER = 2, PAD_Y = 12, NAME_LH = 20, KIND_LH = 16, HEAD_GAP = 16, ROW_H = 20, ROWS_GAP = 12, ROLE_H = 18, ROLE_GAP = 6, DOT_W = 16, PIN_TITLE = 16, PIN_H = 24, PIN_GAP = 8, LINE_H16 = 16, INNER_H = 24, SIGNS_H = 24, BOTTOM_H = 28, GRID = 8;
/** Where a line meets a card that ties it to no pin (from the card's top): the middle of the short size, on both sizes, so the lines
 * between cards of one row run straight whatever their heights. Pins (a model portMap row) spread around it 16px apart (the port
 * order of the record), on the side the line takes. */
export const CONTACT_Y = CARD_H / 2, PIN_STEP = 16;
export interface CardHeights { head: number; rows: number; contract: number; inner: number; signs: number; bottom: number; total: number;
  /** From the card's top: the card-level contact point and each pin's centre ('in:결과', 'out:결과'). */
  contact: number; pins: Record<string, number>;
  /** From the card's top: the first name line's middle, where a reference's port-less ear sits on a side (3.6). */
  ear: number }
/** Pins on one side, centred on the contact point, PIN_STEP apart, kept inside the card's body (below its top 12, above its bottom 8). */
function sidePins(names: readonly string[], total: number): number[] {
  const n = names.length, step = Math.min(PIN_STEP, n > 1 ? (total - 20) / (n - 1) : PIN_STEP);
  const c = Math.min(Math.max(CONTACT_Y, 12 + step * (n - 1) / 2), total - 8 - step * (n - 1) / 2);
  return names.map((_, i) => c + (i - (n - 1) / 2) * step);
}
export function cardHeights(t: CardTemplate, nameLines: number, planned = 0): CardHeights {
  const nl = Math.min(2, Math.max(1, Math.floor(nameLines) || 1));
  const head = nl * NAME_LH + KIND_LH + planned;
  const role = t.role ? ROLE_GAP + ROLE_H : 0;
  // The forms a card keeps of its own: a group's 「안에」 row, the value rows behind the display setting, a loop container's well.
  const members = t.group && t.rows[0]?.members ? ROW_H + ROWS_GAP / 2 : 0;
  const c = t.contract, contract = c.kind === 'values' && c.rows.length ? ROWS_GAP / 2 + c.rows.length * ROW_H : 0;
  const inner = t.well ? wellHeight(t.well) : 0;
  const size = nl === 2 && t.role ? CARD_H_TALL : CARD_H;
  // The 1px border a side is not added: at worst it takes 2px of the bottom padding, which stays inside the card.
  // The change preview's lines under the name (planned) add to the card they belong to, whatever its size.
  const raw = PAD_Y + head + role + members + contract + inner + PAD_Y, own = members || contract || inner;
  const total = own ? Math.max(size + planned, Math.ceil(raw / GRID) * GRID) : size + (planned ? Math.ceil(planned / GRID) * GRID : 0);
  const pins: Record<string, number> = {};
  if (c.kind === 'pins') {
    const ins = sidePins(c.ins, total), outs = sidePins(c.outs, total);
    c.ins.forEach((n, i) => { pins[`in:${n}`] = ins[i]!; });
    c.outs.forEach((n, i) => { pins[`out:${n}`] = outs[i]!; });
  }
  return { head, rows: role + members, contract, inner, signs: 0, bottom: 0, total, contact: CONTACT_Y, pins, ear: BORDER / 2 + PAD_Y + NAME_LH / 2 };
}
/** A name in the pieces it may break between (a line break opportunity after each separator: · / . _ - : , and the spaces it has):
 * an identifier breaks at 'CancelToken·|signal', 'train.|py', never 'adapter|s'. Joined, the pieces are the name. */
export function nameBreaks(name: string): string[] {
  return name.split(/(?<=[·/._\-:,])(?=\S)/).filter(s => s.length > 0);
}
/** The lines a name takes on the card: one, or two (the most drawn; a longer name is cut with an ellipsis, its whole in the tip). */
export function nameLinesOf(need: number, kids: boolean, dot = false): 1 | 2 {
  return need > nameRoomOf(kids, dot) ? 2 : 1;
}
/** The name's room on a card: less the fold toggle with an inside, less the status dot's place when the card has one (cards v2). */
export const nameRoomOf = (kids: boolean, dot = false, ev = false): number => NAME_ROOM - (kids ? TOGGLE_W : 0) - (dot ? DOT_W : 0) - (dot && ev ? EV_W : 0);
/** Cards v2 review: the evidence chip beside the dot (behind 근거 꼬리표) takes this much of the name's row too (「보고」 at 11px with its
 * padding, border and the 4px gap), so a name measured with it on never runs under it. */
export const EV_W = 40;
