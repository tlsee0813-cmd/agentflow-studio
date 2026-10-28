import { parsePlanAnalysis, EVIDENCE_KINDS, type Evidence, type PlanAnalysis } from './change-plan.js';
import { validAuthoringAsk, type AuthoringAsk } from './authoring-context.js';

/** studio.plan.1: the four keys as before (still accepted). studio.plan.2: the same, plus the draft's authoring context as its own
 * field (never a source, never the request's scope). studio.plan.3: the same five keys as studio.plan.2; its reply may propose no
 * change (items=[]). The app sends only studio.plan.3 now; a tab still sending .1/.2 never gets an empty reply it cannot read. */
export interface PlanAsk {
  schemaVersion: 'studio.plan.1' | 'studio.plan.2' | 'studio.plan.3';
  intent: string;
  parts: { id: string; name: string; note: string; parentId: string | null }[];
  evidence: Evidence[];
  authoring?: AuthoringAsk;
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
  check(value && typeof value === 'object' && !Array.isArray(value));
  const v2 = ['studio.plan.2', 'studio.plan.3'].includes((value as Record<string, unknown>).schemaVersion as string);
  obj(value, ['schemaVersion', 'intent', 'parts', 'evidence', ...(v2 ? ['authoring'] : [])]);
  check(value.schemaVersion === 'studio.plan.1' || v2); text(value.intent, 6000);
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
    check(EVIDENCE_KINDS.includes(source.kind as Evidence['kind']));
    check(!refs.has(source.id)); refs.add(source.id);
  }
  if (v2) check(validAuthoringAsk(value.authoring, value.parts as { id: string; name: string }[]));
  return structuredClone(value as unknown as PlanAsk);
}
/** Only a studio.plan.3 request may be answered with no proposed change. */
export const allowsNoChange = (ask: Pick<PlanAsk, 'schemaVersion'>) => ask.schemaVersion === 'studio.plan.3';
export function validatePlanReply(value: unknown, ask: PlanAsk): PlanAnalysis {
  const reply = parsePlanAnalysis(value, ask.parts.map(p => p.id), ask.evidence.map(e => e.id));
  check(reply.items.length > 0 || allowsNoChange(ask));
  // AI overview suggestions do not establish a global mandatory-dependency graph.
  // Actual selected scope is evaluated separately; authored examples may still use explicit dependencies.
  check(reply.items.every(item => item.dependsOn.length === 0));
  const parts = new Map(ask.parts.map(p => [p.id, p])), evidence = new Map(ask.evidence.map(e => [e.id, e]));
  const normal = (text: string) => text.replace(/\s+/g, ' ').trim();
  for (const item of reply.items) for (const view of item.presentation ?? []) {
    // Only whitespace-normalized exact excerpts are checked here. A substring and valid refs do not prove
    // factual accuracy, completeness, attribution, or that a desired result has been implemented.
    const quote = normal(view.current.text);
    check(view.current.source === 'part-note'
      ? normal(parts.get(view.partId)!.note).includes(quote)
      : view.current.refs.some(ref => normal(evidence.get(ref)!.text).includes(quote)));
    if (view.origin === 'intent') check(view.wanted.refs.some(ref => evidence.get(ref)!.kind === 'user'));
  }
  return reply;
}
