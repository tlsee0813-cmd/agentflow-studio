import { plainLabel } from './word-level.js';
/* v14 A (spec 1): the landed state is the clear state. At rest (nothing picked, no lens picked, no plan open) a map whose record gives a main
 * flow (먼저 볼 연결's lines) draws that flow and its cards at full strength with their labels, and everything else quiet: every other card
 * whole and readable (its words keep a 4.5:1 contrast; only its colour and edge step back), every other line thin and at about a third of
 * its strength, its verb label left to its hover (a condition's ◇ and words stay). Nothing is folded or hidden; hovering a card or a line
 * brings its neighbourhood up, and a pick lights the pick's neighbourhood instead (v13 light).
 * A plain caption near the title says what is lit, with 「모두 진하게」 one press away; that choice is kept per project in this browser
 * (try/catch: without storage it holds for the page). A map with no main flow lands with everything at normal strength (no caption).
 * Pure: no DOM; the page applies it (app.ts, the V14-A hooks). */

export const CLEAR_KEY = 'af.clear.v1';
/** The caption's words: what is lit, and the way to the other strength. */
export const ALL_STRONG_WORD = '모두 진하게', FLOW_STRONG_WORD = '주 흐름만 진하게';
/** What the lit lines are, in plain words, by where the record gives them (first-flow's rules). */
export function litWhat(rule: string | null): string {
  return rule === 'entry' ? '기록된 시작과 거기서 나가는 연결' : rule === 'scenario' ? '기록된 시나리오의 흐름' : '기록이 말한 주 흐름';
}
/** The caption: on (the clear state) 「진하게: 기록이 말한 주 흐름 · 다른 연결 n개는 옅게」 and the way to 모두 진하게; off, the way back. */
export function clearCaption(on: boolean, quiet: number, rule: string | null): { text: string; button: string; tip: string } {
  if (on) return { text: `진하게: ${litWhat(rule)}${quiet > 0 ? ` · 다른 연결 ${quiet}개는 옅게` : ''}`, button: ALL_STRONG_WORD,
    tip: `다른 연결은 지우거나 접지 않고 옅게 그렸어요 · 카드나 선에 마우스를 올리면 그 연결이 진해져요 · 「${ALL_STRONG_WORD}」로 모든 연결을 같은 굵기로 봐요` };
  return { text: '모든 연결을 같은 굵기로 보는 중', button: FLOW_STRONG_WORD, tip: `${litWhat(rule)}만 진하게, 다른 연결은 옅게 그려요` };
}
/** How many relations the quiet lines hold: every relation drawn on its own or in a summary line, less those of the lit lines. */
export function quietCount(lines: readonly { ids: readonly string[]; lit: boolean }[]): number {
  const lit = new Set(lines.filter(l => l.lit).flatMap(l => l.ids));
  return new Set(lines.filter(l => !l.lit).flatMap(l => l.ids).filter(id => !lit.has(id))).size;
}
/** Whether the clear state holds: a main flow is lit at rest and the person did not choose 모두 진하게 for this project. */
export const clearOn = (flowLitAtRest: boolean, allStrong: boolean): boolean => flowLitAtRest && !allStrong;

/* ---------- the person's choice, per project, this browser only ---------- */
export function readStrong(get: (k: string) => string | null): Record<string, 1> {
  try { const v = JSON.parse(get(CLEAR_KEY) ?? '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, 1> : {}; } catch { return {}; }
}
export const allStrongFor = (kept: Record<string, 1>, key: string): boolean => kept[key] === 1;
export function keepStrong(get: (k: string) => string | null, set: (k: string, v: string) => void, key: string, on: boolean) {
  try { const s = readStrong(get); if (on) s[key] = 1; else delete s[key]; set(CLEAR_KEY, JSON.stringify(s)); } catch { /* no storage: the choice holds for this page */ }
}

/* ---------- v14 fix 2: the words a lit line says ---------- */
/** v14 fix 2 (verify of v14 fix 1: at the 1440 쉽게 landing umami's 4 lit lines, hyperfine's 7, nanogpt's 2, gpt-researcher's 2 and
 * paperless's 1 said nothing: what they hand over is written in code (「createSession·saveEvent·saveSessionData」), or wider than a label
 * (「Kafka 메시지(topic event 등)」)): the forms a lit line's label may take after its own, best first, each whole and as the record says it:
 * - its whole words (at 쉽게 only when every unit of them is plain);
 * - the units of them in plain words (at 쉽게; a unit is a part between 「 · 」, 「 → 」, 「, 」 or 「; 」), in their order, with 「 등」 after
 *   them when a unit was left to the hover;
 * - the same with a bracket's words left to the hover (「Kafka 메시지」);
 * - its first unit (its bracket's words left off) with 「 등」;
 * - the relation's own kind word (kindWord: 「넘겨줌」, 「시작시킴」), so a lit line always says what it is.
 * Never a 「…」, never a unit cut inside, never one side of an OR alone. The full words stay in the line's hover. */
export const LIT_FORM_MAX = 22;
export function litForms(full: string, easy: boolean, kindWord: string): string[] {
  // A control line's channel word (「기동 · 」) is no unit of what starts it: the kind word says it.
  const t = full.replace(/\s+/g, ' ').trim().replace(/^기동\s*·\s*/, ''), out: string[] = [];
  const add = (s: string | null | undefined) => { const v = (s ?? '').replace(/\s+/g, ' ').trim();
    if (v && !v.includes('…') && v.length <= LIT_FORM_MAX && !/(?:^|\s)(?:또는|혹은|or)(?:\s|$)|\|/i.test(v) && !out.includes(v)) out.push(v); };
  const units = t ? t.split(/\s+(?:·|→|->)\s+|,\s+|;\s+/).map(u => u.trim()).filter(Boolean) : [];
  const said = (u: string) => (u.includes('…') ? null : easy ? plainLabel(u) : u);
  const bare = (u: string) => u.replace(/\s*[(（][^()（）]*[)）]/g, '').trim();
  const kept = units.map(said).filter((u): u is string => !!u), all = kept.length === units.length, more = all ? '' : ' 등';
  if (units.length && all) add(easy ? plainLabel(t) : t);
  if (kept.length) { add(kept.join(' · ') + more); add(kept.map(bare).filter(Boolean).join(' · ') + more); }
  if (kept.length) { const first = bare(kept[0]!); add(first + (kept.length > 1 || !all ? ' 등' : '')); }
  add(kindWord);
  return out;
}
/** A line's own kind word, as a lit line says it when its words cannot be said (쉽게 plainer for a control line: 「시작시킴」). */
export function litKindWord(channel: string | null, kindLabel: string, easy: boolean): string {
  return channel === 'control' ? (easy ? '시작시킴' : '제어') : channel === 'uses' ? '참조' : kindLabel;
}
