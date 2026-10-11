import { diagnosticSink, type DiagnosticObserver, type DiagnosticPath, type DiagnosticRule } from './diagnostics.js';
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
// The request validator above is unchanged. These helpers preserve the result predicates,
// adding fixed-path first-failure observation, not coercion or contract relaxation.
interface ResultValidator {
  check(ok: unknown, path: DiagnosticPath, rule: DiagnosticRule, counts?: {length?: number; count?: number}): asserts ok;
  object(x: unknown, path: DiagnosticPath): Record<string,unknown>;
  exact(x: Record<string,unknown>, allowed: string[], path: DiagnosticPath): void;
  string(x: unknown, path: DiagnosticPath, max?: number): asserts x is string;
  identifier(x: unknown, path: DiagnosticPath): asserts x is string;
  array(x: unknown, path: DiagnosticPath, max: number): asserts x is unknown[];
  sink: ReturnType<typeof diagnosticSink>;
}
function resultValidator(onDiagnostic: DiagnosticObserver | undefined, stage: 'result_contract' | 'state_contract'): ResultValidator {
  const sink = diagnosticSink(onDiagnostic);
  function check(ok: unknown, path: DiagnosticPath, rule: DiagnosticRule, counts: {length?: number; count?: number} = {}): asserts ok {
    if (!ok) { sink.report(stage,path,rule,counts); throw new ContractError(); }
  }
  function object(x: unknown, path: DiagnosticPath): Record<string,unknown> {
    check(x && typeof x === 'object' && !Array.isArray(x),path,'expected_object'); return x as Record<string,unknown>;
  }
  function exact(x: Record<string,unknown>, allowed: string[], path: DiagnosticPath) {
    const extra = Object.keys(x).filter(k => !allowed.includes(k)).length;
    check(extra === 0,path,'unexpected_field',{count:extra});
    // k comes ONLY from a code-owned list; safeDiagnostic independently enforces the path enum.
    for (const k of allowed) check(Object.hasOwn(x,k),`${path}.${k}` as DiagnosticPath,'required_field');
  }
  function string(x: unknown, path: DiagnosticPath, max = REQUIREMENT_MAX_LENGTH): asserts x is string {
    check(typeof x === 'string',path,'expected_string');
    check(x.length <= max,path,'max_length',{length:x.length});
    check(x.trim().length > 0,path,'non_blank',{length:x.length});
  }
  function identifier(x: unknown, path: DiagnosticPath): asserts x is string {
    string(x,path,120); check(/^[A-Za-z0-9:_-]+$/.test(x),path,'id_format');
  }
  function array(x: unknown, path: DiagnosticPath, max: number): asserts x is unknown[] {
    check(Array.isArray(x),path,'expected_array'); check(x.length <= max,path,'max_count',{count:x.length});
  }
  return {check,object,exact,string,identifier,array,sink};
}
export function validateResult(raw: unknown, request: RequestPayload, onDiagnostic?: DiagnosticObserver,
  stage: 'result_contract' | 'state_contract' = 'result_contract'): AiResult {
  const v: ResultValidator = resultValidator(onDiagnostic,stage);
  try {
    const x = v.object(raw,'result');
    v.exact(x,['projectId','baseVersion','requestId','summary','question','proposals','ideas','openItems'],'result');
    v.check(x.projectId === request.projectId,'result.projectId','value_mismatch');
    v.check(x.baseVersion === request.baseVersion,'result.baseVersion','value_mismatch');
    v.check(x.requestId === request.requestId,'result.requestId','value_mismatch');
    v.string(x.summary,'result.summary',1600);
    if (x.question !== null) {
      v.check(request.stage === 'discover' && request.answers.length === 0,'result.question','question_not_allowed');
      const q = v.object(x.question,'result.question');
      v.exact(q,['id','topic','text','reason','example','options','recommendation'],'result.question');
      v.identifier(q.id,'result.question.id'); v.check(topics.includes(q.topic as string),'result.question.topic','enum_value');
      v.check(!request.answers.some(a => a.topic === q.topic),'result.question.topic','already_answered');
      v.check(!(q.topic === 'tools' && request.brief.tools !== 'undecided'),'result.question.topic','tools_already_selected');
      v.string(q.text,'result.question.text'); v.string(q.reason,'result.question.reason'); v.string(q.example,'result.question.example');
      v.array(q.options,'result.question.options',4); v.check(q.options.length >= 2,'result.question.options','min_count',{count:q.options.length});
      const ids = new Set<string>();
      for (const item of q.options) {
        const o = v.object(item,'result.question.options[]'); v.exact(o,['id','label','consequence'],'result.question.options[]');
        v.identifier(o.id,'result.question.options[].id'); v.string(o.label,'result.question.options[].label',160);
        v.string(o.consequence,'result.question.options[].consequence');
        v.check(!ids.has(o.id),'result.question.options[].id','unique'); ids.add(o.id);
      }
      // Existing canonical storage semantics remain exactly as before.
      if (q.topic === 'storage') v.check(ids.has('browser') && ids.has('multi-device') && ids.size === 2,
        'result.question.options','storage_options',{count:ids.size});
      if (q.recommendation !== null) {
        const r = v.object(q.recommendation,'result.question.recommendation');
        v.exact(r,['optionId','reason'],'result.question.recommendation'); v.identifier(r.optionId,'result.question.recommendation.optionId');
        v.check(ids.has(r.optionId),'result.question.recommendation.optionId','known_option'); v.string(r.reason,'result.question.recommendation.reason');
      }
    }
    v.array(x.proposals,'result.proposals',8); const proposalKeys = new Set<string>(); const sourceIds = new Set(request.sources.map(s => s.id));
    for (const item of x.proposals) {
      const p = v.object(item,'result.proposals[]'); v.exact(p,['key','topic','kind','text','acceptance','sourceIds'],'result.proposals[]');
      v.string(p.key,'result.proposals[].key',60); v.check(/^[a-z][a-z0-9-]*$/.test(p.key),'result.proposals[].key','key_format');
      v.check(!proposalKeys.has(p.key),'result.proposals[].key','unique'); proposalKeys.add(p.key);
      v.check(topics.includes(p.topic as string),'result.proposals[].topic','enum_value');
      v.check(['functional','quality','constraint'].includes(p.kind as string),'result.proposals[].kind','enum_value');
      v.string(p.text,'result.proposals[].text'); v.string(p.acceptance,'result.proposals[].acceptance');
      v.array(p.sourceIds,'result.proposals[].sourceIds',8);
      v.check(p.sourceIds.length > 0,'result.proposals[].sourceIds','min_count',{count:p.sourceIds.length});
      for (const s of p.sourceIds) { v.identifier(s,'result.proposals[].sourceIds[]'); v.check(sourceIds.has(s),'result.proposals[].sourceIds[]','known_source'); }
    }
    v.array(x.ideas,'result.ideas',3);
    for (const item of x.ideas) {
      const i = v.object(item,'result.ideas[]'); v.exact(i,['text','problem','effect','placement'],'result.ideas[]');
      v.string(i.text,'result.ideas[].text'); v.string(i.problem,'result.ideas[].problem'); v.string(i.effect,'result.ideas[].effect');
      v.check(i.placement === 'core' || i.placement === 'future','result.ideas[].placement','enum_value');
    }
    v.array(x.openItems,'result.openItems',8); x.openItems.forEach(s => v.string(s,'result.openItems[]'));
    return structuredClone(raw) as AiResult;
  } catch (error) { v.sink.report(stage,'result','validation_exception'); throw error; }
}
export function validateEnvelope(raw: unknown, request: RequestPayload, onDiagnostic?: DiagnosticObserver): Envelope {
  const v: ResultValidator = resultValidator(onDiagnostic,'state_contract');
  try {
    const x = v.object(raw,'envelope'); v.exact(x,['mode','result'],'envelope');
    v.check(x.mode === 'mock' || x.mode === 'deepseek','envelope.mode','enum_value');
    return {mode:x.mode as Envelope['mode'], result:validateResult(x.result,request,v.sink.capture,'state_contract')};
  } catch (error) { v.sink.report('state_contract','envelope','validation_exception'); throw error; }
}
