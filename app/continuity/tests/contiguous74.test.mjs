// Contract tests with written replies and an in-memory provider transport; no model calls or reading-quality claims.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as S from '../dist/public/shared/evidence-span.js';
import { studioView } from '../dist/public/shared/studio.js';
import { serializeBackup, serializeProject } from '../dist/public/shared/storage.js';
import { parseProject, parseBackup } from '../dist/public/shared/validation.js';
import { askMap, aiStatus } from '../dist/public/client/studio-api.js';
import { createMapRun } from '../dist/public/client/map-run.js';
import { createStudioHandler, mapPromptId } from '../server/studio.mjs';
import { MAP4_PROMPT, MAP4_FIRST_PROMPT, MAP5_PROMPT, MAP5_FIRST_PROMPT, map5Prompt } from '../server/map-prompt.mjs';

const BOARD = '`reel board`_ is a evaluation board based on the Nordic Semiconductor\nnRF52840 SoC. The board was developed by PHYTEC Messtechnik GmbH in\ncooperation with Zephyr Project for the Hackathon - "Get Connected".';
const setup = (text = BOARD, version = M.MAP5_SCHEMA) => {
  const p = D.pasteRecord(D.createProject(), text, null).project;
  return { p, inp: M.buildMapAsk(p, studioView(p), [], undefined, version) };
};
const empty = () => ({ summary: '', parts: [], relations: [], candidates: [], gaps: [], matches: [], material: [] });
const wire = at => ({ ...empty(), parts: [{ ref: 'new:a', name: '평가 보드', parent: null, role: '보드를 설명한다.', roleAbout: null, roleReplaces: null, basis: [at], claims: [] }] });
const fullRef = inp => `N01.01-${String(inp.ask.records[0].spans.length).padStart(2, '0')}`;
const meta = (id = 'R_contiguous74', prompt = 'm5-000000000000') => ({ id, at: new Date().toISOString(), model: 'stub', prompt, hash: 'e'.repeat(64) });
const refused = fn => assert.throws(fn, /INVALID_RESPONSE/);
const provider = value => async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }] }));

test('74-N1 exact 206-unit four-piece source is accepted only by map.5; span.2 and old map.4 stay unchanged', () => {
  const { p, inp } = setup(); assert.equal(BOARD.length, 206); assert.equal(inp.ask.records[0].spans.length, 4);
  assert.equal(S.SPAN_INDEX, 'span.2'); assert.equal(M.validateMapAsk(inp.ask).schemaVersion, M.MAP5_SCHEMA);
  const r = M.validateMapReply(wire(fullRef(inp)), inp.ask), q = r.parts[0].basis[0];
  assert.deepEqual(q, { record: 'N01', quote: BOARD, from: 0, to: 206 });
  const old = M.buildMapAsk(p, studioView(p), [], undefined, true);
  assert.equal(old.ask.schemaVersion, M.MAP4_SCHEMA); assert.deepEqual(old.ask.records, inp.ask.records);
  refused(() => M.validateMapReply(wire(fullRef(old)), old.ask));
  assert.equal(S.resolveRef(fullRef(inp), 'N01', BOARD, S.indexSpans(BOARD)), null);
});

test('74-N2 blank lines in 315-unit code and paragraph counts are not evidence boundaries in map.5', () => {
  const start = 'mma8652fc@1d {\n        compatible = "nxp,mma8652fc";\n        reg = <0x1d>;\n    };\n\n';
  const end = '\n    ti_hdc@43 {\n        compatible = "ti,hdc";\n        reg = <0x43>;\n    };';
  const text = start + '    // ' + 'sensor configuration '.repeat(10).slice(0, 315 - start.length - end.length - 7) + end;
  assert.equal(text.length, 315);
  const { inp } = setup(text), ref = fullRef(inp), spans = S.indexSpans(text);
  assert.ok(spans.at(-1).para > spans[0].para);
  const q = M.validateMapReply(wire(ref), inp.ask).parts[0].basis[0];
  assert.equal(q.quote, text.slice(spans[0].from, spans.at(-1).to)); assert.equal(q.quote.length, 315); assert.ok(q.quote.includes('\n\n'));
  const old = setup(text, true).inp; refused(() => M.validateMapReply(wire(ref), old.ask));
});

test('74-N3 600 UTF-16 including gaps is exact; 601, missing/reversed/noncontiguous/cross-record endpoints never clip or repair', () => {
  for (const size of [600, 601]) {
    const text = '😀' + 'x'.repeat(size - 2), { inp } = setup(text), ref = fullRef(inp);
    assert.equal(text.length, size);
    if (size === 600) assert.equal(M.validateMapReply(wire(ref), inp.ask).parts[0].basis[0].quote, text);
    else refused(() => M.validateMapReply(wire(ref), inp.ask));
  }
  const { inp } = setup();
  for (const at of ['N01.01-99', 'N01.04-01', 'N01.01,N01.04', 'N01.01-02,04', 'N01.01-N02.04', 'N02.01-04', 'N01.001-004', 'N01.01-04 ']) {
    refused(() => M.validateMapReply(wire(at), inp.ask));
  }
  const bad = structuredClone(inp.ask); bad.records[0].spans[0].t += 'changed';
  assert.throws(() => M.validateMapAsk(bad), /INVALID_INPUT/);
});

test('74-N4 any material overlap excludes the whole evidence range, including material longer than 600; no example laundering', () => {
  const text = '프로그램은 자료를 읽는다.\n\n' + '예문 설명. '.repeat(100) + '\n\n프로그램은 결과를 보낸다.';
  const { p, inp } = setup(text), pieces = inp.ask.records[0].spans, last = String(pieces.length).padStart(2, '0');
  const at = 'N01.01-03', response = wire(at);
  response.material = [{ at: `N01.02-${last}`, what: '긴 예문' }];
  const decoded = M.validateMapReply(response, inp.ask);
  assert.ok(decoded.material[0].to - decoded.material[0].from > 600);
  assert.ok(decoded.parts[0].basis[0].from < decoded.material[0].from && decoded.parts[0].basis[0].to > decoded.material[0].from);
  const applied = M.applyReading(p, inp, decoded, meta());
  assert.equal(applied.created.length, 0); assert.equal(applied.reading.parts.length, 0);
  assert.ok(applied.reading.skipped.some(x => x.reason === 'material'));
});

test('74-N5 exact request echo precedes decoding and quote/storage/backup round trip; changed source and decoded coordinates are refused', async () => {
  const { p, inp } = setup(), response = wire(fullRef(inp)); let mode = 'ok';
  const handle = createStudioHandler({ env: { DEEPSEEK_API_KEY: 'test-contiguous-not-real' }, fetchImpl: provider(response) });
  const old = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, init) => {
      const result = await handle(new Request('https://studio.example/api/studio/map', init));
      if (mode === 'ok') return result;
      const data = await result.json();
      if (mode === 'missing') delete data.evidence;
      if (mode === 'wrong-index') data.evidence.index = 'span.3';
      if (mode === 'other-body') data.evidence.ask = S.textDigest(JSON.stringify({ ...inp.ask, project: { ...inp.ask.project, name: 'other' } }));
      return new Response(JSON.stringify(data));
    };
    for (mode of ['missing', 'wrong-index', 'other-body']) await assert.rejects(askMap(inp.ask, new AbortController().signal, ''), /INVALID_RESPONSE/);
    assert.equal(p.readings.length, 0);
    mode = 'ok'; const { reply } = await askMap(inp.ask, new AbortController().signal, '');
    const bad = structuredClone(reply); bad.parts[0].basis[0].to--;
    refused(() => M.applyReading(p, inp, bad, meta()));
    const changed = structuredClone(p); changed.pasted[0].text = BOARD.replace('PHYTEC', 'phytec');
    assert.throws(() => M.applyReading(changed, inp, reply, meta()), /MAP_CHANGED/);
    const applied = M.applyReading(p, inp, reply, meta('R_exact74', await mapPromptId()));
    assert.equal(applied.reading.version, 'map-reading.4'); assert.equal(applied.project.schemaVersion, p.schemaVersion);
    const q = applied.reading.parts[0].basis[0]; assert.equal(q.quote, BOARD); assert.equal(p.pasted[0].text.slice(q.from, q.to), q.quote);
    assert.equal(applied.reading.records[0].digest, S.textDigest(BOARD));
    assert.deepEqual(parseProject(serializeProject(applied.project)), applied.project);
    assert.deepEqual(parseBackup(serializeBackup(applied.project)).project, applied.project);
    assert.equal(p.readings.length, 0);
  } finally { globalThis.fetch = old; }
});

test('74-N6 client selects map.5 only with exact m5 capability, keeps m4 wire for old server and does not replay failed responses', async () => {
  const { p } = setup(), old = globalThis.fetch;
  try {
    for (const [prompt, schema] of [['m5-0123456789ab', M.MAP5_SCHEMA], ['m4-0123456789ab', M.MAP4_SCHEMA], ['m3-0123456789ab', M.MAP_SCHEMA], ['m5-bad', M.MAP_SCHEMA]]) {
      let calls = 0, saves = 0;
      const status = { ai: 'deepseek', model: 'stub', map: { model: 'stub', prompt } };
      const run = createMapRun({ current: () => ({ key: 'e', kind: 'saved', project: p, view: studioView(p) }), status: () => status,
        accessCode: () => '', commit: async () => { saves++; return null; }, done: () => {}, changed: () => {} });
      assert.equal(run.input().ask.schemaVersion, schema);
      globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ error: { code: 'INVALID_RESPONSE' } }), { status: 502 }); };
      await run.run(); assert.equal(calls, 1); assert.equal(saves, 0); assert.equal(p.readings.length, 0); assert.ok(run.state().error);
      status.map.prompt = 'm5-aaaaaaaaaaaa'; run.input(); assert.equal(calls, 1); assert.equal(saves, 0);
    }
    const h = createStudioHandler({ env: { DEEPSEEK_API_KEY: 'test-status-not-real' }, fetchImpl: async () => { throw new Error('never called'); } });
    globalThis.fetch = async () => h(new Request('https://studio.example/api/studio/status'));
    assert.equal((await aiStatus()).map.prompt, await mapPromptId());
  } finally { globalThis.fetch = old; }
});

test('74-N7 old map.4 prompt/limits remain, map.5 keeps first/later recipe with neutral first-map example and range/material distinction', async () => {
  const { inp } = setup();
  assert.equal(map5Prompt(inp.ask), MAP5_FIRST_PROMPT);
  assert.equal(map5Prompt({ ...inp.ask, parts: [{ id: 'P01' }] }), MAP5_PROMPT);
  assert.equal(map5Prompt({ ...inp.ask, requests: [{ id: 'RQ_a' }] }), MAP5_PROMPT);
  assert.equal(map5Prompt({ ...inp.ask, priors: [{ key: 'M01' }] }), MAP5_PROMPT);
  for (const prompt of [MAP5_PROMPT, MAP5_FIRST_PROMPT]) {
    assert.match(prompt, /600 UTF-16/); assert.match(prompt, /조금이라도 겹치면/); assert.match(prompt, /별개인 긴 연속 범위/);
    assert.doesNotMatch(prompt, /같은 문단에서 바로 이어지는 두 구간|빈 줄\(줄바꿈 두 번\)로 끝나면/);
  }
  assert.doesNotMatch(MAP5_FIRST_PROMPT, /new:eval|new:parse|new:run/); assert.match(MAP5_FIRST_PROMPT, /new:a/);
  for (const prompt of [MAP4_PROMPT, MAP4_FIRST_PROMPT]) assert.match(prompt, /같은 문단에서 바로 이어지는 두 구간/);
  const old = setup(BOARD, true).inp; let chosen;
  const handle = createStudioHandler({ env: { DEEPSEEK_API_KEY: 'test-prompt-not-real' }, fetchImpl: async (_url, init) => {
    chosen = JSON.parse(init.body).messages[0].content; return provider(wire(fullRef(inp)))();
  } });
  const post = ask => handle(new Request('https://studio.example/api/studio/map', { method: 'POST', headers: { 'content-type': 'application/json', 'x-agentflow-request': '1' }, body: JSON.stringify(ask) }));
  assert.equal((await post(old.ask)).status, 502); assert.equal(chosen, MAP4_FIRST_PROMPT);
  assert.equal((await post(inp.ask)).status, 200); assert.equal(chosen, MAP5_FIRST_PROMPT);
});

test('74-N8 a subsequent map.5 reading leaves stored map.4 quotes/coordinates untouched; key-like model text remains refused', () => {
  const { p, inp } = setup(BOARD, true);
  const before = M.applyReading(p, inp, M.validateMapReply(wire('N01.01-02'), inp.ask), meta('R_old74', 'm4-000000000000'));
  const saved = JSON.stringify(before.reading);
  const next = D.pasteRecord(before.project, BOARD + '\n\nThis describes a later revision.', null).project;
  const input = M.buildMapAsk(next, studioView(next), [], undefined, M.MAP5_SCHEMA);
  const response = empty();
  response.parts = [{ ref: 'P01', name: null, parent: null, role: null, roleAbout: null, roleReplaces: null, basis: [],
    claims: [{ kind: 'describes', text: '새 기록의 보드 설명', at: 'N01.01-04', about: null, replaces: null }] }];
  const bad = structuredClone(response); bad.parts[0].claims[0].text = 'sk-' + 'a'.repeat(40);
  refused(() => M.validateMapReply(bad, input.ask));
  const after = M.applyReading(next, input, M.validateMapReply(response, input.ask), { ...meta('R_new74'), hash: 'f'.repeat(64) });
  assert.equal(JSON.stringify(after.project.readings[0]), saved);
  assert.equal(after.reading.parts[0].claims[0].quote, BOARD);
  assert.deepEqual(parseProject(serializeProject(after.project)), after.project);
});
