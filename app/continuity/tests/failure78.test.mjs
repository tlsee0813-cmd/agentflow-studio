// AF78: why a map reading was not applied. A reply the provider cut by its length limit is incomplete, and one it ended any other
// way is unfinished: neither is read, judged against the evidence rules or applied, and neither is reported as breaking them.
// The provider is a stub (finish reasons written for the test); nothing here calls a model.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import { studioView } from '../dist/public/shared/studio.js';
import { createMapRun } from '../dist/public/client/map-run.js';
import { ERROR_TEXT } from '../dist/public/client/studio-api.js';
import { createStudioHandler, readStudioConfig, mapPromptId } from '../server/studio.mjs';

const KEY = 'test-78-not-real';
const record = '요구: 폴더 안의 마크다운 문서를 한 번에 변환한다.\n변환은 문서마다 PDF 하나를 만든다.';
const project = () => D.pasteRecord(D.createProject(), record, null).project;
const ask6 = p => M.buildMapAsk(p, studioView(p), [], undefined, M.MAP6_SCHEMA).ask;
/** A finished, valid map.6 reply for this ask, and one citing a piece the request never sent. */
const good = ask => ({ summary: '', parts: [{ ref: 'new:conv', name: '문서 변환', parent: null, role: '마크다운 문서를 PDF로 바꾼다.', roleAbout: null, roleReplaces: null, basis: [ask.records[0].spans[0].s],
  claims: [{ kind: 'want', text: '폴더 안 문서를 한 번에 변환하길 원한다', at: ask.records[0].spans[0].s, about: null, replaces: null, key: 's1' }] }], relations: [], candidates: [], gaps: [], matches: [], material: [] });
const illegal = ask => { const r = good(ask); r.parts[0].claims[0].at = 'N01.99'; return r; };
const provider = (finish, content) => new Response(JSON.stringify({ choices: [{ finish_reason: finish, message: { content: typeof content === 'string' ? content : JSON.stringify(content) } }] }));
const post = (handle, ask, signal) => handle(new Request('https://studio.example/api/studio/map', { method: 'POST', headers: { 'content-type': 'application/json', 'x-agentflow-request': '1' }, body: JSON.stringify(ask), ...(signal ? { signal } : {}) }));

test('78-S the server tells a cut reply, an unfinished one, a finished one breaking the evidence rules, a valid one, a timeout and a cancel apart', async () => {
  const p = project(), ask = ask6(p), json = JSON.stringify(good(ask));
  const cases = [
    ['length, even with a whole valid JSON', provider('length', good(ask)), 502, { code: 'AI_RESPONSE_INCOMPLETE' }],
    ['length, cut JSON', provider('length', json.slice(0, json.length - 20)), 502, { code: 'AI_RESPONSE_INCOMPLETE' }],
    ['length, an illegal reference in it', provider('length', illegal(ask)), 502, { code: 'AI_RESPONSE_INCOMPLETE' }],
    ['another finish reason', provider('content_filter', good(ask)), 502, { code: 'AI_RESPONSE_UNFINISHED' }],
    ['no finish reason', provider(undefined, good(ask)), 502, { code: 'AI_RESPONSE_UNFINISHED' }],
    ['stop, an illegal reference', provider('stop', illegal(ask)), 502, { code: 'INVALID_RESPONSE', detail: { path: 'parts[0].claims[0].at', rule: 'reference', target: 'N01.99' } }],
    ['stop, a cut JSON', provider('stop', json.slice(0, 40)), 502, { code: 'INVALID_RESPONSE' }],
  ];
  for (const [why, res, status, error] of cases) {
    let calls = 0;
    const handle = createStudioHandler({ env: { DEEPSEEK_API_KEY: KEY }, fetchImpl: async () => { calls++; return res.clone(); } });
    const out = await post(handle, ask);
    assert.equal(out.status, status, why); assert.deepEqual((await out.json()).error, error, why); assert.equal(calls, 1, `${why}: one call, no retry`);
  }
  const ok = await post(createStudioHandler({ env: { DEEPSEEK_API_KEY: KEY }, fetchImpl: async () => provider('stop', good(ask)) }), ask);
  assert.equal(ok.status, 200); assert.equal((await ok.json()).reply.parts[0].name, '문서 변환');
  // An older wire (map.1) is classified the same way: a cut reply is never read as a quote violation.
  const old = M.buildMapAsk(p, studioView(p)).ask;
  assert.deepEqual((await (await post(createStudioHandler({ env: { DEEPSEEK_API_KEY: KEY }, fetchImpl: async () => provider('length', '{"summary":"') }), old)).json()).error, { code: 'AI_RESPONSE_INCOMPLETE' });
  // Timeout and cancel stay their own.
  const waits = (_u, init) => new Promise((_r, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
  const slow = createStudioHandler({ fetchImpl: waits, config: { ...readStudioConfig({ DEEPSEEK_API_KEY: KEY }), mapTimeoutMs: 20 } });
  const timed = await post(slow, ask); assert.equal(timed.status, 504); assert.deepEqual((await timed.json()).error, { code: 'AI_TIMEOUT' });
  const stop = new AbortController(), pending = post(createStudioHandler({ env: { DEEPSEEK_API_KEY: KEY }, fetchImpl: waits }), ask, stop.signal);
  setTimeout(() => stop.abort(), 5); const cancelled = await pending; assert.equal(cancelled.status, 499); assert.deepEqual((await cancelled.json()).error, { code: 'CANCELLED' });
});

test('78-C a cut reply says the AI did not finish and that the records and the map are kept: nothing saved, nothing marked read, pending cleared', async () => {
  // A map with an earlier reading, then a new record: the cut reply leaves both as they were.
  let p = project(); const first = ask6(p);
  p = M.applyReading(p, M.buildMapAsk(p, studioView(p), [], undefined, M.MAP6_SCHEMA), M.validateMapReply(good(first), first), { id: 'R_f78', at: new Date().toISOString(), model: 'stub', prompt: 'm6-000000000000', hash: 'a'.repeat(64) }).project;
  p = D.pasteRecord(p, '후속 보고: 폴더 입력을 아직 구현하지 않았습니다.', null).project;
  const before = JSON.stringify(p), prompt = await mapPromptId();
  for (const [finish, code] of [['length', 'AI_RESPONSE_INCOMPLETE'], ['content_filter', 'AI_RESPONSE_UNFINISHED']]) {
    const handle = createStudioHandler({ env: { DEEPSEEK_API_KEY: KEY }, fetchImpl: async () => provider(finish, good(ask6(p))) });
    const oldFetch = globalThis.fetch; let commits = 0, done = 0, changed = 0;
    try {
      globalThis.fetch = async (url, o) => handle(new Request(`https://studio.example${url}`, o));
      const run = createMapRun({ current: () => ({ key: 'e', kind: 'saved', project: p, view: studioView(p) }), status: () => ({ ai: 'deepseek', model: 'm', access: 'open', map: { model: 'm', prompt } }), accessCode: () => '',
        commit: async () => { commits++; return null; }, done: () => { done++; }, changed: () => { changed++; } });
      await run.run();
      const error = run.state().error;
      assert.equal(commits, 0, code); assert.equal(done, 0, code); assert.equal(run.state().pending, null, code); assert.ok(changed >= 2, code);
      assert.match(error, finish === 'length' ? /^AI가 응답을 끝내지 못해 지도에 반영하지 않았어요\. 원문과 기존 지도는 그대로예요\.$/ : /^AI 응답이 정상적으로 끝나지 않아/);
      assert.ok(!/근거|인용|형식|토큰|JSON|length/i.test(error), `${code}: no evidence-rule or technical wording`);
    } finally { globalThis.fetch = oldFetch; }
    assert.equal(JSON.stringify(p), before, `${code}: the project, its records and its map are untouched`);
    assert.equal(M.unreadRecords(p, studioView(p)).length, 1, `${code}: the new record still reads as unread`);
  }
});

test('78-F a code a client does not know falls back to its general wording; the other views have plain text for the new codes', async () => {
  const p = project(), oldFetch = globalThis.fetch;
  try {
    // As an older client sees a newer server: an unknown code reads as the run's general failure, records kept.
    globalThis.fetch = async () => new Response(JSON.stringify({ error: { code: 'AI_SOMETHING_NEWER' } }), { status: 502 });
    const run = createMapRun({ current: () => ({ key: 'f', kind: 'saved', project: p, view: studioView(p) }), status: () => ({ ai: 'deepseek', model: 'm', access: 'open', map: { model: 'm', prompt: 'm6-0123456789ab' } }), accessCode: () => '', commit: async () => 'never', done: () => {}, changed: () => {} });
    await run.run(); assert.equal(run.state().error, '지도를 정리하지 못했어요. 기록은 그대로예요.');
  } finally { globalThis.fetch = oldFetch; }
  assert.equal(ERROR_TEXT.AI_RESPONSE_INCOMPLETE, 'AI가 응답을 끝내지 못해 보여 드리지 않았어요.');
  assert.equal(ERROR_TEXT.AI_RESPONSE_UNFINISHED, 'AI 응답이 정상적으로 끝나지 않아 보여 드리지 않았어요.');
});
