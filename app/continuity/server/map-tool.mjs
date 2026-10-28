// studio.map.4 on the provider: the reply comes back as the arguments of one strict function, never as free text. This is the
// shape of the reply only: nothing is executed and no second call is made. The schema is built per request from the very
// pieces that were sent: every evidence reference ('at', basis, roleReplaces) is an enum of the references that request can
// resolve (one span.2 piece, or two adjacent pieces of one paragraph, within ANCHOR_QUOTE_MAX). Material ranges may run over
// paragraphs, so they stay a string checked by the reply validator. Counts and lengths are not in the provider's strict subset:
// the prompt states them and validateMapReply holds them, as before. Nullable values are anyOf [value, {type: 'null'}].
import { decodeSpans, resolveRef, ANCHOR_QUOTE_MAX, SPAN_INDEX } from '../dist/public/shared/evidence-span.js';
import { CLAIM_KINDS } from '../dist/public/shared/types.js';

export const MAP4_TOOL = 'record_map_reading';
/** The provider settings a map.4 reading is made with; part of the prompt id, so readings made another way read apart. */
export const MAP4_TRANSPORT = Object.freeze({ version: 'map4-tool.1', endpoint: 'https://api.deepseek.com/beta/chat/completions', tool: MAP4_TOOL, strict: true, thinking: 'disabled', index: SPAN_INDEX });

const str = () => ({ type: 'string' });
const nullable = s => ({ anyOf: [s, { type: 'null' }] });
const strings = values => ({ type: 'string', enum: values });
const arr = items => ({ type: 'array', items });
const object = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });

/** Every reference this request can resolve, in the order of its records and pieces. */
export function evidenceRefs(ask) {
  const out = [];
  for (const r of ask.records) {
    const d = decodeSpans(r.id, { lead: r.lead, spans: r.spans }); if (!d) throw new Error('INVALID_INPUT');
    d.spans.forEach((_, i) => {
      const a = String(i + 1).padStart(2, '0'), b = String(i + 2).padStart(2, '0');
      for (const ref of [`${r.id}.${a}`, `${r.id}.${a}-${b}`]) { const at = resolveRef(ref, r.id, d.text, d.spans); if (at && at.quote.length <= ANCHOR_QUOTE_MAX) out.push(ref); }
    });
  }
  return out;
}

/** The parameters of the one function for this request. Values that cannot be listed (a new part's key, names, text) are strings. */
export function map4Schema(ask) {
  const refs = evidenceRefs(ask); if (!refs.length) throw new Error('INVALID_INPUT');
  const at = strings(refs);
  const claimKeys = ask.parts.flatMap(p => p.current.map(c => c.key)), priorKeys = (ask.priors ?? []).map(x => x.key);
  const requestIds = (ask.requests ?? []).map(q => q.id), itemIds = [...new Set((ask.requests ?? []).flatMap(q => q.items.map(i => i.id)))];
  // Keys that exist go as their own enum; with none there is nothing to name, so only null is allowed (never an empty enum).
  const keyOrNull = keys => keys.length ? nullable(strings(keys)) : { type: 'null' };
  const target = object({ requestId: requestIds.length ? strings(requestIds) : str(), itemId: itemIds.length ? strings(itemIds) : str() });
  const claim = object({ kind: strings([...CLAIM_KINDS]), text: str(), at, about: nullable(str()), replaces: keyOrNull(claimKeys) });
  const part = object({ ref: str(), name: nullable(str()), parent: nullable(str()), role: nullable(str()), roleAbout: nullable(str()), roleReplaces: nullable(at), basis: arr(at), claims: arr(claim) });
  return object({
    summary: str(),
    parts: arr(part),
    relations: arr(object({ from: str(), to: str(), kind: strings(['flow', 'needs', 'shares', 'related']), note: str(), at })),
    candidates: arr(object({ text: str(), parts: arr(str()), at: nullable(at) })),
    gaps: arr(str()),
    matches: arr(object({ at, text: str(), kind: strings(['reported', 'checked', 'code', 'test', 'open']), stance: strings(['made', 'not-made', 'unclear']), about: nullable(str()), targets: arr(target), why: str(), replaces: keyOrNull(priorKeys) })),
    material: arr(object({ at: str(), what: str() }))
  });
}

/** The tool fields of the provider request for this map.4 request. */
export function map4Tools(ask) {
  return {
    tools: [{ type: 'function', function: { name: MAP4_TOOL, description: '이번 지도 정리 결과 하나를 기록한다. 인자가 응답 전체다.', strict: true, parameters: map4Schema(ask) } }],
    tool_choice: { type: 'function', function: { name: MAP4_TOOL } }
  };
}

/** The reply's arguments from a provider choice: exactly one call of this function, finished as a tool call, with no text beside
 * it. Anything else (free text JSON, two calls, another name, a cut reply) is not a map.4 reply, and nothing falls back. */
export function map4Arguments(choice) {
  const m = choice?.message, calls = m?.tool_calls;
  if (choice?.finish_reason !== 'tool_calls' || !Array.isArray(calls) || calls.length !== 1) throw new Error('INVALID_RESPONSE');
  if (m.content !== null && m.content !== undefined && m.content !== '') throw new Error('INVALID_RESPONSE');
  const c = calls[0];
  if (c?.type !== 'function' || c.function?.name !== MAP4_TOOL || typeof c.function.arguments !== 'string') throw new Error('INVALID_RESPONSE');
  return c.function.arguments;
}
