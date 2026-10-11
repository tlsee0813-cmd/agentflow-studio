// Node 22 built-ins only. Input validation/shape walk adapted from IDEA013;
// v2 provenance rules are explicit below. No model calls or semantic truth judge.
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
const schema = JSON.parse(readFileSync(new URL('../contracts/output.schema.json', import.meta.url), 'utf8'));
export const need = (ok, message) => { if (!ok) throw new Error(message); };
export const nonempty = x => typeof x === 'string' && x.trim().length > 0;
const validId = x => typeof x === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(x);
export function exactKeys(value, keys, at) {
  need(value !== null && typeof value === 'object' && !Array.isArray(value), `${at}: 객체 필요`);
  need(isDeepStrictEqual(Object.keys(value).sort(), [...keys].sort()), `${at}: 필드는 ${keys.join(', ')}만 허용`);
}
export function validateCase(c) {
  exactKeys(c, ['caseId', 'request', 'context', 'decisions', 'materials'], 'case (평가 메모 제외)');
  need(validId(c.caseId), 'caseId 형식 오류');
  for (const k of ['context', 'decisions', 'materials']) need(Array.isArray(c[k]), `${k}: 배열 필요`);
  exactKeys(c.request, ['id', 'text'], 'request');
  c.context.forEach(x => exactKeys(x, ['id', 'text'], 'context'));
  c.decisions.forEach(x => {
    exactKeys(x, ['id', 'text', 'status', 'locked'], 'decision input');
    need(['confirmed', 'proposed', 'deferred'].includes(x.status), 'decision.status 오류');
    need(typeof x.locked === 'boolean' && (!x.locked || x.status === 'confirmed'), 'confirmed만 잠글 수 있음');
  });
  c.materials.forEach(x => {
    exactKeys(x, ['id', 'kind', 'text'], 'material');
    need(['note', 'code_diff', 'test_report', 'summary'].includes(x.kind), 'material.kind 오류');
  });
  const entries = [c.request, ...c.context, ...c.decisions, ...c.materials];
  need(entries.every(x => validId(x.id) && nonempty(x.text)), '출처마다 ID와 비어 있지 않은 text 필요');
  need(new Set(entries.map(x => x.id)).size === entries.length, '출처 ID 중복');
  return c;
}
export function validateCases(cases) {
  need(Array.isArray(cases) && cases.length > 0, '사례는 비어 있지 않은 배열이어야 함');
  cases.forEach(validateCase);
  need(new Set(cases.map(c => c.caseId)).size === cases.length, 'caseId 중복');
  return cases;
}
export function sourceMap(c, answer = null) {
  const entries = [c.request, ...c.context, ...c.decisions, ...c.materials].map(x => [x.id, x]);
  if (answer) entries.push([answer.sourceId, answer]);
  return new Map(entries);
}
export function validateAnswer(a, c) {
  validateCase(c);
  exactKeys(a, ['sourceId', 'origin', 'providedBy', 'kind', 'inReplyTo', 'text'], 'answer');
  need(validId(a.sourceId) && !sourceMap(c).has(a.sourceId), '새 답변 ID 필요 (기존 출처와 중복 불가)');
  need(['test_answer', 'customer_answer'].includes(a.origin), 'answer.origin 명시 필요');
  need(['answer', 'defer', 'unknown'].includes(a.kind), 'answer.kind 오류');
  need([a.providedBy, a.inReplyTo, a.text].every(nonempty), '제공자·실제 질문·명시적 답변 필요; 빈칸 자동 보충 안 함');
  return a;
}
// Implements ONLY the keywords used by this schema, not general JSON Schema.
function shape(v, s, at = '$') {
  if (s.anyOf) {
    need(s.anyOf.some(b => { try { shape(v, b, at); return true; } catch { return false; } }), `${at}: 허용 형태 아님`);
    return;
  }
  const type = v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
  if (s.type) need(type === s.type, `${at}: 자료형 오류`);
  if (Object.hasOwn(s, 'const')) need(v === s.const, `${at}: 계약 버전/고정값 오류`);
  if (s.enum) need(s.enum.includes(v), `${at}: 허용값 아님`);
  if (type === 'string') {
    if (s.minLength) need(v.trim().length >= s.minLength, `${at}: 빈 문자열`);
    if (s.pattern) need(new RegExp(s.pattern).test(v), `${at}: ID 형식 오류`);
  }
  if (type === 'array') {
    need(v.length >= (s.minItems ?? 0) && v.length <= (s.maxItems ?? Infinity), `${at}: 항목 수 오류`);
    if (s.uniqueItems) need(new Set(v.map(x => JSON.stringify(x))).size === v.length, `${at}: 중복 항목`);
    v.forEach((x, i) => shape(x, s.items, `${at}[${i}]`));
  }
  if (type === 'object') {
    exactKeys(v, s.required, at);
    Object.entries(s.properties).forEach(([k, sub]) => shape(v[k], sub, `${at}.${k}`));
  }
}
export function validateResponse(r, c, a = null) {
  validateCase(c);
  if (a) validateAnswer(a, c);
  shape(r, schema);
  const count = r.scene?.alternatives.length ?? 0;
  need(r.route === 'fork' ? count >= 2 : r.route === 'need_info' ? count === 0 : count <= 1, 'route/scene 불일치');
  if (r.scene) need(new Set(r.scene.alternatives.map(x => x.id)).size === count, '대안 ID 중복');
  const d = r.decision;
  need(d.state === 'open' ? nonempty(d.question) : d.question === null, 'open만 질문 허용; 그 외 question=null');
  need(r.route === 'proceed' ? ['not_needed', 'resolved', 'test_only'].includes(d.state) : ['open', 'deferred'].includes(d.state), 'route/decision.state 불일치');
  need(d.state !== 'not_needed' || d.sourceId === null, 'not_needed의 sourceId는 null');
  const sources = sourceMap(c, a);
  r.evidence.forEach(e => need(sources.has(e.sourceId) && sources.get(e.sourceId).text.includes(e.quote), `evidence ${e.sourceId}: 정확한 원문 부분 인용 아님`));
  if (d.sourceId !== null) need(sources.has(d.sourceId), 'decision.sourceId 존재하지 않음');
  const confirmed = id => c.decisions.some(x => x.id === id && x.status === 'confirmed');
  const requested = id => id === c.request.id || (a?.origin === 'customer_answer' && id === a.sourceId);
  const current = id => requested(id) || [...c.context, ...c.materials].some(x => x.id === id);
  const newInput = id => id === c.request.id || id === a?.sourceId;
  const testSource = id => a?.origin === 'test_answer' && id === a.sourceId;
  const customerInstruction = id => id === c.request.id ||
    (a?.origin === 'customer_answer' && a.kind === 'answer' && id === a.sourceId);
  const hasNote = (kind, id) => r.notes.some(n => n.kind === kind && n.sourceIds.length === 1 && n.sourceIds[0] === id);
  const samePair = (left, right) => left.length === 2 && right.length === 2 && left.every(id => right.includes(id));
  // 'change' declares an explicit, scoped customer amendment, not an approval token.
  // These are source/state checks, not a natural-language authority or clarity judge.
  const preserveOriginal = decisionId => need(
    r.notes.filter(x => x.kind === 'confirmed' && x.sourceIds.includes(decisionId))
      .every(x => x.text === sources.get(decisionId).text),
    '변경 관계: 이전 confirmed 메모의 원문은 보존하고 새 내용은 requested/change 또는 test_only에 기록');
  const changes = r.notes.filter(n => n.kind === 'change');
  for (const n of changes) {
    need(n.sourceIds.length === 2 && n.sourceIds.some(confirmed) && n.sourceIds.some(customerInstruction),
      'change: 이전 확정 하나와 명시 고객지시 출처 하나 필요; 자료/제안/시험답변 불가');
    const instructionId = n.sourceIds.find(customerInstruction);
    const decisionId = n.sourceIds.find(confirmed);
    need(hasNote('requested', instructionId), 'change: 같은 지시 출처의 requested 메모 필요');
    need(r.evidence.some(e => e.sourceId === instructionId), 'change: 명시 지시의 정확한 evidence 인용 필요');
    preserveOriginal(decisionId);
    if (r.route === 'proceed') {
      need(instructionId === c.request.id ? d.state === 'not_needed' :
        d.state === 'resolved' && d.sourceId === instructionId,
      'change: 초기 지시는 not_needed, 실제 후속 지시는 resolved와 해당 답변 출처 필요');
    }
  }
  if (d.state === 'resolved') need(confirmed(d.sourceId) || (a?.origin === 'customer_answer' && a.kind === 'answer' && d.sourceId === a.sourceId), 'resolved는 이전 확정 또는 실제 명시 고객답변 출처 필요');
  if (d.state === 'test_only') need(a?.kind === 'answer' && testSource(d.sourceId), 'test_only는 명시적 시험답변 출처 필요');
  for (const n of r.notes) {
    need(n.sourceIds.every(id => sources.has(id)), 'notes: 없는 출처');
    const one = n.sourceIds.length === 1;
    if (n.kind === 'requested') need(one && requested(n.sourceIds[0]), 'requested: 현재 요청/실제 고객답변 출처 하나 필요');
    if (n.kind === 'confirmed') need(one && confirmed(n.sourceIds[0]), 'confirmed: 입력의 기존 confirmed 결정 하나만 허용');
    if (n.kind === 'context') need(n.sourceIds.length > 0 && n.sourceIds.every(current), 'context: 현황/자료/요청 안의 배경 또는 실제 고객 관측 출처 필요');
    if (n.kind === 'test_only') need(one && testSource(n.sourceIds[0]), 'test_only 메모: 시험답변 출처 하나 필요');
    if (n.kind === 'conflict') {
      need(n.sourceIds.length === 2 && n.sourceIds.some(confirmed) && n.sourceIds.some(newInput), 'conflict: 이전 확정 하나와 새 요청/답변 하나 필요 (현황 변경은 아님)');
      if (r.route === 'proceed') {
        preserveOriginal(n.sourceIds.find(confirmed));
        const inputId = n.sourceIds.find(newInput);
        const declaredChange = changes.some(x => samePair(x.sourceIds, n.sourceIds));
        const testCondition = a?.kind === 'answer' && testSource(inputId) &&
          d.state === 'test_only' && d.sourceId === inputId && hasNote('test_only', inputId);
        need(declaredChange || testCondition,
          '미해결 conflict: 같은 출처 쌍의 명시 change 또는 해당 시험답변의 test_only 없이 진행할 수 없음');
      }
    }
  }
  if (r.route === 'need_info') need(r.notes.some(n => n.kind === 'unknown'), 'need_info는 미확인 내용 unknown 메모 필요');
  if (a?.origin === 'test_answer') {
    need(r.notes.some(n => n.kind === 'test_only' && n.sourceIds[0] === a.sourceId), '시험답변 표시 누락');
    need(d.state !== 'resolved', '시험답변의 resolved 승격 금지');
  }
  if (a && ['defer', 'unknown'].includes(a.kind)) need(d.state === 'deferred' && d.sourceId === a.sourceId, '보류/모르겠음은 deferred와 답변 출처 보존');
  // No keyword guesses about entailment, hidden facts, feasibility, neutrality or scope.
  // Human review remains required even when this function returns successfully.
  return r;
}
export const validateText = (raw, c, a = null) => validateResponse(JSON.parse(raw), c, a);
