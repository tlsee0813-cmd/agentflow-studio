// Offline request builder and response checker. No provider client, keys or retries.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs, isDeepStrictEqual } from 'node:util';
import { need, nonempty, exactKeys, validateCase, validateCases, validateAnswer, validateText } from './validate.mjs';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(path, 'utf8');
const json = path => JSON.parse(read(path));
const contract = read(resolve(ROOT, 'contracts/OUTPUT_CONTRACT.md')).trim();
const strategies = Object.fromEntries(['baseline', 'enhanced'].map(id => [id, read(resolve(ROOT, `prompts/${id}.md`)).trim()]));
export function initialRequest(c, promptId) {
  validateCase(c);
  need(Object.hasOwn(strategies, promptId), 'promptId는 baseline/enhanced만 허용');
  return {
    requestId: `IDEA014.${c.caseId}.${promptId}.t1`, caseId: c.caseId, promptId, turn: 1, parentRequestId: null,
    messages: [
      { role: 'system', content: `${strategies[promptId]}\n\n${contract}` },
      { role: 'user', content: JSON.stringify({ turn: 'initial', case: c }, null, 2) }
    ]
  };
}
export function buildBatch(cases) {
  validateCases(cases);
  // Alternate first variant, but never share conversation state between variants.
  return cases.flatMap((c, i) => (i % 2 ? ['enhanced', 'baseline'] : ['baseline', 'enhanced']).map(id => initialRequest(c, id)));
}
function firstFromRecord(record) {
  need(record?.messages?.[1]?.role === 'user', '원본 user 메시지 필요');
  const payload = JSON.parse(record.messages[1].content);
  exactKeys(payload, ['turn', 'case'], 'initial user payload');
  need(payload.turn === 'initial', 'initial payload 필요');
  return initialRequest(validateCase(payload.case), record.promptId);
}
export function followupRequest(record, assistantText, answer) {
  need(record?.turn === 1 && record.messages?.length === 2, '첫 요청에 대해서만 한 번 후속 조립');
  need(isDeepStrictEqual(record, firstFromRecord(record)), '원본 요청과 이 묶음의 조립 결과가 다름');
  const c = JSON.parse(record.messages[1].content).case;
  need(nonempty(assistantText), '실제 assistant 문자열 필요');
  const previous = validateText(assistantText, c); // Never repair or remove fences.
  validateAnswer(answer, c);
  need(nonempty(previous.decision.question) && answer.inReplyTo === previous.decision.question, 'inReplyTo는 실제 첫 질문 원문과 같아야 함');
  return {
    requestId: `IDEA014.${record.caseId}.${record.promptId}.t2`, caseId: record.caseId, promptId: record.promptId,
    turn: 2, parentRequestId: record.requestId,
    messages: [...record.messages, { role: 'assistant', content: assistantText },
      { role: 'user', content: JSON.stringify({ turn: 'followup', answer }, null, 2) }]
  };
}
export function requestContext(record) {
  const first = firstFromRecord(record);
  const c = JSON.parse(first.messages[1].content).case;
  if (record.turn === 1) {
    need(isDeepStrictEqual(record, first), '원본 첫 요청 불일치');
    return { c, answer: null };
  }
  need(record.turn === 2 && record.messages?.length === 4, '지원하는 대화는 첫 요청과 한 번의 후속뿐');
  const payload = JSON.parse(record.messages[3].content);
  exactKeys(payload, ['turn', 'answer'], 'followup user payload');
  need(payload.turn === 'followup', 'followup payload 필요');
  need(isDeepStrictEqual(record, followupRequest(first, record.messages[2].content, payload.answer)), '원본 후속 요청 불일치');
  return { c, answer: payload.answer };
}
export function checkRecord(record, raw) {
  try {
    const { c, answer } = requestContext(record);
    validateText(raw, c, answer);
    return { requestId: record.requestId, contractVersion: 'idea014.v2', status: 'pass', error: null, meaningReview: 'not_performed' };
  } catch (error) {
    return { requestId: record?.requestId ?? null, contractVersion: 'idea014.v2', status: 'failed', error: error.message, meaningReview: 'not_performed' };
  }
}
function getRecord(path, id) {
  const records = read(path).split(/\r?\n/).filter(x => x.trim()).map(x => JSON.parse(x)).filter(r => r.requestId === id);
  need(records.length === 1, 'requestId가 요청 파일에 정확히 한 번 있어야 함');
  return records[0];
}
function writeNew(path, text) {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(path, text, { encoding: 'utf8', flag: 'wx' }); // Refuse any overwrite.
}
function main() {
  const { values: v, positionals } = parseArgs({ strict: true, allowPositionals: true, options: {
    cases: { type: 'string', multiple: true },
    ...Object.fromEntries(['out', 'requests', 'id', 'assistant', 'answer'].map(k => [k, { type: 'string' }]))
  }});
  const mode = positionals[0];
  need(positionals.length === 1 && v.out && ['initial', 'followup', 'check'].includes(mode),
    '사용: initial --cases FILE [--cases FILE] --out NEW.jsonl\n' +
    'followup --requests FILE --id ID --assistant RAW.txt --answer ANSWER.json --out NEW.jsonl\n' +
    'check --requests FILE --id ID --assistant RAW.txt --out NEW-check.json');
  if (mode === 'initial') {
    need(v.cases?.length && !v.requests && !v.id && !v.assistant && !v.answer, 'initial 옵션 오류');
    const sets = v.cases.map(path => validateCases(json(path)));
    const batch = buildBatch(sets.flat());
    writeNew(v.out, batch.map(x => JSON.stringify(x)).join('\n') + '\n');
    console.log(`${batch.length}개 요청 조립 (호출 없음): ${v.out}`);
    return;
  }
  need(v.requests && v.id && v.assistant && !v.cases, 'requests/id/assistant 필요');
  const record = getRecord(v.requests, v.id);
  const raw = read(v.assistant);
  if (mode === 'followup') {
    need(v.answer, '명시적 answer 파일 필요');
    writeNew(v.out, JSON.stringify(followupRequest(record, raw, json(v.answer))) + '\n');
    console.log(`후속 요청 1개 조립 (호출 없음): ${v.out}`);
  } else {
    need(!v.answer, 'check는 요청 안의 answer를 사용; 별도 답변 주입 금지');
    const report = checkRecord(record, raw);
    writeNew(v.out, JSON.stringify(report, null, 2) + '\n');
    console.log(`${report.status}: ${v.out} (의미 품질 판정 아님)`);
    if (report.status === 'failed') process.exitCode = 1;
  }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { main(); } catch (error) { console.error(`실패: ${error.message}\n기존 파일은 덮지 않으며 자동수선·재시도하지 않습니다.`); process.exitCode = 1; }
}
