/* The first view of a map (display slice S10, Astra A6): which lens the map opens with, which real parts and lines it emphasises,
 * which focused groups or loops show their existing 「안에」 preview first, and the one guide line that says what the view starts from.
 * The project kind is neither stored nor judged: the choice is the record's own focus (C-HEAD 첫 구조 줄) matched to the map's real
 * structure, by three minimal rules only.
 * - A first-structure line that names a data transform AND a data line between the parts it names exists → 데이터 이동.
 * - One that names a start, coordination or loop AND that control line, loop scope, starting entry or human gate exists → 시작과 반복.
 * - Anything else → 구성. Weak or mixed signals → 구성, with at most two other foci offered. No ratio, share or count of anything.
 * - No line maps to the map (a v4 or v3 record has none): 구성 with no guide line, unless the structure alone is unambiguous (only data
 *   lines, or only control lines or loops): then that lens, saying so (「기록의 구조로 골랐어요」), with nothing emphasised.
 * What this never does (A6's fixed list): move, resize, recolour or hide anything; apply the legend's 「그것만」; change a card's identity,
 * family, ports or line grammar; touch coordinates, camera, selection or a saved view. Emphasis is a halo apart from the card's family
 * edge and label priority only. Pure: no DOM, no storage (the record's read and write take and give strings, wrapped by the caller). */
import type { Channel } from '../shared/types.js';

export type FirstLensId = 'compose' | 'data' | 'start';
export type FirstLensName = '구성' | '데이터 이동' | '시작과 반복';
export const FIRST_LENS_NAME: Readonly<Record<FirstLensId, FirstLensName>> = Object.freeze({ compose: '구성', data: '데이터 이동', start: '시작과 반복' });

/** A drawn part as the first view reads it: its id and name, its record row ID (B03), whether it holds parts (a group) or repeats (a
 * loop), whether it is a gate a person keeps, whether its family is a trigger (촉발), its C-ENTRY kinds and its C-STATE names. */
export interface FvPart { id: string; name: string; ref?: string | null; group?: boolean; loop?: boolean; humanGate?: boolean; trigger?: boolean; entries?: readonly (string | null)[]; states?: readonly string[] }
/** A relation: its id, its ends, its channel (null: a plain relation) and what it hands over as the record says (C-LINK payload). */
export interface FvLine { id: string; from: string; to: string; channel: Channel | null; payload?: string | null }
/** A C-LOOP row: the part owning it, its ID (B03:L01), the part of the loop just outside it, and its unit as written. */
export interface FvLoop { owner: string; ref: string; parentPart?: string | null; unit?: string | null }
/** Where the record says its first lines (the C-HEAD 「첫 구조 줄」 row), to open as the evidence. */
export interface FvQuote { record: string; quote: string; from?: number }
export interface FirstViewInput { firstLines: readonly string[]; parts: readonly FvPart[]; lines: readonly FvLine[]; loops?: readonly FvLoop[]; quote?: FvQuote | null }

/** One first-structure line matched to the map: the line, its place among the record's lines, the lens it reads with, the real parts it
 * names (in the line's order), the lines it rests on, the loops whose scope it names and its groups or loops whose preview shows first. */
export interface FvFocus { line: string; index: number; lens: FirstLensId; parts: string[]; lines: string[]; loops: string[]; previews: string[] }
export interface FirstView {
  lens: FirstLensName; lensId: FirstLensId;
  /** The parts and lines whose border and label take priority (never a colour, never a hide). */
  emphasis: { parts: string[]; lines: string[] };
  /** At most two focused groups or loops whose existing 「안에」 preview shows first. */
  previews: string[];
  /** The guide line beside the lens switch (without its 「바꾸기」), the record row it opens and what it used; null when the view is
   * 구성 for want of any signal (nothing to say). */
  reason: { text: string; quoteRef: FvQuote | null; line: string | null; lines: string[]; loops: string[] } | null;
  /** The focus the view uses (null: the structure alone, or nothing), and at most two other foci 「바꾸기」 lists. */
  focus: FvFocus | null; alternatives: FvFocus[];
  basis: 'record' | 'structure' | 'none';
}

/* ---------- words ---------- */
/** A data transform named: what is made, read, written, handed over, prepared, trained or answered (each stem with the syllables its
 * endings take: 넘기·넘긴·넘겨·넘김). */
export const DATA_WORDS = /변환|바꾸|바꾼|바꿔|바뀌|만들|만든|생성|읽|불러|쓰고|쓴다|써서|저장|적재|넘기|넘긴|넘겨|넘김|전달|건네|건넨|보내|보낸|받아|받은|받는|가져|모아|모은|수집|데이터|자료|입력|출력|결과물|요청|응답|토큰|파싱|파서|직렬화|전처리|준비|학습|평가|추론|체크포인트|산출|\b(?:transforms?|converts?|parses?|loads?|saves?|stores?|reads?|writes?|requests?|responses?|data)\b/i;
/** A start, coordination or loop named. */
export const START_WORDS = /시작|실행|돌리|돌린|돌려|호출|부르|부른|분배|나누|나눈|나눠|배정|배분|디스패치|조정|지휘|위임|맡기|맡긴|맡겨|반복|되풀이|루프|주기|마다|틱|프레임|스케줄|일정|예약|트리거|촉발|깨우|깨운|깨워|명령|재시도|대기|기다|종료|감시|이벤트|사건|신호|승인|검토|개입|프로세스|매\s?(?:번|회|단계|스텝|시간?|일|분|주|초)|\b(?:dispatch(?:es)?|schedules?|triggers?|loops?|ticks?|frames?|retr(?:y|ies)|spawns?|runs?|starts?|commands?)\b/i;
/** A loop scope named (a loop row counts only then). */
const LOOP_WORDS = /반복|되풀이|루프|주기|마다|틱|프레임|에포크|매\s?(?:번|회|단계|스텝|시간?|일|분|주|초)|\b(?:loops?|ticks?|frames?|epochs?|every)\b/i;
/** A time beat (매시, 매일, 주기, 틱, 정각, interval, cron): a loop word that says when, not over what. A loop whose unit is written and
 * is no beat (「화분마다」: over items) is not the loop a beat names. */
const BEAT = /매\s?(?:시간?|일|분|주|초)(?![가-힣])|주기|틱|정각|간격|\d\s*(?:ms|s|sec|m|min|h|d)\b|\d\s*(?:초|분|시간|일)|\b(?:ticks?|interval|cron|hourly|daily|period)\b/i;
const BEAT_ALL = new RegExp(BEAT.source, 'gi'), LOOP_ALL = new RegExp(LOOP_WORDS.source, 'gi');
/** A person stepping in (a human gate counts only then). */
const GATE_WORDS = /승인|검토|사람|개입|확인|허가|\b(?:review|approv)/i;
/** A flow drawn as a chain: it names a flow of either kind; the lines between the named parts say which. */
const ARROW = /→|->|⇒/;
/** The entry kinds that start a part on their own (a request hands data over; a call is called). */
export const STARTING_ENTRIES: ReadonlySet<string> = new Set(['command', 'schedule', 'message', 'script', 'resident']);

export const norm = (s: string): string => s.toLowerCase().replace(/[\s·_\-.,:;'"`()[\]{}「」『』<>‘’“”]/g, '');
const escRe = (t: string): string => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const cutLine = (t: string, n: number): string => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);
/** 을 or 를 after a quoted line, by its last syllable (을(를) after anything that is not Hangul). */
export function objectJosa(t: string): string {
  const c = t.replace(/[\s'’"」…]+$/, '').slice(-1), code = c.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 ? '을' : '를';
  return '을(를)';
}
/** The guide line: 「첫 보기: 시작과 반복 · 기록의 '명령을 나누는 실행기'를 중심으로」 (the line cut to 24, whole in the tip). */
export const REASON_CUT = 24;
export const reasonText = (lens: FirstLensId, line: string): string => { const q = cutLine(line, REASON_CUT); return `첫 보기: ${FIRST_LENS_NAME[lens]} · 기록의 '${q}'${objectJosa(line)} 중심으로`; };
export const STRUCTURE_REASON = '기록의 구조로 골랐어요';

/* ---------- matching a line to the map ---------- */
/** A name without its last Hangul syllable (기 · 부 · 자 · 소 …), when at least three characters are left; null otherwise. */
export function nameStem(name: string): string | null {
  const t = name.trim(), c = t.charCodeAt(t.length - 1);
  if (!(c >= 0xac00 && c <= 0xd7a3)) return null;
  const s = t.slice(0, -1).trimEnd(); return norm(s).length >= 3 ? s : null;
}
/** The real parts a first-structure line names, in the line's order: a part's whole name (a longer name wins where both stand), its
 * record row ID (B03), a loop's ID (B03:L01, its owner) or a C-STATE name the line repeats. Names under two characters never match. */
export function namedParts(line: string, parts: readonly FvPart[], loops: readonly FvLoop[] = []): { parts: string[]; loops: string[] } {
  const r = namedPartsAt(line, parts, loops); return { parts: r.at.map(([id]) => id), loops: r.loops };
}
/** namedParts with where each part is first named (its place in the line with spaces and punctuation taken out, as norm reads it). */
export function namedPartsAt(line: string, parts: readonly FvPart[], loops: readonly FvLoop[] = []): { at: [string, number][]; loops: string[] } {
  const n = norm(line), at = new Map<string, number>(), taken: [number, number][] = [], loopRefs: string[] = [];
  // A Korean name read as the work it names: 「일정 계산기」 as 「일정 계산」, 「푸시 발송기」 as 「푸시 발송」 (its last syllable off, three or more
  // characters left); the whole name first where both stand.
  const byName = parts.flatMap(p => { const k = norm(p.name), s = nameStem(p.name); return [{ p, k }, ...(s ? [{ p, k: norm(s) }] : [])]; })
    .filter(x => x.k.length >= 2).sort((a, b) => b.k.length - a.k.length);
  for (const { p, k } of byName) {
    for (let i = n.indexOf(k); i >= 0; i = n.indexOf(k, i + 1)) {
      if (taken.some(([a, b]) => i >= a && i + k.length <= b)) continue;
      taken.push([i, i + k.length]); if (!at.has(p.id)) at.set(p.id, i);
    }
  }
  // Record IDs as written in the line (B03, B03:L01); never a piece of a longer token.
  for (const m of line.matchAll(/(?<![A-Za-z0-9])(B\d{1,3})(?::(L\d{1,3}))?(?![\dA-Za-z])/g)) {
    const pos = norm(line.slice(0, m.index)).length;
    if (m[2]) { const l = loops.find(x => x.ref === `${m[1]}:${m[2]}`); if (l) { loopRefs.push(l.ref); if (!at.has(l.owner)) at.set(l.owner, pos); } continue; }
    const p = parts.find(x => x.ref === m[1]); if (p && !at.has(p.id)) at.set(p.id, pos);
  }
  for (const p of parts) for (const s of p.states ?? []) { const k = norm(s); if (k.length >= 2 && !at.has(p.id)) { const i = n.indexOf(k); if (i >= 0) at.set(p.id, i); } }
  return { at: [...at.entries()].sort((a, b) => a[1] - b[1]), loops: loopRefs };
}
/** The focused groups and loops whose 「안에」 preview shows first: in the focus's order, at most two. */
function previewsOf(parts: readonly string[], inp: FirstViewInput): string[] {
  const byId = new Map(inp.parts.map(p => [p.id, p])), owners = new Set((inp.loops ?? []).map(l => l.owner));
  return parts.filter(id => byId.get(id)?.group || byId.get(id)?.loop || owners.has(id)).slice(0, 2);
}
/** named: the parts the line names; startParts: those with the trigger it starts from (a beat line's 매시 틱), for its start reading. */
type Read = FvFocus & { data: string[]; control: string[]; startOk: boolean; dataOk: boolean; named: string[]; startParts: string[] };
/** What one first-structure line rests on in the map: the data lines and the control lines between the parts it names (a data line
 * touching a named part whose payload the line repeats counts too), the loops of named parts when it names a loop, a named part's
 * starting entry and a named human gate when it names one. null: it names no real part (a weak line). */
function analyse(line: string, index: number, inp: FirstViewInput): Read | null {
  const loops = inp.loops ?? [], named = namedParts(line, inp.parts, loops), M = new Set(named.parts);
  if (!M.size) return null;
  // The words are read with the named parts' names taken out (a part called 「Reader」 names no read).
  const byId = new Map(inp.parts.map(p => [p.id, p]));
  // A name is taken out as matched (spaces aside: 「일정계산기」 is 「일정 계산기」), so none of its words reads as a verb.
  const loose = (w: string) => new RegExp([...w.replace(/\s+/g, '')].map(escRe).join('\\s*'), 'gi');
  const said = named.parts.reduce((t, id) => { const nm = byId.get(id)?.name.trim(); if (!nm || nm.length < 2) return t;
    const s = nameStem(nm); return [nm, ...(s ? [s] : [])].reduce((x, w) => x.replace(loose(w), ' '), t); }, line);
  const n = norm(line), arrow = ARROW.test(line), dataWord = DATA_WORDS.test(said), startWord = START_WORDS.test(said), loopWord = LOOP_WORDS.test(said);
  const between = (l: FvLine) => l.from !== l.to && M.has(l.from) && M.has(l.to);
  const paid = (l: FvLine) => (M.has(l.from) || M.has(l.to)) && !!l.payload && norm(l.payload).length >= 2 && n.includes(norm(l.payload));
  const data = inp.lines.filter(l => l.channel === 'data' && (between(l) || paid(l))).map(l => l.id);
  // Where it starts: a line that names a start (a beat, or a start word that is no mere loop word) whose start is not among the parts
  // it names takes the trigger one control line before them (a trigger family or a starting C-ENTRY), and that control line. One
  // neighbour only, never a data line.
  const beat = BEAT.test(said), startish = beat || START_WORDS.test(said.replace(LOOP_ALL, ' '));
  const starts = (p: FvPart | undefined) => !!p && (!!p.trigger || (p.entries ?? []).some(k => !!k && STARTING_ENTRIES.has(k)));
  const inner = inp.lines.filter(l => l.channel === 'control' && between(l)).map(l => l.id);
  const starters = startish && !inner.length ? [...new Set(inp.lines.filter(l => l.channel === 'control' && M.has(l.to) && !M.has(l.from) && starts(byId.get(l.from))).map(l => l.from))] : [];
  const S = new Set([...starters, ...M]);
  const control = starters.length ? inp.lines.filter(l => l.channel === 'control' && l.from !== l.to && S.has(l.from) && S.has(l.to)).map(l => l.id) : inner;
  const any = inp.lines.filter(between).map(l => l.id);
  // A loop row counts when the line writes its ID, its unit, or a loop word for it: a beat alone names a loop over time, never one
  // whose written unit is no beat (「매시」 is not 「화분마다」).
  const generic = LOOP_WORDS.test(said.replace(BEAT_ALL, ' '));
  const fits = (l: FvLoop) => generic || !l.unit || BEAT.test(l.unit) || (norm(l.unit).length >= 2 && n.includes(norm(l.unit)));
  const loopScope = loopWord ? [...new Set([...named.loops, ...loops.filter(l => S.has(l.owner) && fits(l)).map(l => l.ref)])] : named.loops;
  const entry = startWord && named.parts.some(id => (byId.get(id)?.entries ?? []).some(k => !!k && STARTING_ENTRIES.has(k)));
  const gate = GATE_WORDS.test(said) && named.parts.some(id => byId.get(id)?.humanGate);
  const looped = loopScope.length > 0 || (loopWord && named.parts.some(id => byId.get(id)?.loop));
  const dataOk = (dataWord || arrow) && data.length > 0;
  const startOk = ((startWord || arrow) && control.length > 0) || (startWord && (looped || entry || gate));
  const lens: FirstLensId = dataOk && !startOk ? 'data' : startOk && !dataOk ? 'start' : 'compose';
  const startParts = [...starters.filter(id => !M.has(id)), ...named.parts], own = lens === 'start' ? startParts : named.parts;
  return { line, index, lens, parts: own, lines: lens === 'data' ? data : lens === 'start' ? control : any, loops: loopScope, previews: previewsOf(own, inp), data, control, startOk, dataOk, named: named.parts, startParts };
}
const plain = (f: FvFocus): FvFocus => ({ line: f.line, index: f.index, lens: f.lens, parts: [...f.parts], lines: [...f.lines], loops: [...f.loops], previews: [...f.previews] });

/** The map's first view (see the head of this file). */
export function firstView(inp: FirstViewInput): FirstView {
  const lines = (inp.firstLines ?? []).map(x => x.trim()).filter(Boolean).slice(0, 3);
  const foci = lines.map((l, i) => analyse(l, i, inp)).filter((x): x is Read => !!x);
  if (!foci.length) return structureOnly(inp);
  const quoteRef = inp.quote ?? null;
  const out = (lensId: FirstLensId, focus: FvFocus, alternatives: FvFocus[]): FirstView => ({
    lens: FIRST_LENS_NAME[lensId], lensId, emphasis: { parts: [...focus.parts], lines: [...focus.lines] }, previews: [...focus.previews],
    reason: { text: reasonText(lensId, focus.line), quoteRef, line: focus.line, lines: [...focus.lines], loops: [...focus.loops] },
    focus: plain(focus), alternatives: alternatives.slice(0, 2).map(plain), basis: 'record' });
  // A mixed line offers itself twice: once by its data lines, once by its control lines and loops.
  const asData = (f: Read): FvFocus => ({ ...f, lens: 'data', parts: f.named, lines: f.data, loops: [], previews: previewsOf(f.named, inp) });
  const asStart = (f: Read): FvFocus => ({ ...f, lens: 'start', parts: f.startParts, lines: f.control, previews: previewsOf(f.startParts, inp) });
  const asOwn = (f: Read): FvFocus => (f.dataOk ? asData(f) : f.startOk ? asStart(f) : f);
  const dataFoci = foci.filter(f => f.dataOk), startFoci = foci.filter(f => f.startOk);
  if (dataFoci.length && startFoci.length) {
    // Two foci of equal standing (or one line naming both): 구성, the first of each offered, the emphasis on what both name.
    const d = dataFoci[0]!, s = startFoci[0]!, first = d.index <= s.index ? d : s;
    const parts = [...new Set([...d.named, ...s.startParts])], ls = [...new Set([...d.data, ...s.control])];
    return out('compose', { ...first, lens: 'compose', parts, lines: ls, loops: [...s.loops], previews: previewsOf(parts, inp) }, [asData(d), asStart(s)]);
  }
  const decisive = dataFoci[0] ?? startFoci[0];
  if (decisive) {
    const focus = asOwn(decisive);
    return out(focus.lens, focus, foci.filter(f => f !== decisive).map(asOwn));
  }
  // The lines name real parts but no flow the map has: 구성, on the first line's parts.
  return out('compose', foci[0]!, foci.slice(1));
}
/** No first line maps to the map: the structure alone, only when it is unambiguous (presence, never a share). */
function structureOnly(inp: FirstViewInput): FirstView {
  const none: FirstView = { lens: '구성', lensId: 'compose', emphasis: { parts: [], lines: [] }, previews: [], reason: null, focus: null, alternatives: [], basis: 'none' };
  if (!inp.parts.length) return none;
  const hasData = inp.lines.some(l => l.channel === 'data'), hasStart = inp.lines.some(l => l.channel === 'control') || (inp.loops ?? []).length > 0 || inp.parts.some(p => p.loop);
  // Neither kind drawn: 구성, which is what the map opens with anyway, so there is nothing to say either.
  if (hasData === hasStart) return none;
  const lensId: FirstLensId = hasData ? 'data' : hasStart ? 'start' : 'compose';
  return { ...none, lens: FIRST_LENS_NAME[lensId], lensId, reason: { text: `첫 보기: ${FIRST_LENS_NAME[lensId]} · ${STRUCTURE_REASON}`, quoteRef: null, line: null, lines: [], loops: [] }, basis: 'structure' };
}

/** The C-HEAD row that holds the first lines, as written in the records (the newest record that has one): its whole row line, to open. */
export function headQuote(records: readonly { id: string; text: string }[]): FvQuote | null {
  for (let i = records.length - 1; i >= 0; i--) {
    const r = records[i]!, re = /^[^\n]*\|\s*(?:교체 항목\s*)?첫 구조 줄\s*\|[^\n]*$/gm;
    let last: RegExpExecArray | null = null; for (let m = re.exec(r.text); m; m = re.exec(r.text)) last = m;
    if (last) { const lead = last[0].length - last[0].trimStart().length; return { record: r.id, quote: last[0].trim(), from: last.index + lead }; }
  }
  return null;
}

/* ---------- what the person did with it, per map ---------- */
/** The first view as applied to a map, kept per map (localStorage, wrapped by the caller): the lens it set, the emphasis and previews it
 * put (by part and relation ids, so a target that disappears drops alone), the guide line it showed, whether the person switched the
 * emphasis off, and how it came (auto on the first visit, or the person's 「추천 첫 보기로」 or an offered focus). */
export const FIRST_VIEW_KEY = 'agentflow.studio.firstview.1';
export interface FirstViewRecord { lens: FirstLensId; parts: string[]; lines: string[]; previews: string[]; reason: string | null; line: string | null; off: boolean; by: 'auto' | 'person';
  /** Beauty v5: the 「먼저 보는 흐름」 the person chose for this map (a rule's candidate by its key, or 「전체 관계」), kept over the rules. */
  flow?: { rule: 'scenario' | 'summary' | 'head' | 'entry' | 'all'; key: string } | null }
export function recordOf(v: FirstView, by: FirstViewRecord['by'], focus: FvFocus | null = null): FirstViewRecord {
  if (focus) return { lens: focus.lens, parts: [...focus.parts], lines: [...focus.lines], previews: focus.previews.slice(0, 2), reason: reasonText(focus.lens, focus.line), line: focus.line, off: false, by };
  return { lens: v.lensId, parts: [...v.emphasis.parts], lines: [...v.emphasis.lines], previews: [...v.previews], reason: v.reason?.text ?? null, line: v.reason?.line ?? null, off: false, by };
}
export function readFirstView(raw: string | null, map: string): FirstViewRecord | null {
  try {
    const r = raw ? JSON.parse(raw)?.[map] : null; if (!r || typeof r !== 'object') return null;
    const ids = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string').slice(0, 64) : []);
    const lens: FirstLensId = r.lens === 'data' || r.lens === 'start' ? r.lens : 'compose';
    return { lens, parts: ids(r.parts), lines: ids(r.lines), previews: ids(r.previews).slice(0, 2), reason: typeof r.reason === 'string' ? r.reason : null, line: typeof r.line === 'string' ? r.line : null, off: r.off === true, by: r.by === 'person' ? 'person' : 'auto',
      ...(r.flow && typeof r.flow === 'object' && ['scenario', 'summary', 'head', 'entry', 'all'].includes(r.flow.rule) && typeof r.flow.key === 'string' ? { flow: { rule: r.flow.rule, key: r.flow.key.slice(0, 600) } } : {}) };
  } catch { return null; }
}
export function writeFirstView(raw: string | null, map: string, rec: FirstViewRecord): string {
  let all: Record<string, FirstViewRecord> = {};
  try { const p = raw ? JSON.parse(raw) : {}; if (p && typeof p === 'object' && !Array.isArray(p)) all = p; } catch { /* a broken record starts over */ }
  all[map] = rec; return JSON.stringify(all);
}
/** One draw of a map against its first view: what it keeps, whether the first view is still to come, and whether the recommendation
 * is applied now (its lens set, its record written). kept: the record kept for the map (from storage when the map opens, the one in
 * hand on a later draw); chosen: the person kept a lens for it; pending: no first view has happened yet (true when the map opens);
 * hasParts: the map has parts now. An empty map records nothing and stays pending: the draw that first has parts (the first record
 * applied, after create → paste) is the first visit. Once a view stands or the person chose a lens, a later draw never switches. */
export interface FvStep { rec: FirstViewRecord | null; pending: boolean; apply: boolean }
export function firstViewStep(st: { kept: FirstViewRecord | null; chosen: boolean; pending: boolean; hasParts: boolean }, v: FirstView): FvStep {
  if (st.kept) return { rec: st.kept, pending: false, apply: false };
  if (!st.pending || st.chosen) return { rec: null, pending: false, apply: false };
  if (!st.hasParts) return { rec: null, pending: true, apply: false };
  return { rec: recordOf(v, 'auto'), pending: false, apply: true };
}
/** Whether the person kept a lens for this map before (a lens record written by a lens switch or the legend): restored, never overridden. */
export function lensChosen(raw: string | null, map: string): boolean {
  try { const r = raw ? JSON.parse(raw)?.[map] : null; return !!r && typeof r === 'object'; } catch { return false; }
}
/** A kept first view against the map now: an emphasised part or line, or a preview, that no longer exists drops alone (never a
 * substitute picked); the lens and the guide line stay. */
export function keepExisting(rec: FirstViewRecord, parts: ReadonlySet<string>, lines: ReadonlySet<string>): FirstViewRecord {
  return { ...rec, parts: rec.parts.filter(p => parts.has(p)), lines: rec.lines.filter(l => lines.has(l)), previews: rec.previews.filter(p => parts.has(p)) };
}
/** Whether the view now differs from the recommendation (「추천 첫 보기로」 is offered then): another lens, emphasis or previews, or the
 * emphasis switched off. */
export function differs(rec: FirstViewRecord | null, lens: string, v: FirstView): boolean {
  if (!rec) return v.lensId !== lens || v.emphasis.parts.length > 0;
  const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every(x => b.includes(x));
  return lens !== v.lensId || (rec.off && v.emphasis.parts.length > 0) || !same(rec.parts, v.emphasis.parts) || !same(rec.lines, v.emphasis.lines) || !same(rec.previews, v.previews);
}
