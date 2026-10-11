// Node 22 built-ins only. Builds messages; never reads credentials or calls an API.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs, isDeepStrictEqual } from 'node:util';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(path, 'utf8');
const json = path => JSON.parse(read(path));
const schema = json(resolve(ROOT, 'contracts/output.schema.json'));
const contract = read(resolve(ROOT, 'contracts/OUTPUT_CONTRACT.md')).trim();
const strategies = Object.fromEntries(['baseline', 'enhanced'].map(id =>
  [id, read(resolve(ROOT, `prompts/${id}.md`)).trim()]));
const fail = message => { throw new Error(message); };
const requireThat = (condition, message) => { if (!condition) fail(message); };
const nonempty = x => typeof x === 'string' && x.trim().length > 0;
const validId = x => typeof x === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(x);
function exactKeys(value, names, where) {
  requireThat(value && typeof value === 'object' && !Array.isArray(value), `${where}: 객체가 필요합니다.`);
  requireThat(isDeepStrictEqual(Object.keys(value).sort(), [...names].sort()),
    `${where}: 허용 필드는 ${names.join(', ')}입니다. 평가 메모를 입력에 섞지 마세요.`);
}

export function validateCase(c) {
  exactKeys(c, ['caseId', 'request', 'context', 'decisions', 'materials'], 'case');
  requireThat(validId(c.caseId), 'caseId: 영문으로 시작하는 짧은 ID가 필요합니다.');
  for (const name of ['context', 'decisions', 'materials'])
    requireThat(Array.isArray(c[name]), `${name}: 배열이 필요합니다.`);
  exactKeys(c.request, ['id', 'text'], 'request');
  c.context.forEach(x => exactKeys(x, ['id', 'text'], 'context item'));
  c.decisions.forEach(x => {
    exactKeys(x, ['id', 'text', 'status', 'locked'], 'decision');
    requireThat(['confirmed', 'proposed', 'deferred'].includes(x.status), 'decision.status 값이 잘못되었습니다.');
    requireThat(typeof x.locked === 'boolean' && (!x.locked || x.status === 'confirmed'),
      'decision.locked: confirmed만 잠글 수 있습니다.');
  });
  c.materials.forEach(x => {
    exactKeys(x, ['id', 'kind', 'text'], 'material');
    requireThat(['note', 'code_diff', 'test_report', 'summary'].includes(x.kind), 'material.kind 값이 잘못되었습니다.');
  });
  const sources = [c.request, ...c.context, ...c.decisions, ...c.materials];
  requireThat(sources.every(x => validId(x.id) && nonempty(x.text)), '출처마다 유효한 id와 빈칸이 아닌 text가 필요합니다.');
  requireThat(new Set(sources.map(x => x.id)).size === sources.length, '사례 안의 출처 ID가 중복됩니다.');
  return c;
}
export function validateCases(cases) {
  requireThat(Array.isArray(cases) && cases.length > 0, '사례 파일은 비어 있지 않은 배열이어야 합니다.');
  cases.forEach(validateCase);
  requireThat(new Set(cases.map(c => c.caseId)).size === cases.length, 'caseId가 중복됩니다.');
  return cases;
}
function sourceMap(c, answer = null) {
  const entries = [c.request, ...c.context, ...c.decisions, ...c.materials].map(x => [x.id, x]);
  if (answer) entries.push([answer.sourceId, answer]);
  return new Map(entries);
}
export function initialRequest(c, promptId) {
  validateCase(c);
  requireThat(Object.hasOwn(strategies, promptId), 'promptId는 baseline 또는 enhanced여야 합니다.');
  return {
    requestId: `${c.caseId}.${promptId}.t1`, caseId: c.caseId, promptId, turn: 1, parentRequestId: null,
    messages: [
      { role: 'system', content: `${strategies[promptId]}\n\n${contract}` },
      { role: 'user', content: JSON.stringify({ turn: 'initial', case: c }, null, 2) }
    ]
  };
}
export function buildBatch(cases) {
  validateCases(cases);
  // Counterbalance request order, without sharing conversational context across variants.
  return cases.flatMap((c, i) => (i % 2 ? ['enhanced', 'baseline'] : ['baseline', 'enhanced'])
    .map(id => initialRequest(c, id)));
}

// Validator for the small subset used by the bundled schema, not a general JSON Schema engine.
function shape(value, s, path = '$') {
  if (s.anyOf) {
    requireThat(s.anyOf.some(branch => { try { shape(value, branch, path); return true; } catch { return false; } }),
      `${path}: 허용된 JSON 형태가 아닙니다.`);
    return;
  }
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  if (s.type) requireThat([s.type].flat().includes(type), `${path}: 자료형이 잘못되었습니다.`);
  if (Object.hasOwn(s, 'const')) requireThat(value === s.const, `${path}: 고정값이 다릅니다.`);
  if (s.enum) requireThat(s.enum.includes(value), `${path}: 허용된 값이 아닙니다.`);
  if (type === 'string') {
    if (s.minLength) requireThat(nonempty(value), `${path}: 빈 문자열입니다.`);
    if (s.pattern) requireThat(new RegExp(s.pattern).test(value), `${path}: ID 형식이 잘못되었습니다.`);
  }
  if (type === 'array') {
    requireThat(value.length >= (s.minItems ?? 0) && value.length <= (s.maxItems ?? Infinity), `${path}: 항목 수가 잘못되었습니다.`);
    if (s.uniqueItems) requireThat(new Set(value.map(x => JSON.stringify(x))).size === value.length, `${path}: 중복 항목입니다.`);
    value.forEach((v, i) => shape(v, s.items, `${path}[${i}]`));
  }
  if (type === 'object') {
    exactKeys(value, s.required, path);
    Object.entries(s.properties).forEach(([k, sub]) => shape(value[k], sub, `${path}.${k}`));
  }
}
export function validateResponse(response, c, answer = null) {
  validateCase(c);
  if (answer) validateAnswer(answer, c);
  shape(response, schema);
  const count = response.scene?.alternatives.length ?? 0;
  requireThat(response.route === 'fork' ? count >= 2 : response.route === 'need_info' ? count === 0 : count <= 1,
    'route와 장면 대안 수가 맞지 않습니다.');
  if (response.scene) requireThat(new Set(response.scene.alternatives.map(x => x.id)).size === count, '대안 ID가 중복됩니다.');
  const d = response.decision;
  requireThat(d.state === 'open' ? response.route !== 'proceed' && nonempty(d.question) : d.question === null,
    'open에는 질문 하나가, 그 밖의 상태에는 question=null이 필요합니다.');
  requireThat(response.route === 'proceed' ? ['not_needed', 'resolved', 'test_only'].includes(d.state) : ['open', 'deferred'].includes(d.state),
    'route와 decision.state가 맞지 않습니다.');
  const sources = sourceMap(c, answer);
  for (const item of response.evidence)
    requireThat(sources.has(item.sourceId) && sources.get(item.sourceId).text.includes(item.quote),
      `evidence ${item.sourceId}: 존재하는 출처의 정확한 부분 인용이 아닙니다.`);
  if (d.sourceId !== null) requireThat(sources.has(d.sourceId), 'decision.sourceId가 존재하지 않습니다.');
  const isConfirmedSource = id => c.decisions.some(x => x.id === id && x.status === 'confirmed') ||
    (answer?.origin === 'customer_answer' && answer.kind === 'answer' && id === answer.sourceId);
  if (d.state === 'resolved') requireThat(isConfirmedSource(d.sourceId), 'resolved에는 기존 확정 또는 실제 고객답변 출처가 필요합니다.');
  if (d.state === 'test_only') requireThat(answer?.origin === 'test_answer' && answer.kind === 'answer' && d.sourceId === answer.sourceId,
    'test_only에는 명시적인 시험답변 출처가 필요합니다.');
  for (const n of response.notes) {
    requireThat(n.sourceIds.every(id => sources.has(id)), 'notes에 존재하지 않는 출처가 있습니다.');
    if (n.kind === 'confirmed') requireThat(n.sourceIds.length > 0 && n.sourceIds.some(isConfirmedSource) &&
      !(answer?.origin === 'test_answer' && n.sourceIds.includes(answer.sourceId)),
      'confirmed의 출처가 없거나 시험답변을 확정으로 바꿨습니다.');
    if (n.kind === 'conflict') requireThat(n.sourceIds.some(id => c.decisions.some(x => x.id === id && x.status === 'confirmed')) &&
      n.sourceIds.some(id => id === c.request.id || id === answer?.sourceId), 'conflict에는 기존 확정과 새 요청/답변 출처가 필요합니다.');
  }
  if (answer?.origin === 'test_answer') {
    requireThat(response.notes.some(n => n.kind === 'test_only' && n.sourceIds.includes(answer.sourceId)), '시험답변 표시가 빠졌습니다.');
    requireThat(d.state !== 'resolved', '시험답변을 실제 resolved로 표시할 수 없습니다.');
  }
  if (answer && ['defer', 'unknown'].includes(answer.kind))
    requireThat(d.state === 'deferred' && d.sourceId === answer.sourceId, '보류·모르겠음의 출처와 상태를 보존해야 합니다.');
  // This does NOT prove quotes entail claims, detect semantic conflicts, or verify real app behavior.
  return response;
}
export function validateAnswer(answer, c) {
  exactKeys(answer, ['sourceId', 'origin', 'providedBy', 'kind', 'inReplyTo', 'text'], 'answer');
  requireThat(validId(answer.sourceId) && !sourceMap(c).has(answer.sourceId), '답변 출처 ID가 없거나 기존 ID와 중복됩니다.');
  requireThat(['test_answer', 'customer_answer'].includes(answer.origin), '답변 origin을 명시해야 합니다.');
  requireThat(['answer', 'defer', 'unknown'].includes(answer.kind), '답변 kind가 잘못되었습니다.');
  requireThat([answer.providedBy, answer.inReplyTo, answer.text].every(nonempty),
    '실제 질문 원문·제공자·명시적으로 작성한 답변이 필요합니다. 템플릿 빈칸은 자동 보충하지 않습니다.');
  return answer;
}
export function followupRequest(record, assistantText, answer) {
  requireThat(record?.turn === 1 && record.messages?.length === 2, '원래의 첫 요청에 대해서만 한 번 후속을 조립합니다.');
  const initial = JSON.parse(record.messages[1].content);
  const c = validateCase(initial.case);
  requireThat(isDeepStrictEqual(record, initialRequest(c, record.promptId)), '원본 요청과 현재 묶음의 조립 결과가 다릅니다. 원본을 확인하세요.');
  requireThat(nonempty(assistantText), '실제 assistant 응답 원문이 필요합니다.');
  // No fence stripping, JSON repair, synthesized answer, or retry.
  const previous = validateResponse(JSON.parse(assistantText), c);
  validateAnswer(answer, c);
  requireThat(nonempty(previous.decision.question) && answer.inReplyTo === previous.decision.question,
    'inReplyTo는 실제 첫 응답의 decision.question 원문과 같아야 합니다.');
  return {
    requestId: `${record.caseId}.${record.promptId}.t2`, caseId: record.caseId, promptId: record.promptId,
    turn: 2, parentRequestId: record.requestId,
    messages: [...record.messages, { role: 'assistant', content: assistantText },
      { role: 'user', content: JSON.stringify({ turn: 'followup', answer }, null, 2) }]
  };
}
function writeJsonl(path, records) {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(path, records.map(x => JSON.stringify(x)).join('\n') + '\n', { encoding: 'utf8', flag: 'wx' });
}
function main() {
  const { values: v, positionals } = parseArgs({ allowPositionals: true, strict: true,
    options: Object.fromEntries(['cases', 'out', 'requests', 'id', 'assistant', 'answer'].map(k => [k, { type: 'string' }])) });
  const [mode] = positionals;
  requireThat(positionals.length === 1 && v.out && ['initial', 'followup'].includes(mode),
    '사용: node scripts/assemble.mjs initial --cases FILE --out NEW.jsonl\n' +
    '또는: node scripts/assemble.mjs followup --requests FIRST.jsonl --id REQUEST_ID --assistant RAW.txt --answer ANSWER.json --out NEW.jsonl');
  let records;
  if (mode === 'initial') {
    requireThat(v.cases && !v.requests && !v.id && !v.assistant && !v.answer, 'initial에는 --cases와 --out만 지정하세요.');
    records = buildBatch(json(v.cases));
  } else {
    requireThat(v.requests && v.id && v.assistant && v.answer && !v.cases, 'followup의 필수 파일과 --id를 지정하세요.');
    const matches = read(v.requests).split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line)).filter(r => r.requestId === v.id);
    requireThat(matches.length === 1, 'requestId는 요청 파일에서 정확히 한 번 나와야 합니다.');
    records = [followupRequest(matches[0], read(v.assistant), json(v.answer))];
  }
  writeJsonl(v.out, records);
  console.log(`${records.length}개 요청 조립: ${v.out} (API 호출 없음)`);
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { main(); } catch (error) {
    console.error(`조립 실패: ${error.message}\n기존 파일은 덮어쓰지 않습니다. 원문·실패 기록을 보존하세요.`);
    process.exitCode = 1;
  }
}
