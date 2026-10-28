/* span.1: exact passages of a sent excerpt, cut deterministically so a reply can name evidence instead of copying it. The excerpt
 * goes once, as consecutive labelled pieces whose texts join back to it character for character (CRLF, emoji, Markdown and white
 * space as they are); each piece's evidence span is [from, to) in UTF-16 code units of that excerpt, its own white space left out,
 * never inside a surrogate pair. Sentences, list items, headings, table rows and code lines are cut where they end; a sentence
 * longer than SPAN_MAX goes on in the next piece (more). What is marked (heading, list, code, table, quotation) is where a piece
 * stands, not what it means: a quotation is a blockquote line or a passage inside “…”/「…」/『…』 that holds more than one sentence.
 * A reference names one piece ('N01.07') or two adjacent pieces of one paragraph ('N01.07-08'), within the excerpt it was sent in. */
export const SPAN_INDEX = 'span.1' as const;
/** A piece's evidence is at most this long; two adjacent pieces of one paragraph are at most 2·SPAN_MAX plus the space between. */
export const SPAN_MAX = 240;
/** At most this many pieces in one excerpt: a longer one is sent up to a piece boundary and read on from there next time. */
export const SPANS_PER_RECORD = 400;
/** A stored anchored quote is at most this long (two pieces and a short gap). */
export const ANCHOR_QUOTE_MAX = 600;
export type SpanKind = 'p' | 'h' | 'l' | 'c' | 't';
export interface Span { from: number; to: number; kind: SpanKind; quoted: boolean; more: boolean; para: number }
/** One piece as it is sent: alias, the excerpt from this piece's start to the next one's (its trailing white space included) and
 * the marks that are set. */
export interface SpanWire { s: string; t: string; k?: Exclude<SpanKind, 'p'>; q?: 1; more?: 1 }
export interface RecordSpans { lead: string; spans: SpanWire[] }

const WS = /\s/;
const high = (c: number) => c >= 0xd800 && c <= 0xdbff;
/** A cut at or before n that never separates a surrogate pair. */
const safe = (t: string, n: number) => (n > 0 && n < t.length && high(t.charCodeAt(n - 1)) ? n - 1 : n);
const CLOSE = new Set([')', ']', '"', "'", '”', '’', '」', '』', '》', '〉']);
const END = new Set(['.', '!', '?', '。', '！', '？', '…']);
const PAIRS: Record<string, string> = { '“': '”', '「': '」', '『': '』' };

/** Paired quotation marks that hold more than one sentence: [open, close] positions (outermost only). */
function quotations(t: string): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < t.length; i++) {
    const close = PAIRS[t[i]!]; if (!close) continue;
    let depth = 0, j = i;
    for (; j < t.length; j++) { if (t[j] === t[i]) depth++; else if (t[j] === close && --depth === 0) break; }
    if (j >= t.length) continue;
    const inner = t.slice(i + 1, j);
    if (/[.!?。！？…][)\]"'”’」』]*\s+\S/.test(inner)) { out.push([i, j]); i = j; }
  }
  return out;
}

/** The pieces of t, in order. Deterministic: the same text always gives the same pieces. */
export function indexSpans(t: string): Span[] {
  const out: Span[] = [], quotes = quotations(t);
  const cuts = new Set<number>(); for (const [a, b] of quotes) { cuts.add(a); cuts.add(b + 1); }
  const inQuote = (a: number, b: number) => quotes.some(([x, y]) => a >= x && b <= y + 1);
  let para = 0, fenced = false, blank = true;
  const push = (from: number, to: number, kind: SpanKind, quoted: boolean) => {
    // Its own white space is not evidence.
    while (from < to && WS.test(t[from]!)) from++;
    while (to > from && WS.test(t[to - 1]!)) to--;
    if (from >= to) return;
    // A long piece goes on in the next one, cut after a clause mark or a space when there is one past the first quarter.
    while (to - from > SPAN_MAX) {
      let cut = -1;
      for (let k = from + SPAN_MAX; k > from + SPAN_MAX / 4; k--) {
        const prev = t[k - 1]!, cur = t[k] ?? '';
        if (WS.test(cur) && /[,;:·)\]—–、，；]/.test(prev)) { cut = k; break; }
      }
      if (cut < 0) for (let k = from + SPAN_MAX; k > from + SPAN_MAX / 4; k--) if (WS.test(t[k] ?? '')) { cut = k; break; }
      if (cut < 0) cut = safe(t, from + SPAN_MAX);
      let end = cut; while (end > from && WS.test(t[end - 1]!)) end--;
      out.push({ from, to: end, kind, quoted: quoted || inQuote(from, end), more: true, para });
      from = cut; while (from < to && WS.test(t[from]!)) from++;
    }
    out.push({ from, to, kind, quoted: quoted || inQuote(from, to), more: false, para });
  };
  let code: [number, number] | null = null;
  const flushCode = () => { if (code) { push(code[0], code[1], 'c', false); code = null; } };
  for (let at = 0; at <= t.length;) {
    const nl = t.indexOf('\n', at), end = nl < 0 ? t.length : nl, line = t.slice(at, end);
    const fence = /^\s{0,3}(```|~~~)/.test(line);
    if (fenced || fence) {
      if (!line.trim()) { flushCode(); }
      // Code lines go together up to SPAN_MAX; a fence line opens or closes the block.
      else if (code && end - code[0] <= SPAN_MAX) code[1] = end;
      else { flushCode(); code = [at, end]; }
      if (fence) fenced = !fenced;
      if (!fenced) flushCode();
      blank = false;
    } else if (!line.trim()) { if (!blank) para++; blank = true; }
    else {
      blank = false;
      const kind: SpanKind = /^\s{0,3}#{1,6}\s/.test(line) ? 'h' : /^\s*>/.test(line) ? 'p' : /^\s*\|/.test(line) ? 't' : /^\s*(?:[-*+•]|\d{1,3}[.)])\s/.test(line) ? 'l' : 'p';
      const quoted = /^\s*>/.test(line);
      if (kind === 'h' || kind === 't') push(at, end, kind, quoted);
      else {
        // Sentences of the line: after an end mark (and closing marks) followed by space, never after a list marker alone;
        // and around a quotation that holds sentences, so a piece is either inside it or outside it.
        const marker = /^\s*(?:[-*+•]|\d{1,3}[.)])\s/.exec(line)?.[0].length ?? 0;
        let start = at;
        for (let k = at; k < end; k++) {
          if (cuts.has(k) && k > start && t.slice(start, k).trim()) { push(start, k, kind, quoted); start = k; continue; }
          if (!END.has(t[k]!)) continue;
          let e = k + 1; while (e < end && (END.has(t[e]!) || CLOSE.has(t[e]!))) e++;
          if (e >= end || !WS.test(t[e]!) || e - at <= marker) continue;
          push(start, e, kind, quoted); start = e; k = e - 1;
        }
        push(start, end, kind, quoted);
      }
    }
    if (nl < 0) break;
    at = nl + 1;
  }
  flushCode();
  return out.filter(s => s.from < s.to);
}

const alias = (record: string, i: number) => `${record}.${String(i + 1).padStart(2, '0')}`;
/** The excerpt as it is sent: what comes before the first piece, then each piece with the text up to the next one. */
export function encodeSpans(record: string, t: string, spans: Span[] = indexSpans(t)): RecordSpans {
  return { lead: spans.length ? t.slice(0, spans[0]!.from) : t, spans: spans.map((s, i) => {
    const w: SpanWire = { s: alias(record, i), t: t.slice(s.from, spans[i + 1]?.from ?? t.length) };
    if (s.kind !== 'p') w.k = s.kind; if (s.quoted) w.q = 1; if (s.more) w.more = 1;
    return w;
  }) };
}
/** The excerpt and its pieces from what was sent, only when the pieces are exactly what span.1 makes of the joined text (aliases,
 * boundaries and marks); anything else is not this index. */
export function decodeSpans(record: string, wire: RecordSpans): { text: string; spans: Span[] } | null {
  const text = wire.lead + wire.spans.map(s => s.t).join(''), spans = indexSpans(text), again = encodeSpans(record, text, spans);
  const same = (a: SpanWire, b: SpanWire) => a.s === b.s && a.t === b.t && a.k === b.k && a.q === b.q && a.more === b.more && Object.keys(a).length === Object.keys(b).length;
  return again.lead === wire.lead && again.spans.length === wire.spans.length && again.spans.every((x, i) => same(x, wire.spans[i]!)) ? { text, spans } : null;
}
/** Which piece(s) a reference names: one, or two adjacent pieces of the same paragraph, in this record; else null. */
export function resolveRef(ref: string, record: string, text: string, spans: Span[], longest = 2): { from: number; to: number; quote: string } | null {
  const m = /^([NR]\d{2,3})\.(\d{2,3})(?:-(\d{2,3}))?$/.exec(ref);
  if (!m || m[1] !== record) return null;
  const a = Number(m[2]) - 1, b = m[3] === undefined ? a : Number(m[3]) - 1;
  if (m[2] !== String(a + 1).padStart(2, '0') || (m[3] !== undefined && m[3] !== String(b + 1).padStart(2, '0'))) return null;
  if (a < 0 || b < a || b >= spans.length || b - a >= longest) return null;
  if (spans.slice(a, b + 1).some(s => s.para !== spans[a]!.para)) return null;
  const from = spans[a]!.from, to = spans[b]!.to;
  return { from, to, quote: text.slice(from, to) };
}
/** A long range of pieces (what a reply reads as embedded material), in one record. */
export function resolveRange(ref: string, record: string, text: string, spans: Span[]): { from: number; to: number } | null {
  const m = /^([NR]\d{2,3})\.(\d{2,3})(?:-(\d{2,3}))?$/.exec(ref);
  if (!m || m[1] !== record) return null;
  const a = Number(m[2]) - 1, b = m[3] === undefined ? a : Number(m[3]) - 1;
  if (m[2] !== String(a + 1).padStart(2, '0') || (m[3] !== undefined && m[3] !== String(b + 1).padStart(2, '0')) || a < 0 || b < a || b >= spans.length) return null;
  return { from: spans[a]!.from, to: spans[b]!.to };
}
/** A short fixed digest of the exact text read (two FNV-1a lanes over UTF-16 code units): binds a stored reading to that text. */
export function textDigest(t: string): string {
  let a = 0x811c9dc5, b = 0x01000193 ^ t.length;
  for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i); a = Math.imul(a ^ c, 0x01000193); b = Math.imul(b ^ c ^ (i & 0xff), 0x01000193) ^ (a >>> 13); }
  return `f1-${(a >>> 0).toString(16).padStart(8, '0')}${(b >>> 0).toString(16).padStart(8, '0')}`;
}
