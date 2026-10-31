/* AF118: condition-length guidance for a later studio.map.7 ask. For every piece that was sent (records and span.2 pieces in their
 * sent order), the last piece a condition anchor starting there may end at and still resolve, with its outer white space trimmed,
 * to 1–80 UTF-16 units (role, claim and statement conditions) and to 1–200 (match conditions), or null when no range starting
 * there does. The ranges are the validator's own (askRecords pieces, whole pieces of one record, JS trim), so a listed end admits
 * every end from the start through it and nothing past it. It says what fits, never what is a condition: ownership, basis and
 * material are judged as before. Nothing of the ask changes and no record text is copied into the rows. */
import { askRecords, MAP7_SCHEMA } from './map-reading.js';
export const CONDITION_GUIDANCE = 'condition-length-guidance.1';
/** The condition bounds of map.7 (after the outer trim): role/claim/statement, match. */
export const CONDITION_SHORT = 80, CONDITION_LONG = 200;
/** MAP_RECORDS (4) × SPANS_PER_RECORD (400). */
export const GUIDANCE_ROWS_MAX = 1600;
export function conditionGuidance(ask) {
    if (ask.schemaVersion !== MAP7_SCHEMA)
        throw new Error('INVALID_INPUT');
    const texts = askRecords(ask), rows = [];
    for (const r of ask.records) {
        const got = texts.get(r.id), wire = r.spans ?? [];
        if (!got?.spans || got.spans.length !== wire.length)
            throw new Error('INVALID_INPUT');
        const spans = got.spans, last = (a, max) => {
            let end = null;
            for (let b = a; b < spans.length; b++) {
                // The trimmed length never shrinks as the range grows, so the first range out of bounds ends the admitted ends.
                const words = got.text.slice(spans[a].from, spans[b].to).trim();
                if (!words || words.length > max)
                    break;
                end = wire[b].s;
            }
            return end;
        };
        for (let a = 0; a < spans.length; a++)
            rows.push([wire[a].s, last(a, CONDITION_SHORT), last(a, CONDITION_LONG)]);
    }
    if (rows.length > GUIDANCE_ROWS_MAX)
        throw new Error('INPUT_TOO_LARGE');
    return rows;
}
