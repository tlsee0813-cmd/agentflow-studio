/* The marker a handover document carries (handover.ts writes it): af-handover:CODE[:part] on its first and last line. A session
 * whose person pasted that document is known by it, and the document itself is folded to one line when the session is taken in. */
export const HANDOVER_TAG = 'af-handover';
const CODE = '[A-Z0-9]{6}', AREA = '[A-Za-z0-9_-]{1,80}';
const START = new RegExp(`^─+ AgentFlow 인수인계 문서 · ${HANDOVER_TAG}:(${CODE})(?::(${AREA}))? ─+$`, 'm');
// The end line names the part too (older documents name only the code), so a document copied without its first line still folds.
const END = (code: string) => new RegExp(`^─+ 인수인계 문서 끝 · ${HANDOVER_TAG}:(${code})(?::(${AREA}))? ─+$`, 'm');
const RECEIVED = `\\[AgentFlow 인수인계 문서를 받아 이어감 · ${HANDOVER_TAG}:(${CODE})(?::(${AREA}))?(?: · ([^\\]\\n]*))?\\]`;
/** The one line a folded document leaves (RECEIVED reads it back). */
const received = (code: string, area: string | undefined, title: string | undefined) => `[AgentFlow 인수인계 문서를 받아 이어감 · ${HANDOVER_TAG}:${code}${area ? `:${area}` : ''}${title ? ` · ${title.replace(/[\]\n]/g, ' ')}` : ''}]`;

/** A fresh six-character code (no 0/O/1/I to misread). */
export function handoverCode(): string {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', b = new Uint8Array(6); globalThis.crypto.getRandomValues(b);
  return [...b].map(x => abc[x % abc.length]).join('');
}

/** A person's message that carries a handover document: the document (start marker to its end marker, or to the end of the message
 * when the end was not pasted; from its title line when the start line was not copied) becomes one line naming it, the person's own
 * words around it stay as written. */
export function foldHandover(text: string): string {
  let out = text;
  for (let guard = 0; guard < 8; guard++) {
    let from: number, to: number, code: string, area: string | undefined;
    const m = START.exec(out);
    if (m) {
      const end = END(m[1]!).exec(out.slice(m.index + m[0].length));
      // Folded to the end (its end line not copied), the blank lines after it stay: in a pasted record they set off the next block's head.
      from = m.index; to = end ? from + m[0].length + end.index + end[0].length : out.trimEnd().length; code = m[1]!; area = m[2];
    } else {
      const end = END(CODE).exec(out), head = end ? [...out.slice(0, end.index).matchAll(/^# 인수인계: /gm)].at(-1) : undefined;
      if (!end || !head) break;
      from = head.index!; to = end.index + end[0].length; code = end[1]!; area = end[2];
    }
    const title = /^# 인수인계: (.+)$/m.exec(out.slice(from, to))?.[1]?.trim();
    out = `${out.slice(0, from)}${received(code, area, title)}${out.slice(to)}`;
  }
  return out;
}

/** Handovers a session record says it started from: the code and, for a part's handover, the part. Only the person's requests count,
 * each folded as the import folds it, and only a marker that starts a line there: one quoted inside a request (an older document's
 * recent flow) or written in an answer is not how this session started. */
export function receivedHandovers(text: string): { code: string; areaId: string | null }[] {
  if (!text.includes(HANDOVER_TAG)) return []; // most records: read for every part of a map, so this stays one plain search
  const asks = text.split(/^── /m).slice(1).filter(b => b.startsWith('사용자 요청')).map(b => foldHandover(b.slice(b.indexOf('\n') + 1)));
  return asks.flatMap(a => [...a.matchAll(new RegExp(`^${RECEIVED}`, 'gm'))].map(m => ({ code: m[1]!, areaId: m[2] ?? null })));
}
/** A request as a later document quotes it: a handover it started from is named in words, without its code, so the quote is never
 * read as a takeover again. */
export const quoteReceived = (text: string) => foldHandover(text).replace(new RegExp(RECEIVED, 'g'), (_m, _code, _area, title?: string) => `(인수인계 문서로 시작${title ? ` · ${title}` : ''})`);
