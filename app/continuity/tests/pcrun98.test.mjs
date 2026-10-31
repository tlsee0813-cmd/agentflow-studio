// What the first full run on a real PC (this repository's own sessions, a real DeepSeek key) left without an answer or said wrong:
//   1. a map reading and a return reading were refused (cut at the length limit; a reference; map.7's keys), and nothing told why:
//      the reply the server set aside was gone. A local host may now keep it (STUDIO_KEEP_REFUSED), masked, never with the key;
//   2. the handover named none of the change requests made, nor what came back for them, so the next session did not know what it
//      had been asked.
// Controlled fetch only: no provider is called.
import test from 'node:test';
import assert from 'node:assert/strict';
import { callStudioModel, createStudioHandler } from '../server/studio.mjs';
import * as D from '../dist/public/shared/domain.js';
import { sessionText, stamp } from '../dist/public/shared/session-import.js';
import { handoverText, foldHandover } from '../dist/public/shared/handover.js';

const KEY = 'pcrun98-server-only-key', LEAK = 'sk-proj-abcdefghijklmnopqrstuvwxyz0123456789ABCD';
const reply = (content, finish = 'stop', usage = { prompt_tokens: 21000, completion_tokens: 16384, completion_tokens_details: { reasoning_tokens: 15000 } }) =>
  Response.json({ choices: [{ finish_reason: finish, message: { content: typeof content === 'string' ? content : JSON.stringify(content) } }], usage });
const scopeAsk = () => ({ schemaVersion: 'studio.scope.1', intent: '실패 모아 보기', parts: [{ id: 'P1', name: '결과', note: '', parentId: null }],
  evidence: [{ id: 'E1', kind: 'user', title: '구상', text: '실패한 파일과 이유를 모아 보여 주세요.', basis: '작성 표본' }],
  selected: [{ id: 'I1', title: '실패 모아 보기', description: '실패와 이유를 보여 주세요.', partIds: ['P1'], refs: ['E1'] }], excluded: [] });
const config = { apiKey: KEY, model: 'm', maxTokens: 1200, timeoutMs: 1000, planTimeoutMs: 1000 };

test('PCRUN98-1 a reply the server sets aside is handed to the host that asked: how it ended, what it counted, its text masked', async () => {
  const kept = [];
  const refused = async (what, ask) => { kept.push({ what, ask }); };
  // Cut at the length limit: still the same error, and the host sees it was cut and how much was spent on reasoning.
  await assert.rejects(callStudioModel(scopeAsk(), config, { refused, fetchImpl: async () => reply('{"summary":"반쯤', 'length') }), e => e.code === 'AI_RESPONSE_INCOMPLETE');
  assert.equal(kept.length, 1);
  assert.deepEqual([kept[0].what.schema, kept[0].what.error, kept[0].what.finish, kept[0].what.usage.completion_tokens_details.reasoning_tokens, kept[0].what.content],
    ['studio.scope.1', { code: 'AI_RESPONSE_INCOMPLETE' }, 'length', 15000, '{"summary":"반쯤']);
  assert.deepEqual(kept[0].ask, scopeAsk());
  // Refused by the checks (a key it should not have): the text is kept with key-like strings hidden.
  await assert.rejects(callStudioModel(scopeAsk(), config, { refused, fetchImpl: async () => reply({ summary: `키 ${LEAK}`, extra: 1 }) }), e => e.code === 'INVALID_RESPONSE');
  assert.equal(kept[1].what.error.code, 'INVALID_RESPONSE');
  assert.ok(kept[1].what.content.includes('"extra":1') && !kept[1].what.content.includes(LEAK), kept[1].what.content);
  // A reply that holds the server's own key is kept without its text.
  await assert.rejects(callStudioModel(scopeAsk(), config, { refused, fetchImpl: async () => reply({ summary: KEY }) }), e => e.code === 'INVALID_RESPONSE');
  assert.equal(kept[2].what.content, null);
  assert.ok(!JSON.stringify(kept).includes(KEY));
  // Nothing came back (a provider error, a network failure): nothing to keep. A keeping failure never changes the answer.
  await assert.rejects(callStudioModel(scopeAsk(), config, { refused, fetchImpl: async () => new Response('', { status: 500 }) }));
  assert.equal(kept.length, 3);
  await assert.rejects(callStudioModel(scopeAsk(), config, { refused: async () => { throw new Error('disk full'); }, fetchImpl: async () => reply('{', 'length') }), e => e.code === 'AI_RESPONSE_INCOMPLETE');
  // Without a host that asks, nothing is kept and the call is as before.
  await assert.rejects(callStudioModel(scopeAsk(), config, { fetchImpl: async () => reply('{', 'length') }), e => e.code === 'AI_RESPONSE_INCOMPLETE');
});

test('PCRUN98-1b the handler passes the host\'s keeper to its calls; a limited release takes none', async () => {
  const kept = [];
  const handler = createStudioHandler({ env: { DEEPSEEK_API_KEY: KEY }, refused: async w => { kept.push(w); }, fetchImpl: async () => reply('{"summary":"', 'length') });
  const r = await handler(new Request('https://app.test/api/studio/scope', { method: 'POST', headers: { Origin: 'https://app.test', 'Content-Type': 'application/json', 'X-AgentFlow-Request': '1' }, body: JSON.stringify(scopeAsk()) }));
  assert.equal(r.status, 502); assert.equal((await r.json()).error.code, 'AI_RESPONSE_INCOMPLETE');
  assert.equal(kept.length, 1); assert.equal(kept[0].finish, 'length');
  assert.throws(() => createStudioHandler({ env: { DEEPSEEK_API_KEY: KEY }, policy: 'existing-map', refused: async () => {} }));
});

const AT = '2026-10-31T06:00:00.000Z';
const request = (id, at, intent, items) => ({ version: 'request-scope.1', id, projectId: 'P', planId: 'CP_1', planRevision: 1, createdAt: at, basis: 'b', intent,
  items: items.map(([title, partIds], i) => ({ id: `I${i}`, title, description: title, partIds, sources: [] })) });

test('PCRUN98-2 the handover names the change requests made and what came back for each, as said (not as checked)', () => {
  const S = 'claude-0123456789abcdef01234567';
  let p = D.pasteRecord(D.createProject(), sessionText({ id: S, tool: 'claude', label: '', title: '연결기', cwd: '/w', branch: 'main', startedAt: AT, omitted: 0,
    turns: [{ role: 'user', at: AT, text: '세션 이름 고쳐 줘' }, { role: 'assistant', at: AT, text: '봤어요.' }] }).text, null).project;
  const RQ = 'RQ_1e369d5f-75d7-4197-9533-2295729a24ce';
  // The coding session's report, pasted back with the request named: no reading has matched it yet.
  p = D.pasteRecord(p, `요청문 참조: ${RQ}\n항목: 세션 이름에서 전달 지시 접두어 제거\n- 구현 보고: 아직 바꾸지 않음.`, null).project;
  const requests = [request(RQ, '2026-10-31T15:00:00.000Z', '세션 이름에서 접두어를 빼 주세요.', [['세션 이름에서 전달 지시 접두어 제거', []]])];
  const doc = handoverText(p, { scope: null, code: 'RQS234', at: AT, requests });
  const at = doc.indexOf('## 맡긴 변경 요청');
  assert.ok(at > 0 && at < doc.indexOf('## 최근 흐름'), doc);
  const lines = doc.slice(at).split('\n\n')[0].split('\n');
  assert.deepEqual(lines.slice(1), [
    `- ${RQ} · ${stamp('2026-10-31T15:00:00.000Z', true)} · 세션 이름에서 접두어를 빼 주세요.`,
    '  - 항목: 세션 이름에서 전달 지시 접두어 제거',
    '  - 돌아온 것: 이 요청문을 적은 기록 1개(아직 대조하지 않음)']);
  // None made: no section. A part's document: only the requests with an item on a part in it.
  assert.ok(!handoverText(p, { scope: null, code: 'RQS234', at: AT }).includes('## 맡긴 변경 요청'));
  // Pasted into a new session without its end line, the section stays the document's (the request under it is the person's).
  const folded = foldHandover(`${doc.split('\n').slice(0, -1).join('\n')}\n\n이어서 해 줘`);
  assert.ok(folded.endsWith('\n\n이어서 해 줘') && !folded.includes('맡긴 변경 요청'), folded);
});

/* ---------- 3. a reading refused whole for one quote too long, or one empty list left out (the PC's own replies) ---------- */
import * as M from '../dist/public/shared/map-reading.js';
import { studioView } from '../dist/public/shared/studio.js';

function longAsk() {
  const lines = Array.from({ length: 12 }, (_, i) => `${i + 1}번째 줄: 세션 파싱이 하위 에이전트 파일과 같은 시각 답변을 읽는 방법을 설명해요. ${'자세히 '.repeat(8)}`);
  const p = D.pasteRecord(D.createProject(), lines.join('\n'), null).project, inp = M.buildMapAsk(p, studioView(p), [], undefined, M.MAP6_SCHEMA);
  const r = inp.ask.records[0], ids = r.spans.map(s => s.s), lastNo = ids.at(-1).split('.')[1];
  return { inp, rec: r.id, first: ids[0], second: ids[1], whole: `${r.id}.${ids[0].split('.')[1]}-${lastNo}` };
}
const part = (basis, claims) => ({ ref: 'new:p0', name: '세션 파싱', parent: null, role: '세션 파일을 읽어 요청과 답으로 나눠요.', roleAbout: null, roleReplaces: null, basis, claims });
const claim = (at, key) => ({ kind: 'describes', text: '하위 에이전트 파일도 읽어요.', at, about: null, replaces: null, key });

test('PCRUN98-3 a quote past the bound is kept from its first piece to the last that fits; the rest of the reading stands', () => {
  const { inp, first, second, whole } = longAsk();
  const text = inp.ask.records[0], got = M.validateMapReply({ summary: '연결기', parts: [part([whole, first], [claim(second, 's1'), claim(whole, 's2')])], relations: [], candidates: [], gaps: [], matches: [], material: [] }, inp.ask);
  // PCRUN99: the PC's report reading was refused whole for three quotes of 757–781 letters; now each is the passage cut short.
  assert.deepEqual(got.parts[0].claims.map(c => c.key), ['s1', 's2']);
  const [long, one] = got.parts[0].basis, cut = got.parts[0].claims[1];
  assert.ok(long.quote.length <= 600 && long.quote.length > one.quote.length && long.quote.startsWith(one.quote), long.quote);
  assert.deepEqual([cut.from, cut.to, cut.quote], [long.from, long.to, long.quote]);
  assert.ok(text.spans.map(s => s.t).join('').includes(long.quote.trimEnd()), 'the quote is the record\'s own words');
  // A reference to pieces that are not there is still refused as a reference.
  assert.throws(() => M.validateMapReply({ summary: '연결기', parts: [part([first], [claim('N01.900', 's1')])], relations: [], candidates: [], gaps: [], matches: [], material: [] }, inp.ask), e => e.rule === 'reference');
});

test('PCRUN98-4 an empty list the reply left out (material, gaps, …) is read as empty; summary and parts are still required', () => {
  const { inp, first } = longAsk();
  const full = { summary: '연결기', parts: [part([first], [])], relations: [], candidates: [], gaps: [], matches: [], material: [] };
  const { material: _m, gaps: _g, ...without } = full;
  assert.deepEqual(M.validateMapReply(without, inp.ask), M.validateMapReply(full, inp.ask));
  const { parts: _p, ...noParts } = full;
  assert.throws(() => M.validateMapReply(noParts, inp.ask));
  // PCRUN99: a key it was not asked for (the PC's reply had a claim with "aboutAtAt" beside "aboutAt") is passed over, not kept.
  const extra = M.validateMapReply({ ...full, extra: ['SECRET'], parts: [{ ...part([first], [claim(first, 's1')]), note: 1 }] }, inp.ask);
  assert.ok(!JSON.stringify(extra).includes('SECRET') && !('note' in extra.parts[0]), JSON.stringify(extra));
});

test('PCRUN98-5 a session is not named by a reply of a few letters when a longer request follows', async () => {
  const { sessionName, sessionOrigin } = await import('../dist/public/shared/handover.js');
  const S = 'claude-0123456789abcdef01234567', T = m => new Date(Date.parse(AT) + m * 60000).toISOString();
  const rec = turns => sessionText({ id: S, tool: 'claude', label: '', title: null, cwd: '/w', branch: null, startedAt: AT, omitted: 0, turns }).text;
  const p = D.pasteRecord(D.createProject(), rec([{ role: 'user', at: T(0), text: 'ㅇㅇ' }, { role: 'assistant', at: T(1), text: '네' }, { role: 'user', at: T(2), text: '지도 정리 실패 원인 찾아 줘' }]), null).project;
  assert.equal(sessionName(p, sessionOrigin(p.pasted[0].text)), 'Claude Code 「지도 정리 실패 원인 찾아 줘」');
  const only = D.pasteRecord(D.createProject(), rec([{ role: 'user', at: T(0), text: 'ㅇㅇ' }, { role: 'assistant', at: T(1), text: '네' }]), null).project;
  assert.equal(sessionName(only, sessionOrigin(only.pasted[0].text)), 'Claude Code 「ㅇㅇ」');
});

test('PCRUN98-6 a large map ask is read without reasoning unless STUDIO_MAP_THINKING says otherwise; a small one keeps it', async () => {
  const { readStudioConfig, MAP_THINKING_BYTES } = await import('../server/studio.mjs');
  const ask = n => { const p = D.pasteRecord(D.createProject(), Array.from({ length: n }, (_, i) => `${i + 1}번째 줄: 세션 기록의 한 줄이에요. ${'내용 '.repeat(20)}`).join('\n'), null).project;
    return M.buildMapAsk(p, studioView(p), [], undefined, M.MAP6_SCHEMA).ask; };
  const sent = async (a, env) => { let b; await callStudioModel(a, readStudioConfig({ DEEPSEEK_API_KEY: KEY, ...env }), { fetchImpl: async (u, init) => { b = JSON.parse(init.body); return reply('{', 'length'); } }).catch(() => {}); return b; };
  const small = ask(10), large = ask(400);
  assert.ok(new TextEncoder().encode(JSON.stringify(small)).length < MAP_THINKING_BYTES && new TextEncoder().encode(JSON.stringify(large)).length > MAP_THINKING_BYTES);
  assert.deepEqual([(await sent(small, {})).thinking, (await sent(small, {})).reasoning_effort], [{ type: 'enabled' }, 'low']);
  const big = await sent(large, {});
  assert.deepEqual([big.thinking, big.reasoning_effort, big.max_tokens], [{ type: 'disabled' }, undefined, 16384]);
  assert.deepEqual((await sent(large, { STUDIO_MAP_THINKING: 'enabled' })).thinking, { type: 'enabled' }, 'said outright, it stands');
  assert.deepEqual((await sent(small, { STUDIO_MAP_THINKING: 'disabled' })).thinking, { type: 'disabled' });
});
