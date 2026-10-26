import { parseScopeReview, type Evidence, type ScopeReview } from './change-plan.js';
import { validatePlanAsk, PLAN_BYTES, type PlanAsk } from './plan-api.js';

export interface ScopeAsk {
  schemaVersion: 'studio.scope.1';
  intent: string;
  parts: PlanAsk['parts'];
  evidence: Evidence[];
  selected: { id: string; title: string; description: string; partIds: string[]; refs: string[] }[];
  /** Titles of unselected outcomes, context only; never implicitly requested. */
  excluded: string[];
}
export const SCOPE_BYTES = PLAN_BYTES;
function check(condition: unknown): asserts condition { if (!condition) throw new Error('INVALID_INPUT'); }
function object(value: unknown, keys: string[]): asserts value is Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value));
  check(Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k)));
}
function text(value: unknown, max: number): asserts value is string {
  check(typeof value === 'string' && value.length <= max && !!value.trim() && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value));
}
function id(value: unknown): asserts value is string { text(value, 100); check(/^[A-Za-z0-9_-]+$/.test(value)); }
function ids(value: unknown, max: number, allowed: Set<string>, nonempty = false): asserts value is string[] {
  check(Array.isArray(value) && value.length <= max && (!nonempty || value.length > 0));
  for (const entry of value) { id(entry); check(allowed.has(entry)); }
  check(new Set(value).size === value.length);
}

/** Bound the complete UTF-8 request, including selection and excluded context. No silent clipping. */
export function validateScopeAsk(value: unknown): ScopeAsk {
  object(value, ['schemaVersion', 'intent', 'parts', 'evidence', 'selected', 'excluded']);
  check(value.schemaVersion === 'studio.scope.1');
  if (new TextEncoder().encode(JSON.stringify(value)).length > SCOPE_BYTES) throw new Error('INPUT_TOO_LARGE');
  const base = validatePlanAsk({ schemaVersion: 'studio.plan.1', intent: value.intent, parts: value.parts, evidence: value.evidence });
  check(Array.isArray(value.selected) && value.selected.length > 0 && value.selected.length <= 32);
  const parts = new Set(base.parts.map(p => p.id)), refs = new Set(base.evidence.map(e => e.id)), selected = new Set<string>();
  for (const item of value.selected) {
    object(item, ['id', 'title', 'description', 'partIds', 'refs']);
    id(item.id); check(!selected.has(item.id)); selected.add(item.id);
    text(item.title, 200); text(item.description, 4000); ids(item.partIds, 32, parts); ids(item.refs, 48, refs, true);
  }
  check(Array.isArray(value.excluded) && value.excluded.length <= 32);
  for (const title of value.excluded) text(title, 200);
  check(new Set(value.excluded).size === value.excluded.length);
  return structuredClone(value as unknown as ScopeAsk);
}
export function validateScopeReply(value: unknown, ask: ScopeAsk): ScopeReview {
  return parseScopeReview(value, ask.evidence.map(e => e.id));
}
