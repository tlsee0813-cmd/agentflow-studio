import { parseScopeReview } from './change-plan.js';
import { validatePlanAsk, PLAN_BYTES } from './plan-api.js';
export const SCOPE_BYTES = PLAN_BYTES;
function check(condition) { if (!condition)
    throw new Error('INVALID_INPUT'); }
function object(value, keys) {
    check(value !== null && typeof value === 'object' && !Array.isArray(value));
    check(Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k)));
}
function text(value, max) {
    check(typeof value === 'string' && value.length <= max && !!value.trim() && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value));
}
function id(value) { text(value, 100); check(/^[A-Za-z0-9_-]+$/.test(value)); }
function ids(value, max, allowed, nonempty = false) {
    check(Array.isArray(value) && value.length <= max && (!nonempty || value.length > 0));
    for (const entry of value) {
        id(entry);
        check(allowed.has(entry));
    }
    check(new Set(value).size === value.length);
}
/** Bound the complete UTF-8 request, including selection and excluded context. No silent clipping. */
export function validateScopeAsk(value) {
    object(value, ['schemaVersion', 'intent', 'parts', 'evidence', 'selected', 'excluded']);
    check(value.schemaVersion === 'studio.scope.1');
    if (new TextEncoder().encode(JSON.stringify(value)).length > SCOPE_BYTES)
        throw new Error('INPUT_TOO_LARGE');
    const base = validatePlanAsk({ schemaVersion: 'studio.plan.1', intent: value.intent, parts: value.parts, evidence: value.evidence });
    check(Array.isArray(value.selected) && value.selected.length > 0 && value.selected.length <= 32);
    const parts = new Set(base.parts.map(p => p.id)), refs = new Set(base.evidence.map(e => e.id)), selected = new Set();
    for (const item of value.selected) {
        object(item, ['id', 'title', 'description', 'partIds', 'refs']);
        id(item.id);
        check(!selected.has(item.id));
        selected.add(item.id);
        text(item.title, 200);
        text(item.description, 4000);
        ids(item.partIds, 32, parts);
        ids(item.refs, 48, refs, true);
    }
    check(Array.isArray(value.excluded) && value.excluded.length <= 32);
    for (const title of value.excluded)
        text(title, 200);
    check(new Set(value.excluded).size === value.excluded.length);
    return structuredClone(value);
}
export function validateScopeReply(value, ask) {
    return parseScopeReview(value, ask.evidence.map(e => e.id));
}
