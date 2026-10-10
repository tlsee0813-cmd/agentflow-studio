import { SCHEMA_VERSION, ANSWER_MAX_LENGTH, REQUIREMENT_MAX_LENGTH, type AiResult, type RequestPayload, type Envelope } from './contracts.js';
export class ContractError extends Error { constructor(message = 'INVALID_RESPONSE') { super(message); this.name = 'ContractError'; } }
const topics = ['goal', 'audience', 'core-scene', 'storage', 'tools', 'constraints', 'acceptance'];
function assert(ok: unknown): asserts ok { if (!ok) throw new ContractError(); }
function record(x: unknown): Record<string, unknown> { assert(x && typeof x === 'object' && !Array.isArray(x)); return x as Record<string, unknown>; }
function keys(x: Record<string, unknown>, allowed: string[]) { assert(Object.keys(x).every(k => allowed.includes(k))); assert(allowed.every(k => Object.hasOwn(x, k))); }
function str(x: unknown, max = REQUIREMENT_MAX_LENGTH, empty = false): asserts x is string { assert(typeof x === 'string' && x.length <= max && (empty || x.trim().length > 0)); }
function id(x: unknown): asserts x is string { str(x, 120); assert(/^[A-Za-z0-9:_-]+$/.test(x)); }
function arr(x: unknown, max: number): asserts x is unknown[] { assert(Array.isArray(x) && x.length <= max); }
function integer(x: unknown) { assert(Number.isSafeInteger(x) && (x as number) >= 1); }
function listStrings(x: unknown, max: number) { arr(x, max); x.forEach(s => str(s)); }
export function validateRequest(raw: unknown): RequestPayload {
  const x = record(raw);
  keys(x, ['schemaVersion','projectId','baseVersion','requestId','stage','brief','sources','answers','requirements']);
  assert(x.schemaVersion === SCHEMA_VERSION); id(x.projectId); id(x.requestId); integer(x.baseVersion);
  assert(x.stage === 'discover' || x.stage === 'summarize');
  const b = record(x.brief); keys(b, ['idea','tools','constraints']); str(b.idea,6000); str(b.constraints,1500,true);
  assert(['codex-only','claude-only','mixed','undecided'].includes(b.tools as string));
  arr(x.sources, 40); const sources = new Set<string>();
  for (const item of x.sources) {
    const s = record(item); keys(s,['id','kind','text','atVersion']); id(s.id); str(s.text,8000); integer(s.atVersion);
    assert((s.atVersion as number) <= (x.baseVersion as number));
    assert(['customer-input','customer-answer','ai-response','mock-response','customer-confirmation'].includes(s.kind as string));
    assert(!sources.has(s.id)); sources.add(s.id);
  }
  assert(sources.size > 0);
  arr(x.answers, 8); const answers = new Set<string>();
  for (const item of x.answers) {
    const a = record(item); keys(a,['id','questionId','topic','disposition','optionId','text','sourceId']);
    id(a.id); id(a.questionId); id(a.sourceId); assert(sources.has(a.sourceId)); assert(!answers.has(a.id)); answers.add(a.id);
    assert(topics.includes(a.topic as string)); assert(['answered','unknown','deferred'].includes(a.disposition as string));
    if (a.optionId !== null) id(a.optionId); str(a.text,ANSWER_MAX_LENGTH);
  }
  arr(x.requirements, 24); const requirements = new Set<string>();
  for (const item of x.requirements) {
    const r = record(item); keys(r,['id','scope','topic','kind','text','acceptance','priority','status','origin','sourceIds','version','locked','needsReview']);
    id(r.id); assert(!requirements.has(r.id)); requirements.add(r.id);
    assert(r.scope === 'user-project' && topics.includes(r.topic as string));
    assert(['functional','quality','constraint'].includes(r.kind as string)); str(r.text); str(r.acceptance);
    assert(['must','should','could','undecided'].includes(r.priority as string));
    assert(['proposed','confirmed','deferred','rejected'].includes(r.status as string));
    assert(['customer','ai','mock'].includes(r.origin as string)); integer(r.version); assert((r.version as number) <= (x.baseVersion as number));
    assert(typeof r.locked === 'boolean' && typeof r.needsReview === 'boolean');
    arr(r.sourceIds, 40); assert(r.sourceIds.length > 0); for (const s of r.sourceIds) { id(s); assert(sources.has(s)); }
  }
  return structuredClone(raw) as RequestPayload;
}
export function validateResult(raw: unknown, request: RequestPayload): AiResult {
  const x = record(raw);
  keys(x,['projectId','baseVersion','requestId','summary','question','proposals','ideas','openItems']);
  assert(x.projectId === request.projectId && x.baseVersion === request.baseVersion && x.requestId === request.requestId);
  str(x.summary,1600);
  if (x.question !== null) {
    assert(request.stage === 'discover' && request.answers.length === 0);
    const q = record(x.question); keys(q,['id','topic','text','reason','example','options','recommendation']);
    id(q.id); assert(topics.includes(q.topic as string));
    assert(!request.answers.some(a => a.topic === q.topic));
    assert(!(q.topic === 'tools' && request.brief.tools !== 'undecided'));
    str(q.text); str(q.reason); str(q.example); arr(q.options, 4); assert(q.options.length >= 2);
    const ids = new Set<string>();
    for (const item of q.options) {
      const o = record(item); keys(o,['id','label','consequence']); id(o.id); str(o.label,160); str(o.consequence);
      assert(!ids.has(o.id)); ids.add(o.id);
    }
    // Reserved storage choice IDs have domain semantics. Do not trust model-authored
    // labels for these IDs: the server normalizes the complete question before delivery.
    if (q.topic === 'storage') assert(ids.has('browser') && ids.has('multi-device') && ids.size === 2);
    if (q.recommendation !== null) {
      const r = record(q.recommendation); keys(r,['optionId','reason']); id(r.optionId); assert(ids.has(r.optionId)); str(r.reason);
    }
  }
  arr(x.proposals, 8); const proposalKeys = new Set<string>(); const sourceIds = new Set(request.sources.map(s => s.id));
  for (const item of x.proposals) {
    const p = record(item); keys(p,['key','topic','kind','text','acceptance','sourceIds']);
    str(p.key,60); assert(/^[a-z][a-z0-9-]*$/.test(p.key)); assert(!proposalKeys.has(p.key)); proposalKeys.add(p.key);
    assert(topics.includes(p.topic as string)); assert(['functional','quality','constraint'].includes(p.kind as string));
    str(p.text); str(p.acceptance); arr(p.sourceIds, 8); assert(p.sourceIds.length > 0);
    for (const s of p.sourceIds) { id(s); assert(sourceIds.has(s)); }
  }
  arr(x.ideas, 3);
  for (const item of x.ideas) {
    const i = record(item); keys(i,['text','problem','effect','placement']); str(i.text); str(i.problem); str(i.effect);
    assert(i.placement === 'core' || i.placement === 'future');
  }
  listStrings(x.openItems, 8);
  return structuredClone(raw) as AiResult;
}
export function validateEnvelope(raw: unknown, request: RequestPayload): Envelope {
  const x = record(raw); keys(x,['mode','result']); assert(x.mode === 'mock' || x.mode === 'deepseek');
  return { mode: x.mode as Envelope['mode'], result: validateResult(x.result, request) };
}
