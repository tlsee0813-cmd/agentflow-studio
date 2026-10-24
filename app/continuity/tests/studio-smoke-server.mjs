// Test-only server: the real local app and studio handler, with the DeepSeek transport replaced by a stub.
// STUDIO_STUB=ok answers with a fixed, clearly synthetic reply; fail returns HTTP 500 first, then ok; nokey runs without a key; code also requires an access code.
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
  const refs = input.records.slice(0, 2).map(r => r.ref);
  const content = { headline: `[스텁 응답] ${input.part.name} 정리`, situation: [`스텁: ${input.part.name}의 기록 ${input.records.length}개를 받았습니다.`],
    changes: input.current.changes.slice(0, 2), next: ['스텁: 다음 판단 예시'], answer: input.intent === 'question' ? `스텁 답변: ${input.question}` : null, refs };
  return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }] }), { status: 200 });
};
const env = mode === 'nokey' ? {} : { DEEPSEEK_API_KEY: 'stub-key', DEEPSEEK_MODEL: 'stub-model', ...(mode === 'code' ? { STUDIO_ACCESS_CODE: 'smoke-code' } : {}) };
const studio = createStudioHandler({ env, fetchImpl: stub });
const config = readConfig({ AI_MODE: 'mock', PORT: process.env.PORT ?? '0' });
createContinuityApp({ config, studio }).listen(config.port, '127.0.0.1', function () { console.log(`READY http://127.0.0.1:${this.address().port}`); });
