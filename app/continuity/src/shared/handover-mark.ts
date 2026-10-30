/* The marker a handover document carries (handover.ts writes it): af-handover:CODE[:part] on its first and last line. A session
 * whose person pasted that document is known by it, and the document itself is folded to one line when the session is taken in. */
export const HANDOVER_TAG = 'af-handover';
const CODE = '[A-Z0-9]{6}', AREA = '[A-Za-z0-9_-]{1,80}';
const START = new RegExp(`^─+ AgentFlow 인수인계 문서 · ${HANDOVER_TAG}:(${CODE})(?::(${AREA}))? ─+$`, 'm');
const END = (code: string) => new RegExp(`^─+ 인수인계 문서 끝 · ${HANDOVER_TAG}:${code} ─+$`, 'm');
const RECEIVED = new RegExp(`\\[AgentFlow 인수인계 문서를 받아 이어감 · ${HANDOVER_TAG}:(${CODE})(?::(${AREA}))?(?: · [^\\]\\n]*)?\\]`, 'g');

/** A fresh six-character code (no 0/O/1/I to misread). */
export function handoverCode(): string {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', b = new Uint8Array(6); globalThis.crypto.getRandomValues(b);
  return [...b].map(x => abc[x % abc.length]).join('');
}

/** A person's message that carries a handover document: the document (start marker to its end marker, or to the end of the message
 * when the end was not pasted) becomes one line naming it, the person's own words around it stay as written. */
export function foldHandover(text: string): string {
  let out = text;
  for (let guard = 0; guard < 8; guard++) {
    const m = START.exec(out); if (!m) break;
    const [line, code, area] = m, from = m.index, rest = out.slice(from + line.length), end = END(code!).exec(rest);
    const to = end ? from + line.length + end.index + end[0].length : out.length;
    const title = /^# 인수인계: (.+)$/m.exec(out.slice(from, to))?.[1]?.trim();
    out = `${out.slice(0, from)}[AgentFlow 인수인계 문서를 받아 이어감 · ${HANDOVER_TAG}:${code}${area ? `:${area}` : ''}${title ? ` · ${title.replace(/[\]\n]/g, ' ')}` : ''}]${out.slice(to)}`;
  }
  return out;
}

/** Handovers a session record says it started from: the code and, for a part's handover, the part. */
export function receivedHandovers(text: string): { code: string; areaId: string | null }[] {
  return [...text.matchAll(RECEIVED)].map(m => ({ code: m[1]!, areaId: m[2] ?? null }));
}

