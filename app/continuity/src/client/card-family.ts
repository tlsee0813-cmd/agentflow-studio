/* A card's family and template (map design v3 3.1–3.6, 4.1). Pure: no DOM, so the rules are tested on their own.
 * - Family from the type word alone (familyOf): 참여자 · 처리 (AI 판단 included) · 저장 · 촉발·관문, or 중립 for a part with no type
 *   word. Never from a name, never from an inside: an inside is a capability joined to the family (innerOf), so a session that
 *   gains children stays a participant and a loop with steps stays a process.
 * - Template (cardTemplate): the head (glyph tile, name, kind word with the lifecycle chip), at most three kind rows from the
 *   record's own fields (3.4), at most one quiet 「?」 slot for the kind's defining blank (3.5-1), the contract area, an inner line
 *   for a part with recorded steps, the sign row, and the bottom line (the operations report with its time and the author's tag).
 * - Contract (3.3, 3.6, principle 9): the current contract (map-reading.16) keeps no line per item for inputs, outputs or fields,
 *   so they are counted on one line ('받는 것 3 · 내는 것 2 · 항목 근거 미연결'), never drawn as pins. A pin row exists only for a
 *   port a model-written portMap row ties to a relation end (its quote is that port's evidence); a line meets the pin then, and
 *   every other line meets the card-level contact point (the contract area's middle). A name that matches a port, and the
 *   program's own port rows, stay candidates read in the panel: they never move a line.
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
/** The family of a part: its type word's, else neutral. The rest of the arguments are accepted and never read: an inside, steps
 * or a loop never change a family (they are the capability, innerOf). */
export function familyOf(type: PartType | null | undefined, _steps = 0, _loop = false, _children = 0): CardFamily {
  return type ? FAMILY_OF[type] : 'neutral';
}
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
/** The lifecycle chip (3.7): the record's state word for a part that is retired or not built ('폐기', '미구현'; '설계만' when the
 * line it rests on says so); null for any other state. Never a move to another group, never a colour. */
export function lifecycleOf(state: PartState | null | undefined, quote = ''): string | null {
  if (state === 'retired') return '폐기';
  if (state === 'unbuilt') return /설계만/.test(quote) ? '설계만' : '미구현';
  return null;
}

/** What the card is made from: the part's reading and what its adopted relations say of it (names of the parts at the other ends,
 * counted by channel). Every list as the record has it. */
export interface CardFacts {
  type: PartType | null;
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
}
export interface CardRow { label: string; value: string; program?: boolean; blank?: boolean }
export type CardContract =
  | { kind: 'pins'; inTitle: string; outTitle: string; ins: string[]; outs: string[]; unmapped: number }
  | { kind: 'lines'; lines: string[] };
export interface CardTemplate {
  family: CardFamily; inner: Inner; glyph: GlyphKey; kind: string;
  rows: CardRow[]; contract: CardContract;
  /** The inner line for recorded steps ('단계 7 · 명령별'), with the program's cut steps apart; null without steps to show. */
  innerLine: { text: string; program: number } | null;
  /** A loop container's well (container-view, 4.3): drawn at the near tier in place of the inner line, which the overview and
   * middle tiers keep; null for any other card. */
  well: Well | null;
  signs: boolean;
}

/** The most kind rows a card holds (the blank slot included), the most pins a side holds. */
export const KIND_ROWS = 3, PINS_MAX = 3;
const UNLINKED = '항목 근거 미연결';
/** A list on one row: two names, then '+N'. */
const listValue = (xs: readonly string[], k = 2) => [...xs.slice(0, k), ...(xs.length > k ? [`+${xs.length - k}`] : [])].join(' · ');
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
export function kindRows(f: CardFacts): CardRow[] {
  const t = f.type, rows: CardRow[] = [], cfg = f.config;
  const add = (label: string, value: string | null | undefined, extra: Partial<CardRow> = {}) => { if (value) rows.push({ label, value, ...extra }); };
  const blank = (label: string) => rows.push({ label, value: '?', blank: true });
  switch (t) {
    case 'person':
      add('지키는 규칙', f.personRules ? `${f.personRules}` : null);
      add('결정', f.controlOut?.length ? listValue(f.controlOut) : null);
      break;
    case 'session':
      add('요청자', f.controlIn?.length ? listValue(f.controlIn) : null);
      add('다루는 파일', f.fileRoles ? `${f.fileRoles}` : null);
      add('설정', cfg[0]);
      break;
    case 'external':
      add('내부', `기록 범위 밖${f.steps.length ? ` · 단계 ${f.steps.length}` : ''}`);
      break;
    case 'loop': {
      const lb = loopBody(f.loop?.unit, cfg, !!f.loopProgram?.unit);
      if (lb.text === '반복 단위 ?') blank('반복 단위'); else add('반복', lb.text.replace(/^반복 · /, ''), lb.program ? { program: true } : {});
      add('정지', f.loop?.stop, f.loopProgram?.stop ? { program: true } : {});
      add('재개', f.loop?.resume, f.loopProgram?.resume ? { program: true } : {});
      break;
    }
    case 'store':
      add('관계', (f.writers ?? 0) + (f.readers ?? 0) ? `쓰는 쪽 ${f.writers ?? 0} · 읽는 쪽 ${f.readers ?? 0}` : null);
      // 3.4 reads 「보존」 from config[0]; a setting does not say it is a retention, so it reads as the setting it is.
      add('설정', cfg[0]);
      if (!f.fields.length) blank('행 형식'); else if (!cfg.length) blank('보존 기간');
      break;
    case 'ai':
      add('맥락', f.inputs.length ? listValue(f.inputs) : null);
      add('기준', cfg[0]);
      if (f.outputs[0]) add('반환', f.outputs[0]); else blank('반환 형식');
      add('출구', f.conditions.length ? listValue([...new Set(f.conditions.map(c => c.then).filter(Boolean))]) : null);
      break;
    case 'timer': {
      const beats = cfg.filter(c => CADENCE.test(c));
      if (!beats.length) blank('일정'); else for (const b of beats.slice(0, 2)) add('주기', b);
      add('시간 기준', beats.length ? timeBasis(beats) : null);
      add('대상', f.controlOut?.length ? listValue(f.controlOut) : null);
      break;
    }
    case 'compute':
      add('계산', f.steps.length === 1 ? f.steps[0]!.does : null);
      add('설정', cfg[0]);
      break;
    case 'collector':
      add('출처', f.dataIn?.length ? listValue(f.dataIn) : null);
      add('박자', f.dataInCadence?.[0] ?? cfg.find(c => CADENCE.test(c)));
      break;
    case 'actor':
      add('효과', f.outputs[0]);
      // v2 7: the failure blank stands only beside an effect exit, and only while nothing the record says of the part reads as
      // failure handling (signs-view failureBlanks).
      if (f.outputs[0] && !f.failureSaid) blank('실패 대응');
      break;
    default:
      add('설정', cfg[0]);
  }
  // At most three, the blank kept: a row after the third gives way first, then the last row before the blank.
  const b = rows.findIndex(r => r.blank);
  if (rows.length <= KIND_ROWS) return rows;
  if (b < 0 || b < KIND_ROWS) return rows.slice(0, KIND_ROWS);
  return [...rows.filter(r => !r.blank).slice(0, KIND_ROWS - 1), rows[b]!];
}

/** The contract area (3.3): the pin rows of the ports a model portMap row ties to a line, else the counts on one line. A store's
 * columns are 쓰기 / 읽기 (the data's direction). A store's fields add a line of their own (a schema preview needs per-item
 * evidence, S9). */
export function contractOf(f: CardFacts): CardContract {
  const store = f.type === 'store', inT = store ? '쓰기' : '받는 것', outT = store ? '읽기' : '내는 것';
  const pins = f.pins ?? { in: [], out: [] };
  if (pins.in.length || pins.out.length)
    return { kind: 'pins', inTitle: inT, outTitle: outT, ins: [...new Set(pins.in)].slice(0, PINS_MAX), outs: [...new Set(pins.out)].slice(0, PINS_MAX), unmapped: f.unmapped ?? 0 };
  const lines: string[] = [];
  const io = [f.inputs.length ? `${inT} ${f.inputs.length}` : '', f.outputs.length ? `${outT} ${f.outputs.length}` : ''].filter(Boolean);
  lines.push(io.length ? `${io.join(' · ')} · ${UNLINKED}` : '데이터 입력·출력 포트 미기록');
  if (store && f.fields.length) lines.push(`필드 ${f.fields.length} · ${UNLINKED}`);
  return { kind: 'lines', lines };
}

/** The template of a part's card from its facts. */
export function cardTemplate(f: CardFacts): CardTemplate {
  const inner = innerOf(f.type, f.steps.length, !!f.loop, f.children ?? 0), program = f.steps.filter(s => s.program === true).length, recorded = f.steps.length - program;
  const unit = f.loop?.unit ?? null;
  const innerLine = inner === 'steps' || inner === 'list' || inner === 'both'
    ? { text: `단계 ${recorded}${inner === 'list' ? ' · 기록의 행 순서' : unit ? ` · ${unit}` : ''}`, program } : null;
  // A loop container (4.1, 4.3): only a recorded loop with recorded steps; never from the type word, a name or step names alone.
  const ws = f.steps.map(s => ({ name: s.name ?? '', program: s.program === true }));
  const well = f.loop && isContainer(ws, f.loop)
    ? containerBody(ws, f.loop, { conditions: f.conditions, portSteps: f.portSteps ?? [], stateVars: f.stateVars ?? 0, open: !!f.wellOpen, depth: f.wellDepth ?? 1 }) : null;
  return { family: familyOf(f.type), inner, glyph: f.type ?? 'neutral', kind: kindWord(f.type), rows: kindRows(f), contract: contractOf(f), innerLine, well, signs: !!f.signs };
}

/* ---------- heights (map design v3 3.8, 5.3, 9.5): as styles.css draws them at the near tier ---------- */
/** The card's base width (map px) and its name's room: 272 − 16 × 2 sides − 20 glyph − 8 gap = 212; a card with an inside gives
 * its fold toggle 28 more. */
export { CARD_W };
export const NAME_ROOM = CARD_W - 16 * 2 - 20 - 8, TOGGLE_W = 28;
/** Padding above and below; the head (name lines of 20 + the kind line 16 + 16 around); a kind row 20 and the rows' 12 after;
 * the contract's title 16, a pin row 24, its 8 after; a contract line 16; the inner line, the sign row and the bottom line. */
export const BORDER = 2, PAD_Y = 12, NAME_LH = 20, KIND_LH = 16, HEAD_GAP = 16, ROW_H = 20, ROWS_GAP = 12, PIN_TITLE = 16, PIN_H = 24, PIN_GAP = 8, LINE_H16 = 16, CONTRACT_PAD = 16, INNER_H = 24, SIGNS_H = 24, BOTTOM_H = 28, GRID = 8;
export interface CardHeights { head: number; rows: number; contract: number; inner: number; signs: number; bottom: number; total: number;
  /** From the card's top: the card-level contact point (the contract area's middle) and each pin's centre ('in:결과', 'out:결과'). */
  contact: number; pins: Record<string, number>;
  /** From the card's top: the first name line's middle, where a reference's port-less ear sits on a side (3.6). */
  ear: number }
export function cardHeights(t: CardTemplate, nameLines: number, planned = 0): CardHeights {
  const nl = Math.min(2, Math.max(1, Math.floor(nameLines) || 1));
  const head = nl * NAME_LH + KIND_LH + HEAD_GAP + planned;
  const rows = t.rows.length ? t.rows.length * ROW_H + ROWS_GAP : 0;
  const c = t.contract;
  const contract = c.kind === 'pins' ? PIN_TITLE + Math.max(c.ins.length, c.outs.length) * PIN_H + PIN_GAP + (c.unmapped ? LINE_H16 : 0) : CONTRACT_PAD + c.lines.length * LINE_H16;
  // A container's well is the near tier's content, so its height is the card's (the inner line reads in the same room further out).
  const inner = t.well ? wellHeight(t.well) : t.innerLine ? INNER_H : 0, signs = t.signs ? SIGNS_H : 0;
  // The 1px border a side is not added: at worst it takes 2px of the bottom padding, which stays inside the card.
  const raw = PAD_Y + head + rows + contract + inner + signs + BOTTOM_H + PAD_Y, total = Math.ceil(raw / GRID) * GRID;
  const top = BORDER / 2 + PAD_Y + head + rows, pins: Record<string, number> = {};
  if (c.kind === 'pins') {
    c.ins.forEach((n, i) => { pins[`in:${n}`] = top + PIN_TITLE + i * PIN_H + PIN_H / 2; });
    c.outs.forEach((n, i) => { pins[`out:${n}`] = top + PIN_TITLE + i * PIN_H + PIN_H / 2; });
  }
  const pinRows = c.kind === 'pins' ? PIN_TITLE + Math.max(c.ins.length, c.outs.length) * PIN_H : contract;
  return { head, rows, contract, inner, signs, bottom: BOTTOM_H, total, contact: top + pinRows / 2, pins, ear: BORDER / 2 + PAD_Y + NAME_LH / 2 };
}
/** The lines a name takes on the card: one, or two (the most drawn; a longer name is cut with an ellipsis, its whole in the tip). */
export function nameLinesOf(need: number, kids: boolean): 1 | 2 {
  return need > NAME_ROOM - (kids ? TOGGLE_W : 0) ? 2 : 1;
}
