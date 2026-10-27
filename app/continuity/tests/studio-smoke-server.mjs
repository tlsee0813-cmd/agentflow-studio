// Test-only server: the real local app and studio handler, with the DeepSeek transport replaced by a stub.
// STUDIO_STUB=ok answers with a fixed, clearly synthetic reply (a return reading too, see digestStub); fail returns HTTP 500 first, then ok; nokey runs without a key; code also requires an access code.
// It never reads a real key; the key passed to the handler is a fixed placeholder that the stub checks is sent server-side.
import { createContinuityApp } from '../server/app.mjs';
import { createStudioHandler } from '../server/studio.mjs';
import { readConfig } from '../../server/config.mjs';
const mode = process.env.STUDIO_STUB ?? 'ok';
let calls = 0;
const stub = async (url, init) => {
  calls++;
  if (url !== 'https://api.deepseek.com/chat/completions' || init.headers.Authorization !== 'Bearer stub-key') return new Response('{}', { status: 401 });
  if (mode === 'fail' && calls === 1) return new Response('{}', { status: 500 });
  const input = JSON.parse(JSON.parse(init.body).messages[1].content.replace(/^[^\n]*\n/, ''));
  if (input.schemaVersion === 'studio.digest.1' || input.schemaVersion === 'studio.digest.2') return digestStub(input);
  const refs = input.records.slice(0, 2).map(r => r.ref);
  const content = { headline: `[스텁 응답] ${input.part.name} 정리`, situation: [`스텁: ${input.part.name}의 기록 ${input.records.length}개를 받았습니다.`],
    changes: input.current.changes.slice(0, 2), next: ['스텁: 다음 판단 예시'], answer: input.intent === 'question' ? `스텁 답변: ${input.question}` : null, refs };
  return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }] }), { status: 200 });
};
// Return reading: a reply built mechanically from the request, labelled as a stub in every sentence (layout and boundary
// checks only; never a model's reading). Changes cite the newest outcome sources that name a part; without outcome material
// there is no change, only what the material cannot say.
const OUTCOME = ['authored', 'report', 'code', 'test', 'review', 'result'];
function digestStub(input) {
  const outcome = input.sources.filter(s => OUTCOME.includes(s.kind) && s.partIds.length).slice(-3).reverse();
  const changes = outcome.map(s => ({ text: `[스텁 응답] ‘${s.title}’ 자료를 근거로 한 변화 문장 자리입니다. 실제 모델의 정리가 아니며 화면 배치와 근거 연결만 확인합니다.`, partIds: s.partIds.slice(0, 1), refs: [s.id] }));
  const first = changes[0] ?? (input.sources.find(s => s.partIds.length) ? { partIds: input.sources.find(s => s.partIds.length).partIds.slice(0, 1), refs: [input.sources.find(s => s.partIds.length).id] } : null);
  const review = input.sources.find(s => s.kind === 'review' && s.partIds.length);
  const content = { changes, read: first ? { partId: first.partIds[0], why: '[스텁 응답] 첫 근거가 다루는 부분입니다.', refs: first.refs } : null,
    open: review && input.sources.length >= 8 ? [{ text: '[스텁 응답] 정할 것 자리입니다. 실제 판단 항목이 아닙니다.', partIds: review.partIds.slice(0, 1), refs: [review.id] }] : [],
    notCovered: changes.length ? [] : ['[스텁 응답] 돌아온 결과 자료가 없어 반영 여부를 말할 수 없습니다.'] };
  if (input.schemaVersion === 'studio.digest.2') {
    const records = recordStub(input);
    Object.assign(content, { recordReadings: records, notCovered: changes.length || records.length ? [] : content.notCovered });
  }
  return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }] }), { status: 200 });
}
// digest.2: up to three readings of the newest record, each quoting one of its own lines as sent; a part is a candidate only
// when its file stem (10-mqtt.js -> mqtt) appears in that line. Mechanical and labelled: layout and round trips only.
function recordStub(input) {
  const rec = input.sources.find(s => s.kind === 'record'); if (!rec) return [];
  const lines = rec.text.split('\n').map(l => l.trim()).filter(l => l.length >= 12).map(l => l.slice(0, 160).trim());
  const stem = name => name.replace(/\.[a-z]+$/i, '').replace(/^[\d-]+/, '').toLowerCase();
  const kinds = ['change', 'check', 'open'];
  return lines.filter((l, i) => i === 0 || /pass|pending|lint|test|정해|확인|바꿨/i.test(l)).slice(0, 3).map((line, i) => {
    const part = input.parts.find(p => stem(p.name).length >= 3 && line.toLowerCase().includes(stem(p.name)));
    return { kind: kinds[i], text: `[스텁 응답] 붙여넣은 기록의 ${i + 1}번째 읽기 자리입니다. 실제 모델의 읽기가 아닙니다.`, ref: rec.id, quote: line,
      related: part ? [{ partId: part.id, quote: line, why: '[스텁] 파일 이름이 원문에 있음' }] : [] };
  });
}
const env = mode === 'nokey' ? {} : { DEEPSEEK_API_KEY: 'stub-key', DEEPSEEK_MODEL: 'stub-model', ...(mode === 'code' ? { STUDIO_ACCESS_CODE: 'smoke-code' } : {}) };
const studio = createStudioHandler({ env, fetchImpl: stub });
const config = readConfig({ AI_MODE: 'mock', PORT: process.env.PORT ?? '0' });
createContinuityApp({ config, studio }).listen(config.port, '127.0.0.1', function () { console.log(`READY http://127.0.0.1:${this.address().port}`); });
