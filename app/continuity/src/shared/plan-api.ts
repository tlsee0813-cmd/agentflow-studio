import { parsePlanAnalysis, type Evidence, type PlanAnalysis } from './change-plan.js';

export interface PlanAsk {
  schemaVersion: 'studio.plan.1';
  intent: string;
  parts: { id: string; name: string; note: string; parentId: string | null }[];
  evidence: Evidence[];
}
export const PLAN_BYTES = 65536;
const size = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length;
function check(ok: unknown): asserts ok { if (!ok) throw new Error('INVALID_INPUT'); }
function obj(v: unknown, keys: string[]): asserts v is Record<string, unknown> {
  check(v && typeof v === 'object' && !Array.isArray(v));
  check(Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k)));
}
function text(v: unknown, max: number, empty = false): asserts v is string {
  check(typeof v === 'string' && v.length <= max && (empty || !!v.trim()));
  check(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v));
}
function id(v: unknown): asserts v is string { text(v, 100); check(/^[A-Za-z0-9_-]+$/.test(v)); }
/** Byte limit applies to the complete serialized request, including Korean source material. No silent truncation. */
export function validatePlanAsk(value: unknown): PlanAsk {
  obj(value, ['schemaVersion', 'intent', 'parts', 'evidence']);
  check(value.schemaVersion === 'studio.plan.1'); text(value.intent, 6000);
  if (size(value) > PLAN_BYTES) throw new Error('INPUT_TOO_LARGE');
  check(Array.isArray(value.parts) && value.parts.length <= 200);
  const ids = new Set<string>();
  for (const part of value.parts) {
    obj(part, ['id', 'name', 'note', 'parentId']); id(part.id); text(part.name, 200); text(part.note, 3000, true);
    check(!ids.has(part.id)); ids.add(part.id);
    check(part.parentId === null || typeof part.parentId === 'string');
  }
  const parents = new Map(value.parts.map(p => [p.id as string, p.parentId as string | null]));
  for (const part of value.parts) {
    let parent = part.parentId; const seen = new Set([part.id]);
    while (parent !== null) { check(ids.has(parent) && !seen.has(parent)); seen.add(parent); parent = parents.get(parent)!; }
  }
  check(Array.isArray(value.evidence) && value.evidence.length <= 48 && value.evidence.length > 0);
  const refs = new Set<string>();
  for (const source of value.evidence) {
    obj(source, ['id', 'kind', 'title', 'text', 'basis']); id(source.id); text(source.title, 200);
    text(source.text, 12000); text(source.basis, 2000);
    check(['user', 'report', 'code', 'test'].includes(source.kind as string));
    check(!refs.has(source.id)); refs.add(source.id);
  }
  return structuredClone(value as unknown as PlanAsk);
}
export function validatePlanReply(value: unknown, ask: PlanAsk): PlanAnalysis {
  return parsePlanAnalysis(value, ask.parts.map(p => p.id), ask.evidence.map(e => e.id));
}
