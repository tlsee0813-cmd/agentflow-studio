/* A card's operations line (map spec 2.2): the newest reading's state for the part, as a report with the time the record
 * gives ('가동 보고 · 07:46Z · 현재 미확인'). The time reads short where the map already says the day: a time on the day of the
 * reading's basis time (else of today) is written as its clock time alone, any other as month-day and time. When even that does
 * not fit its card, '현재 미확인' reads '현재 ?'; the whole line, with the time as the record wrote it, stays the line's tip.
 * Never a status the app saw. Pure: no DOM. */

/** A state the readings give a part (map-reading.7), or anything else (read as not known). */
export type OpsState = 'running' | 'working' | 'stopped' | 'unbuilt' | 'retired' | 'unknown' | string;

/** A date and a clock time as records write them: '2026-11-03T07:46Z', '2026-11-03 07:46:12Z', '11-03 07:46Z', '11-03 07:46'. */
const STAMP = /^(?:(\d{4})-)?(\d{1,2})-(\d{1,2})(?:T|\s+)(\d{1,2}:\d{2})(?::\d{2}(?:\.\d+)?)?\s*(Z|UTC)?$/i;
/** The day of a basis time or of today ('2026-11-03…', '11-03 …'): year when written, month and day. */
const DAY = /^(?:(\d{4})-)?(\d{1,2})-(\d{1,2})(?=$|[T\s])/;
const two = (s: string) => s.padStart(2, '0');

/** The record's time for the operations line: the clock time alone on the reference day ('07:46Z'), else month-day and time
 * ('11-03 07:46Z'; with its year when the years are both written and differ). A time written any other way reads as written.
 * ref: the reading's basis time (basisAt) when it gives one, else today's date (YYYY-MM-DD). */
export function opsWhen(when: string, ref: string | null): string {
  const t = when.trim(), m = STAMP.exec(t); if (!m) return t;
  const [, y, mo, d, clock, z] = m, time = `${clock}${z ? 'Z' : ''}`;
  const r = ref ? DAY.exec(ref.trim()) : null;
  const same = !!r && two(r[2]!) === two(mo!) && two(r[3]!) === two(d!) && (!y || !r[1] || y === r[1]);
  if (same) return time;
  return `${y && r?.[1] && y !== r[1] ? `${y}-` : ''}${two(mo!)}-${two(d!)} ${time}`;
}

/** The operations line in words. when: the record's time as the line shows it (or null); brief: '현재 ?' for '현재 미확인'. */
export function opsText(state: OpsState | null, when: string | null, brief = false): string {
  if (state === null) return '운영 기록 없음';
  const at = when ? ` · ${when}` : '';
  switch (state) {
    case 'running': return `가동 보고${at} · ${brief ? '현재 ?' : '현재 미확인'}`;
    case 'working': return `작업 중 보고${at}`;
    case 'stopped': return `멈춤 보고${at}`;
    case 'unbuilt': return `미구현${at}`;
    case 'retired': return `폐기${at}`;
    default: return '운영 기록 모름';
  }
}

/** The panel head's operations line (map design v3 8.2): the full form, the record's time as month-day and time ('10-31 16:03Z'),
 * and for a running report '현재 가동 여부 미확인' (the card keeps its shorter words). '보고' stays in the words themselves: a report
 * is not a status the app saw. */
export function opsHead(state: OpsState | null, when: string | null): string {
  const at = when ? opsWhen(when, null) : null;
  return state === 'running' ? `가동 보고${at ? ` · ${at}` : ''} · 현재 가동 여부 미확인` : opsText(state, at);
}

/** What a card draws for its operations line: the full line (time short where the day is known), the brief one used only when
 * the full line overflows, and the tip (the whole line with the time as the record wrote it). */
export function opsLines(state: OpsState | null, when: string | null, ref: string | null): { full: string; brief: string; tip: string } {
  const short = when ? opsWhen(when, ref) : null;
  return { full: opsText(state, short), brief: opsText(state, short, true), tip: opsText(state, when?.trim() || null) };
}

/** The words of an operations state without its time, as a card's bottom line and its short status read them (map design v3 3.2,
 * 5.4): 「보고」 is part of the words, never shortened away ('가동 보고', never '가동'). A lifecycle state (폐기, 미구현 or 설계만, the
 * card's chip) reads as what it is: a report of that state. */
export function opsWord(state: OpsState | null, life: string | null = null): string {
  if (state === null) return '운영 기록 없음';
  switch (state) {
    case 'running': return '가동 보고';
    case 'working': return '작업 중 보고';
    case 'stopped': return '멈춤 보고';
    case 'unbuilt': return `${life ?? '미구현'} 보고`;
    case 'retired': return `${life ?? '폐기'} 보고`;
    default: return '운영 기록 모름';
  }
}
/** A card's bottom line (map design v3 3.2): the state as a report with the record's time ('가동 보고 · 08:01Z'), without the
 * panel's 「현재 가동 여부 미확인」 (the panel head and the map's basis line say it once); the tip keeps the time as written. */
export function opsCard(state: OpsState | null, when: string | null, ref: string | null, life: string | null = null): { text: string; short: string; tip: string } {
  const word = opsWord(state, life), at = state !== null && when ? opsWhen(when, ref) : null;
  const full = state !== null && when?.trim() ? `${word} · ${when.trim()}` : word;
  return { text: at ? `${word} · ${at}` : word, short: word, tip: state === 'running' ? `${full} · 현재 가동 여부 미확인` : full };
}
