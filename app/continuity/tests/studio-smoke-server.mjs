// Test-only server: the real local app and studio handler, with the DeepSeek transport replaced by a stub.
// STUDIO_STUB=ok answers with a fixed, clearly synthetic reply (a return reading too, see digestStub); fail returns HTTP 500 first, then ok; nokey runs without a key; code also requires an access code.
// It never reads a real key; the key passed to the handler is a fixed placeholder that the stub checks is sent server-side.
import { createContinuityApp } from '../server/app.mjs';
import { createStudioHandler } from '../server/studio.mjs';
import { readConfig } from '../../server/config.mjs';
import { openMapJobs } from '../server/map-jobs.mjs';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const mode = process.env.STUDIO_STUB ?? 'ok';
let calls = 0;
// AF100: STUDIO_JOBS_DIR keeps map readings as durable jobs (as the local server does). STUDIO_STUB_GATE (a folder) holds each
// map call: the stub writes called-<n> when the call reaches it and answers only once release-<n> exists (or the call is aborted),
// so a test counts provider calls and decides when each answers without timing guesses.
const gate = process.env.STUDIO_STUB_GATE ?? null;
let mapCalls = 0;
async function held(signal) {
  const n = ++mapCalls; writeFileSync(join(gate, `called-${n}`), String(Date.now()));
  while (!existsSync(join(gate, `release-${n}`))) {
    if (signal?.aborted) { writeFileSync(join(gate, `aborted-${n}`), ''); throw new DOMException('aborted', 'AbortError'); }
    await new Promise(r => setTimeout(r, 25));
  }
}
const stub = async (url, init) => {
  calls++;
  if (url !== 'https://api.deepseek.com/chat/completions' || init.headers.Authorization !== 'Bearer stub-key') return new Response('{}', { status: 401 });
  if (mode === 'fail' && calls === 1) return new Response('{}', { status: 500 });
  const input = JSON.parse(JSON.parse(init.body).messages[1].content.replace(/^[^\n]*\n/, ''));
  if (input.schemaVersion === 'studio.digest.1' || input.schemaVersion === 'studio.digest.2') return digestStub(input);
  if (['studio.map.1', 'studio.map.2', 'studio.map.3'].includes(input.schemaVersion)) return mapStub(input);
  if (['studio.map.4', 'studio.map.5', 'studio.map.6'].includes(input.schemaVersion)) { if (gate) await held(init.signal); return map4Stub(input); }
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
// when the line names it with its parent, or its file stem (10-mqtt.js -> mqtt) appears in that line. Mechanical and labelled: layout and round trips only.
function recordStub(input) {
  const rec = input.sources.find(s => s.kind === 'record'); if (!rec) return [];
  const lines = rec.text.split('\n').map(l => l.trim()).filter(l => l.length >= 12).map(l => l.slice(0, 160).trim());
  const stem = name => name.replace(/\.[a-z]+$/i, '').replace(/^[\d-]+/, '').toLowerCase();
  const kinds = ['change', 'check', 'open'];
  return lines.filter((l, i) => i === 0 || /pass|pending|lint|test|정해|확인|바꿨/i.test(l)).slice(0, 3).map((line, i) => {
    // A part named in the line together with its parent (same-named parts told apart), else a file stem in the line.
    const parent = p => input.parts.find(q => q.id === p.parentId);
    const part = input.parts.find(p => p.parentId && line.includes(p.name) && line.includes(parent(p)?.name ?? '\u0000'))
      ?? input.parts.find(p => stem(p.name).length >= 3 && line.toLowerCase().includes(stem(p.name)));
    return { kind: kinds[i], text: `[스텁 응답] 붙여넣은 기록의 ${i + 1}번째 읽기 자리입니다. 실제 모델의 읽기가 아닙니다.`, ref: rec.id, quote: line,
      related: part ? [{ partId: part.id, quote: line, why: part.parentId && line.includes(part.name) ? '[스텁] 원문 줄에 이 부분과 부모 이름이 있음' : '[스텁] 파일 이름이 원문에 있음' }] : [] };
  });
}
// Map reading: mechanical and labelled. On an empty map, one part per labelled line of the newest record ('요구:', '작업 보고:',
// '구상:'), each quoting its own line; on a map, the first part gets one claim quoting the record's first such line. A record
// with no such line (a greeting) gives no part and one gap. Layout and round trips only, never a model's reading.
function mapStub(input) {
  const rec = input.records[0], lines = rec.text.split('\n').map(l => l.trim()).filter(l => /^(요구|작업 보고|구상):/.test(l));
  const quote = l => l.slice(0, 90).trim(), kind = l => l.startsWith('요구') ? 'want' : l.startsWith('구상') ? 'idea' : 'reported';
  const claim = l => ({ kind: kind(l), text: `[스텁] ${quote(l).slice(0, 40)}`, record: rec.id, quote: quote(l), about: null, replaces: null });
  let content;
  if (!lines.length) content = { summary: '', parts: [], relations: [], candidates: [], gaps: ['[스텁] 프로그램을 말하는 기록을 붙여 주세요.'] };
  else if (!input.parts.length) content = { summary: '[스텁] 기록의 요구·보고·구상 줄을 부분으로 놓은 자리예요.', relations: [], candidates: [], gaps: [],
    parts: lines.slice(0, 3).map((l, i) => ({ ref: `new:p${i}`, name: `스텁 부분 ${i + 1}`, parent: null, role: `[스텁] ${i + 1}번째 줄에 근거한 자리`, roleAbout: null, roleReplaces: null, basis: [{ record: rec.id, quote: quote(l) }], claims: [claim(l)] })) };
  else content = { summary: '[스텁] 새 기록의 첫 줄을 첫 부분에 붙인 자리예요.', relations: [], candidates: [], gaps: [],
    parts: [{ ref: input.parts[0].id, name: null, parent: null, role: null, roleAbout: null, roleReplaces: null, basis: [], claims: [claim(lines[0])] }] };
  if (input.schemaVersion !== 'studio.map.1') content.matches = [];
  return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }] }), { status: 200 });
}
// studio.map.4: the same mechanical reading, citing the span.2 piece each labelled line begins (never a copied quote).
function map4Stub(input) {
  const rec = input.records[0], pieces = rec.spans.filter(x => /^(요구|작업 보고|구상):/.test(x.t.trim()));
  const kind = t => t.startsWith('요구') ? 'want' : t.startsWith('구상') ? 'idea' : 'reported';
  let keys = 0; // map.6: every claim names its statement with a key unique in the reply.
  const claim = x => ({ kind: kind(x.t.trim()), text: `[스텁] ${x.t.trim().slice(0, 40)}`, at: x.s, about: null, replaces: null, ...(input.schemaVersion === 'studio.map.6' ? { key: `s${++keys}` } : {}) });
  let content;
  if (!pieces.length) content = { summary: '', parts: [], relations: [], candidates: [], gaps: ['[스텁] 프로그램을 말하는 기록을 붙여 주세요.'] };
  else if (!input.parts.length) content = { summary: '[스텁] 기록의 요구·보고·구상 줄을 부분으로 놓은 자리예요.', relations: [], candidates: [], gaps: [],
    parts: pieces.slice(0, 3).map((x, i) => ({ ref: `new:p${i}`, name: `스텁 부분 ${i + 1}`, parent: null, role: `[스텁] ${i + 1}번째 줄에 근거한 자리`, roleAbout: null, roleReplaces: null, basis: [x.s], claims: [claim(x)] })) };
  else content = { summary: '[스텁] 새 기록의 첫 줄을 첫 부분에 붙인 자리예요.', relations: [], candidates: [], gaps: [],
    parts: [{ ref: input.parts[0].id, name: null, parent: null, role: null, roleAbout: null, roleReplaces: null, basis: [], claims: [claim(pieces[0])] }] };
  Object.assign(content, { matches: [], material: [] });
  return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }] }), { status: 200 });
}
// The browser suite shares this stub process across many flows and can make >10 calls in a minute on a fast CI runner.
// Only this simulated-provider fixture gets a higher rate; the real server's default remains 10/minute.
const env = mode === 'nokey' ? {} : { DEEPSEEK_API_KEY: 'stub-key', DEEPSEEK_MODEL: 'stub-model', STUDIO_REQUESTS_PER_MINUTE: '120', ...(mode === 'code' ? { STUDIO_ACCESS_CODE: 'smoke-code' } : {}) };
const jobs = process.env.STUDIO_JOBS_DIR ? await openMapJobs({ dir: process.env.STUDIO_JOBS_DIR }) : null;
const studio = createStudioHandler({ env, fetchImpl: stub, jobs });
const config = readConfig({ AI_MODE: 'mock', PORT: process.env.PORT ?? '0' });
createContinuityApp({ config, studio }).listen(config.port, '127.0.0.1', function () { console.log(`READY http://127.0.0.1:${this.address().port}${jobs ? ` jobs=${jobs.describe().durable ? 'durable' : jobs.describe().problem}` : ''}`); });
