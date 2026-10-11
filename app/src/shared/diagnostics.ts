/** Internal observation contract only; never part of AiResult, Envelope or Project. */
export const DIAGNOSTIC_VERSION = 'init006.diagnostic.1' as const;
export const DIAGNOSTIC_STAGES = Object.freeze([
  'response_body', 'envelope_parse', 'provider_envelope', 'content_parse',
  'result_contract', 'state_guard', 'state_contract', 'state_apply'
] as const);
export const DIAGNOSTIC_PATHS = Object.freeze([
  'provider.body',
  'provider.choices[].finish_reason',
  'provider.choices[].message.tool_calls',
  'provider.choices[].message.content',
  'result',
  'envelope',
  'envelope.mode',
  'envelope.result',
  'state',
  'state.id',
  'state.version',
  'state.pending.requestId',
  'result.projectId',
  'result.baseVersion',
  'result.requestId',
  'result.summary',
  'result.question',
  'result.proposals',
  'result.ideas',
  'result.openItems',
  'result.question.id',
  'result.question.topic',
  'result.question.text',
  'result.question.reason',
  'result.question.example',
  'result.question.options',
  'result.question.recommendation',
  'result.question.options[]',
  'result.question.options[].id',
  'result.question.options[].label',
  'result.question.options[].consequence',
  'result.question.recommendation.optionId',
  'result.question.recommendation.reason',
  'result.proposals[]',
  'result.proposals[].key',
  'result.proposals[].topic',
  'result.proposals[].kind',
  'result.proposals[].text',
  'result.proposals[].acceptance',
  'result.proposals[].sourceIds',
  'result.ideas[]',
  'result.ideas[].text',
  'result.ideas[].problem',
  'result.ideas[].effect',
  'result.ideas[].placement',
  'result.proposals[].sourceIds[]',
  'result.openItems[]',
] as const);
export const DIAGNOSTIC_RULES = Object.freeze([
  'expected_object', 'expected_array', 'expected_string', 'required_field', 'unexpected_field',
  'non_blank', 'max_length', 'max_count', 'min_count', 'value_mismatch', 'enum_value',
  'id_format', 'key_format', 'unique', 'known_source', 'known_option', 'question_not_allowed',
  'already_answered', 'tools_already_selected', 'storage_options', 'json_syntax',
  'body_missing', 'body_limit', 'body_read_failed', 'finish_not_stop', 'tool_calls_present',
  'invariant_failed', 'validation_exception', 'stale_project', 'stale_version', 'stale_request', 'application_exception'
] as const);
export type DiagnosticStage = typeof DIAGNOSTIC_STAGES[number];
export type DiagnosticPath = typeof DIAGNOSTIC_PATHS[number];
export type DiagnosticRule = typeof DIAGNOSTIC_RULES[number];
export interface Diagnostic {
  schemaVersion: typeof DIAGNOSTIC_VERSION;
  stage: DiagnosticStage; path: DiagnosticPath; rule: DiagnosticRule;
  length?: number; count?: number;
}
export type DiagnosticObserver = (diagnostic: Readonly<Diagnostic>) => unknown;
const member = (items: readonly string[], value: unknown): value is string => typeof value === 'string' && items.includes(value);
const size = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
/** Reconstruct from allowlists. Never spread input, interpolate IDs/indices, or copy error text. */
export function safeDiagnostic(raw: unknown): Readonly<Diagnostic> | null {
  try {
    if (!raw || typeof raw !== 'object') return null;
    const x = raw as Record<string, unknown>;
    if (x.schemaVersion !== DIAGNOSTIC_VERSION || !member(DIAGNOSTIC_STAGES,x.stage)
        || !member(DIAGNOSTIC_PATHS,x.path) || !member(DIAGNOSTIC_RULES,x.rule)) return null;
    const out: Diagnostic = {schemaVersion:DIAGNOSTIC_VERSION,stage:x.stage as DiagnosticStage,
      path:x.path as DiagnosticPath,rule:x.rule as DiagnosticRule};
    if (['max_length','non_blank','json_syntax','body_limit'].includes(x.rule) && size(x.length)) out.length = x.length;
    if (['max_count','min_count','unexpected_field','storage_options'].includes(x.rule) && size(x.count)) out.count = x.count;
    return Object.freeze(out);
  } catch { return null; }
}
/** Synchronous or asynchronous observer failures are contained; no retries and no logging. */
export function observeDiagnostic(observer: DiagnosticObserver | undefined, value: unknown): void {
  const safe = safeDiagnostic(value);
  if (!safe || !observer) return;
  try { void Promise.resolve(observer(safe)).catch(() => {}); } catch { /* observation only */ }
}
export function diagnosticSink(observer?: DiagnosticObserver) {
  let first: Readonly<Diagnostic> | null = null;
  const capture = (raw: unknown): void => {
    if (first) return;
    const safe = safeDiagnostic(raw);
    if (safe) { first = safe; observeDiagnostic(observer,safe); }
  };
  return {
    capture,
    report(stage: DiagnosticStage, path: DiagnosticPath, rule: DiagnosticRule, counts: {length?: number; count?: number} = {}): void {
      capture({schemaVersion:DIAGNOSTIC_VERSION,stage,path,rule,length:counts.length,count:counts.count});
    },
    get value() { return first; }
  };
}
