import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ApiError } from '../../server/errors.mjs';
import { encodeSpans } from '../dist/public/shared/evidence-span.js';
import { validateMapAsk, validateMapReply } from '../dist/public/shared/map-reading.js';
import { createFirstMapPipeline, PIPELINE_RECIPE, LATER_PIPELINE_RECIPE , PLAN_TIMEOUT_MS, GLOBAL_RULES, FIRST_GLOBAL_RULES, FIRST_FINAL_GLOBAL_RULES, FINAL_GLOBAL_RULES } from '../server/map-pipeline.mjs';
import { openFirstMapPipeline, loadMapPipelineEnv } from '../server/map-pipeline-host.mjs';
import { parseProject } from '../dist/public/shared/validation.js';
import { openMapPipelineStore } from '../server/map-pipeline-store.mjs';
import { callMapProvider } from '../server/map-provider.mjs';
import { map7Prompt } from '../server/map-prompt.mjs';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as C from '../dist/public/shared/change-plan.js';
import * as S from '../dist/public/shared/storage.js';
import { studioView } from '../dist/public/shared/studio.js';
import { emptyBundle } from '../dist/public/client/plan-store.js';
import * as K from './condition116-case.mjs';

const usage = { inputTokens: 10, outputTokens: 10 };
const askFor = () => validateMapAsk({ schemaVersion: 'studio.map.6', project: { name: '자료 흐름', purpose: null }, parts: [], relations: [], requests: [], priors: [],
  records: [
    { id: 'N01', kind: 'pasted', note: '', basis: '앞쪽 기록', ...encodeSpans('N01', '입력기는 프로젝트 문서를 받아 작업 큐에 전달합니다.\n처음에는 모든 자료를 영구 저장한다고 설명했습니다.\n중간 조건: 개발용 판본에만 적용합니다.\n원문 기록은 변경 없이 보존합니다.') },
    { id: 'N02', kind: 'report', note: '', basis: '뒤쪽 정정', ...encodeSpans('N02', '정정: 모든 자료를 영구 저장한다는 앞 설명을 철회합니다.\n통합기는 입력기의 작업 큐를 읽어 전체 조건을 대조합니다.\n배포 성공 여부는 제공된 자료로 확인되지 않습니다.\n다른 프로젝트의 예제 코드는 실행 증거가 아닙니다.') },
  ],
});
const wireFor = ask => ({ summary: '입력과 통합 책임, 저장 설명의 정정을 읽었습니다.', relations: [], candidates: [], gaps: ['배포 성공 여부는 확인되지 않습니다.'], matches: [], material: [],
  parts: [{ ref: 'new:flow', name: '자료 처리', parent: null, role: '프로젝트 문서를 받아 통합에 전달하는 흐름', roleAbout: null, roleReplaces: null,
    basis: [ask.records[0].spans[0].s, ask.records[1].spans[1].s],
    claims: [
      { kind: 'describes', text: '입력기는 문서를 작업 큐에 전달합니다.', at: ask.records[0].spans[0].s, about: null, replaces: null, key: 's1' },
      { kind: 'reported', text: '모든 자료의 영구 저장이라는 앞 설명은 철회되었다고 보고합니다.', at: ask.records[1].spans[0].s, about: null, replaces: null, key: 's2' },
    ] }],
});
const receipt = input => ({ covered: input.partition.records.flatMap(record => record.core), candidates: input.partition.records.map(record => ({
  kind: record.id === 'N02' ? 'correction' : 'part', text: record.id === 'N02' ? '뒤쪽 저장 설명 철회' : '앞쪽 입력 책임', at: [record.core[0]],
})) });
const matchesCode = expected => error => error instanceof ApiError && error.code === expected;
const laterFor = () => {
  const fixture = K.conditionProject({ D, M, C, S, studioView, emptyBundle });
  const input = M.buildMapAsk(fixture.project, studioView(fixture.project), [fixture.rq], fixture.rq.id, M.MAP7_SCHEMA);
  input.ask.parts[0].name = '사용자가 고친 썸네일';
  input.ask.parts[0].role = '사용자가 정한 가져오기 책임';
  input.ask.parts[0].roleBy = 'person';
  input.ask.parts[0].roleAbout = null;
  input.ask.priors.push({ key: 'M01', quote: '썸네일 생성기를 WebP 출력으로 바꿨다고 보고합니다.', text: '이전 변경 보고', kind: 'reported', stance: 'made', about: null,
    target: { requestId: input.ask.requests[0].id, itemId: input.ask.requests[0].items[0].id } });
  validateMapAsk(input.ask);
  return input;
};

async function setup(t, extra = {}, storeOptions = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'map-pipeline-test-'));
  const store = await openMapPipelineStore({ dir, monthlyUsd: 20, runUsd: 1, ...storeOptions });
  t.after(async () => { await store.close(); await rm(dir, { recursive: true, force: true }); });
  assert.equal(store.describe().durable, true);
  const make = opts => createFirstMapPipeline({ store, deepseekKey: 'fake-deepseek', openaiKey: 'fake-openai', targetChars: 80, maxPartitions: 12,
    fetchImpl: async () => new Response('{}'), ...extra, ...opts });
  return { dir, store, make };
}
const stageOf = input => input.partition ? 'extract' : input.assignment ? 'render' : input.renderedParts ? 'global' : 'plan';
const originalWire = ask => {
  const wire = wireFor(ask);
  if (ask.schemaVersion === 'studio.map.7') for (const part of wire.parts) {
    part.roleAboutAt = part.roleAbout; delete part.roleAbout;
    for (const claim of part.claims) { claim.aboutAt = claim.about; delete claim.about; }
  }
  return wire;
};
const blueprintFor = (wire, ask) => ({
  parts: wire.parts.map(part => ({ ref: part.ref, name: part.name ?? ask.parts.find(p => p.id === part.ref).name,
    parent: part.parent ?? ask.parts.find(p => p.id === part.ref)?.parentId ?? null,
    at: [part.basis[0] ?? part.claims[0]?.at ?? ask.records[0].spans[0].s], focus: part.role ?? '기존 부분의 원문 변화' })),
  global: [{ kind: 'correction', text: '끝부분의 조건과 철회, 모름을 원문으로 재대조한다.', at: [ask.records.at(-1).spans[0].s] }],
  ...(ask.schemaVersion === 'studio.map.7' ? { corrections: [] } : {}),
});
function payloadFor(input, ask, wire) {
  const stage = stageOf(input);
  if (stage === 'extract') return receipt(input);
  if (stage === 'plan') return blueprintFor(wire, ask);
  if (stage === 'render') {
    let key = input.assignment.keyStart;
    const parts = input.assignment.parts.map(assigned => {
      const part = structuredClone(wire.parts.find(p => p.ref === assigned.ref));
      for (const claim of part.claims) claim.key = 's' + key++;
      return part;
    });
    return { summary: '', parts, relations: [], candidates: [], gaps: [], matches: [], material: [] };
  }
  const global = structuredClone({ ...wire, parts: [] });
  for (const [i, candidate] of global.candidates.entries()) if (candidate.statement) candidate.statement.key = 's' + (801 + i);
  return global;
}
function fakeProvider(ask, calls, customize = () => {}, wire = originalWire(ask)) {
  return async options => {
    await options.onDispatch();
    await options.fetchImpl('https://fake.invalid/test-only');
    const input = JSON.parse(options.input), call = { provider: options.provider, stage: stageOf(input), input, options };
    calls.push(call);
    const custom = await customize(call);
    const value = custom ?? payloadFor(input, ask, wire);
    options.onUsage(usage);
    return { value, usage, provider: options.provider, model: options.model };
  };
}
function transportFetch(ask) {
  return async (_, init) => {
    const body = JSON.parse(init.body), isDeepseek = !!body.messages;
    const input = JSON.parse(isDeepseek ? body.messages[1].content : body.input.slice('Return JSON for this input:\n'.length));
    const value = payloadFor(input, ask, originalWire(ask));
    return new Response(JSON.stringify(isDeepseek
      ? { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(value) } }], usage: { prompt_tokens: 10, completion_tokens: 10 } }
      : { status: 'completed', output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(value) }] }], usage: { input_tokens: 10, output_tokens: 10 } }));
  };
}
const manyPartsWire = ask => {
  const wire = originalWire(ask), base = wire.parts[0];
  wire.parts = Array.from({ length: 4 }, (_, i) => ({ ...structuredClone(base), ref: 'new:flow' + i, name: '처리 책임 ' + i,
    claims: [{ ...structuredClone(base.claims[0]), key: 's' + (i + 1) }] }));
  wire.relations = [{ from: 'new:flow0', to: 'new:flow3', kind: 'flow', note: '입력에서 통합으로 전달', at: ask.records[0].spans[0].s }];
  return wire;
};

test('original records and cross-shard aliases survive plan, bounded rendering and global validation', async t => {
  const { make } = await setup(t), ask = askFor(), before = structuredClone(ask), calls = [];
  const wire = await make({ callProvider: fakeProvider(ask, calls) }).call(ask);
  const extracts = calls.filter(c => c.stage === 'extract'), plan = calls.find(c => c.stage === 'plan');
  assert.ok(extracts.length > 2);
  assert.equal(calls.filter(c => c.stage === 'plan').length, 1);
  assert.equal(plan.provider, 'openai');
  assert.equal(plan.input.extraction.length, extracts.length);
  for (const call of calls.filter(c => c.stage !== 'extract')) assert.deepEqual(call.input.INPUT, before);
  assert.deepEqual(extracts.flatMap(c => c.input.partition.records.flatMap(r => r.core)), ask.records.flatMap(r => r.spans.map(s => s.s)));
  assert.ok(calls.some(c => c.stage === 'render' && c.provider === 'deepseek'));
  assert.equal(calls.at(-1).stage, 'global');
  assert.equal(calls.at(-1).provider, 'deepseek');
  const checked = validateMapReply(wire, ask);
  assert.deepEqual(checked.parts[0].claims.map(c => c.record), ['N01', 'N02']);
  assert.equal(checked.parts[0].claims[1].quote, ask.records[1].spans[0].t.trim());
  assert.deepEqual(ask, before);
});

test('complete plan/render/global checkpoints are all reused without another dispatch', async t => {
  const { make } = await setup(t), ask = askFor(), calls = [], progress = [];
  const pipeline = make({ callProvider: fakeProvider(ask, calls), onProgress: event => progress.push(event) });
  const first = await pipeline.call(ask), count = calls.length;
  assert.deepEqual(await pipeline.call(structuredClone(ask)), first);
  assert.equal(calls.length, count);
  for (const stage of ['plan', 'render-1', 'global']) assert.ok(progress.some(e => e.stage === stage && e.state === 'cached'));
});

test('changed source tail or planning model binds a fresh complete recipe', async t => {
  const { make } = await setup(t), ask = askFor(), calls = [];
  await make({ callProvider: fakeProvider(ask, calls) }).call(ask);
  const changed = structuredClone(ask);
  Object.assign(changed.records[1], encodeSpans('N02', changed.records[1].spans.map(s => s.t).join('') + '\n추가 철회: 작업 큐 연결도 아직 계획입니다.'));
  validateMapAsk(changed);
  let count = calls.length;
  await make({ callProvider: fakeProvider(changed, calls) }).call(changed);
  assert.ok(calls.length > count + 3);
  assert.deepEqual(calls.at(-1).input.INPUT, changed);
  count = calls.length;
  await make({ mergeModel: 'gpt-6.1-terra', callProvider: fakeProvider(changed, calls) }).call(changed);
  assert.ok(calls.length > count + 3);
});

test('missing core fails before planning and completed extraction peers resume without repayment', async t => {
  const { make } = await setup(t), ask = askFor(), calls = []; let bad = true;
  const pipeline = make({ callProvider: fakeProvider(ask, calls, call => {
    if (bad && call.stage === 'extract' && call.input.partition.id === 'extract-01') { bad = false; return { covered: [], candidates: [] }; }
  }) });
  await assert.rejects(pipeline.call(ask), matchesCode('INVALID_RESPONSE'));
  assert.equal(calls.some(c => c.stage === 'plan'), false);
  const peer = calls.find(c => c.stage === 'extract' && c.input.partition.id !== 'extract-01');
  assert.ok(peer);
  await pipeline.call(ask);
  assert.equal(calls.filter(c => c.stage === 'extract' && c.input.partition.id === peer.input.partition.id).length, 1);
  assert.equal(calls.filter(c => c.stage === 'plan').length, 1);
});

test('unknown failed extraction cannot be replayed and never reaches planning', async t => {
  const { make } = await setup(t), ask = askFor(), calls = [];
  const pipeline = make({ callProvider: fakeProvider(ask, calls, call => {
    if (call.stage === 'extract' && call.input.partition.id === 'extract-01') throw new ApiError('AI_NETWORK_ERROR', 503);
  }) });
  await assert.rejects(pipeline.call(ask), matchesCode('AI_NETWORK_ERROR'));
  const count = calls.length;
  await assert.rejects(pipeline.call(ask), matchesCode('MAP_STAGE_UNCERTAIN'));
  assert.equal(calls.length, count);
  assert.equal(calls.some(c => c.stage === 'plan'), false);
});

test('invalid global output is not cached complete; retry reuses the complete plan and render stages', async t => {
  const { store, make } = await setup(t), ask = askFor(), calls = [], progress = []; let bad = true;
  const pipeline = make({ onProgress: e => progress.push(e), callProvider: fakeProvider(ask, calls, call => call.stage === 'global' && bad ? { parts: [] } : undefined) });
  await assert.rejects(pipeline.call(ask), matchesCode('INVALID_RESPONSE'));
  const event = progress.find(e => e.stage === 'global');
  assert.equal(store.get(event.key, 'global'), null);
  const count = calls.length;
  bad = false;
  validateMapReply(await pipeline.call(ask), ask);
  assert.deepEqual(calls.slice(count).map(c => c.stage), ['global']);
});

test('invalid fragment is rejected before completion, so explicit retry can repair only that fragment', async t => {
  const { make } = await setup(t), ask = askFor(), calls = []; let bad = true;
  const pipeline = make({ callProvider: fakeProvider(ask, calls, call => {
    if (call.stage === 'render' && bad) return { ...payloadFor(call.input, ask, originalWire(ask)), summary: '잘못 작성한 부분 요약' };
  }) });
  await assert.rejects(pipeline.call(ask), matchesCode('INVALID_RESPONSE'));
  assert.equal(calls.some(c => c.stage === 'global'), false, 'invalid fragments must not be durable successes');
  const count = calls.length; bad = false;
  validateMapReply(await pipeline.call(ask), ask);
  assert.deepEqual(calls.slice(count).map(c => c.stage), ['render', 'global']);
});

test('a known incomplete render keeps its successful sibling and resumes only the failed group (.31: said as MAP_STAGE_INCOMPLETE)', async t => {
  const { make } = await setup(t), ask = askFor(), wire = manyPartsWire(ask), calls = []; let fail = true;
  const pipeline = make({ callProvider: fakeProvider(ask, calls, call => {
    if (fail && call.stage === 'render' && call.input.assignment.id === 'parts-2') {
      fail = false; call.options.onUsage(usage); throw new ApiError('AI_RESPONSE_INCOMPLETE', 502);
    }
  }, wire) });
  await assert.rejects(pipeline.call(ask), error => error.code === 'MAP_STAGE_INCOMPLETE' && error.detail.stage === 'render-2' && error.detail.cap === 8192);
  assert.equal(calls.some(c => c.stage === 'global'), false);
  const count = calls.length;
  validateMapReply(await pipeline.call(ask), ask);
  assert.deepEqual(calls.slice(count).map(c => c.stage), ['render', 'global']);
  assert.equal(calls[count].input.assignment.id, 'parts-2');
  assert.equal(calls.filter(c => c.stage === 'render' && c.input.assignment.id === 'parts-1').length, 1);
});

test('a plan citing an unknown source never starts rendering and can be explicitly repaired using cached extractions', async t => {
  const { make } = await setup(t), ask = askFor(), calls = []; let bad = true;
  const pipeline = make({ callProvider: fakeProvider(ask, calls, call => {
    if (call.stage === 'plan' && bad) {
      const plan = blueprintFor(originalWire(ask), ask); plan.parts[0].at = ['N99.001']; return plan;
    }
  }) });
  await assert.rejects(pipeline.call(ask), matchesCode('INVALID_RESPONSE'));
  assert.equal(calls.some(c => c.stage === 'render'), false);
  const count = calls.length; bad = false;
  validateMapReply(await pipeline.call(ask), ask);
  assert.deepEqual(calls.slice(count).map(c => c.stage), ['plan', 'render', 'global']);
});

test('a definite HTTP planning rejection releases its reservation instead of permanently locking the stage', async t => {
  const { make } = await setup(t), ask = askFor(), stages = []; let rejectPlan = true;
  const fetch = transportFetch(ask);
  const pipeline = make({ callProvider: callMapProvider, fetchImpl: async (url, init) => {
    const request = JSON.parse(init.body);
    const input = JSON.parse(request.messages ? request.messages[1].content : request.input.slice('Return JSON for this input:\n'.length));
    stages.push(stageOf(input));
    if (!request.messages && rejectPlan) return new Response('private provider diagnostic', { status: 400 });
    return fetch(url, init);
  } });
  await assert.rejects(pipeline.call(ask), matchesCode('AI_CONFIG_REJECTED'));
  assert.equal(stages.at(-1), 'plan');
  const count = stages.length; rejectPlan = false;
  validateMapReply(await pipeline.call(ask), ask);
  assert.deepEqual(stages.slice(count), ['plan', 'render', 'global']);
});

// first-map-divided.6 (changed on purpose): an unknown end no longer refuses the whole first map. That one relation is left out of
// the applied wire with its fixed reason; the endpoint is still checked against the final original map and never becomes ready.
test('cross-group relation endpoints are checked against final original map and an unknown endpoint is set aside alone', async t => {
  const { make } = await setup(t), ask = askFor(), wire = manyPartsWire(ask), calls = [];
  const pipeline = make({ callProvider: fakeProvider(ask, calls, call => {
    if (call.stage === 'global') { const global = payloadFor(call.input, ask, wire); global.relations.unshift({ ...global.relations[0], to: 'new:missing' }); return global; }
  }, wire) });
  const { wire: applied, exclusions } = await pipeline.read(ask);
  assert.equal(calls.filter(c => c.stage === 'render').length, 2, 'four planned parts require separate groups');
  assert.equal(calls.filter(c => c.stage === 'global').length, 1, 'no correction is spent on one isolated item');
  const checked = validateMapReply(applied, ask);
  assert.equal(M.setAside(checked).length, 0, 'the browser reads the applied wire whole under plain map.6');
  assert.deepEqual(checked.relations.map(r => r.to), ['new:flow3']);
  assert.deepEqual(exclusions.map(x => [x.path, x.rule, x.category, x.record]), [['relations[0]', 'contract', 'ends', 'N01']]);
  assert.ok(!JSON.stringify(exclusions).includes('new:missing'));
  assert.deepEqual(await pipeline.call(ask), applied, 'call() returns the very same applicable wire from the checkpoints');
});

test('cross-group parent assignment survives fragment validation and renderers cannot silently reparent it', async t => {
  const { make } = await setup(t), ask = askFor(), wire = manyPartsWire(ask), calls = []; let bad = true;
  wire.parts[3].parent = wire.parts[0].ref;
  const pipeline = make({ callProvider: fakeProvider(ask, calls, call => {
    if (bad && call.stage === 'render' && call.input.assignment.id === 'parts-2') {
      const fragment = payloadFor(call.input, ask, wire); fragment.parts[0].parent = null; return fragment;
    }
  }, wire) });
  await assert.rejects(pipeline.call(ask), matchesCode('INVALID_RESPONSE'));
  assert.equal(calls.some(c => c.stage === 'global'), false);
  bad = false;
  const checked = validateMapReply(await pipeline.call(ask), ask);
  assert.equal(checked.parts.find(p => p.ref === 'new:flow3').parent, 'new:flow0');
});

for (const blockedStage of ['extract', 'plan', 'render', 'global']) test('cancellation during ' + blockedStage + ' never returns partial output or replays its unknown dispatched call', async t => {
  const { make } = await setup(t), ask = askFor(), calls = [], controller = new AbortController();
  let ready; const started = new Promise(resolve => { ready = resolve; });
  const pipeline = make({ callProvider: fakeProvider(ask, calls, call => {
    if (call.stage !== blockedStage) return;
    ready();
    return new Promise((_, reject) => {
      const abort = () => reject(new ApiError('CANCELLED', 499));
      if (call.options.signal.aborted) abort(); else call.options.signal.addEventListener('abort', abort, { once: true });
    });
  }) });
  const pending = pipeline.call(ask, controller.signal);
  await started; controller.abort();
  await assert.rejects(pending, matchesCode('CANCELLED'));
  const count = calls.length;
  await assert.rejects(pipeline.call(ask), matchesCode('MAP_STAGE_UNCERTAIN'));
  assert.equal(calls.length, count);
  assert.equal(calls.at(-1).stage, blockedStage);
});

test('pre-cancelled input performs no reservation or dispatch', async t => {
  const { make } = await setup(t), controller = new AbortController(); controller.abort(); let calls = 0;
  await assert.rejects(make({ callProvider: () => { calls++; } }).call(askFor(), controller.signal), matchesCode('CANCELLED'));
  assert.equal(calls, 0);
});

test('OpenAI planning ceiling is enforced before dispatch, retaining complete extraction checkpoints', async t => {
  const { make } = await setup(t, {}, { runUsd: 0.00001 }), ask = askFor(), calls = [];
  const pipeline = make({ callProvider: fakeProvider(ask, calls) });
  await assert.rejects(pipeline.call(ask), matchesCode('MAP_BUDGET_EXCEEDED'));
  assert.ok(calls.length > 1); assert.equal(calls.some(c => c.stage === 'plan'), false);
  const count = calls.length;
  await assert.rejects(pipeline.call(ask), matchesCode('MAP_BUDGET_EXCEEDED'));
  assert.equal(calls.length, count);
});

test('cancellation while durable reservation is pending leaves a resumable known-not-sent stage', async t => {
  const { store, make } = await setup(t), ask = askFor(), controller = new AbortController();
  let release, entered, blocked = true, fetches = 0;
  const gate = new Promise(resolve => { release = resolve; }), waiting = new Promise(resolve => { entered = resolve; });
  const delayed = { ...store, begin: async (...args) => { if (blocked) { entered(); await gate; } return store.begin(...args); } };
  const fetch = transportFetch(ask);
  const pipeline = make({ store: delayed, callProvider: callMapProvider, fetchImpl: (...args) => { fetches++; return fetch(...args); } });
  const pending = pipeline.call(ask, controller.signal);
  await waiting; controller.abort(); release(); blocked = false;
  await assert.rejects(pending, matchesCode('CANCELLED'));
  assert.equal(fetches, 0);
  validateMapReply(await pipeline.call(ask), ask);
  assert.ok(fetches > 0);
});

test('cancellation after reservation resolves but before fetch remains known not sent', async t => {
  const { store, make } = await setup(t), ask = askFor(), controller = new AbortController(); let cancelOnce = true, fetches = 0;
  const wrapped = { ...store, begin(...args) { const reservation = store.begin(...args);
    if (cancelOnce) { cancelOnce = false; reservation.then(() => queueMicrotask(() => controller.abort())); }
    return reservation;
  } };
  const fetch = transportFetch(ask);
  const pipeline = make({ store: wrapped, callProvider: callMapProvider, fetchImpl: (...args) => { fetches++; return fetch(...args); } });
  await assert.rejects(pipeline.call(ask, controller.signal), matchesCode('CANCELLED'));
  assert.equal(fetches, 0);
  validateMapReply(await pipeline.call(ask), ask); assert.ok(fetches > 0);
});

test('later7 keeps original snapshots, current claims, person roles, priors, source metadata and dynamic prompt through every phase', async t => {
  const { make } = await setup(t), inp = laterFor(), ask = inp.ask, before = structuredClone(ask), calls = [];
  const pipeline = make({ targetChars: 1000, maxPartitions: 24, callProvider: fakeProvider(ask, calls, () => {}, K.replyFor7(ask, inp.records)) });
  assert.equal(pipeline.eligible(ask), true); assert.notEqual(pipeline.identity, pipeline.laterIdentity);
  const wire = await pipeline.call(ask);
  const extracts = calls.filter(c => c.stage === 'extract'); assert.ok(extracts.length > 1);
  for (const call of extracts) {
    assert.equal(call.options.maxOutputTokens, 4096);
    assert.deepEqual(call.input.snapshot, { parts: before.parts, relations: before.relations, requests: before.requests, priors: before.priors });
    assert.deepEqual(call.input.sources, before.records.map(({ id, kind, note, basis, addedAt }) => ({ id, kind, note, basis, ...(addedAt === undefined ? {} : { addedAt }) })));
    assert.equal(call.input.snapshot.parts[0].roleBy, 'person'); assert.ok(call.input.snapshot.parts[0].current.length);
  }
  for (const call of calls.filter(c => c.stage !== 'extract')) assert.deepEqual(call.input.INPUT, before);
  for (const call of calls.filter(c => ['render', 'global'].includes(c.stage))) {
    assert.ok(call.options.system.startsWith(map7Prompt(before)));
    assert.match(call.options.system, /사용자가 정한 이름·부모·역할/);
    assert.match(call.options.system, /원래 요청 snapshot/);
    assert.equal(call.options.system.includes('기존 첫 지도 계약의 항목 수'), false);
  }
  const checked = validateMapReply(wire, before); assert.ok(checked.matches.length > 0);
  assert.deepEqual(checked.matches[0].targets, [{ requestId: before.requests[0].id, itemId: before.requests[0].items[0].id }]);
  assert.deepEqual(ask, before);
  const count = calls.length; await pipeline.call(structuredClone(ask)); assert.equal(calls.length, count);
});

test('first6 and later7 use separate recipes despite identical source records', async t => {
  const { make } = await setup(t), first = askFor(), later = structuredClone(first), calls = [];
  later.schemaVersion = 'studio.map.7';
  later.parts = [{ id: 'P01', name: '기존 부분', note: '', parentId: null, readAs: null, role: '사람이 정한 기존 책임', roleBy: 'person', roleAbout: null, current: [] }];
  validateMapAsk(later);
  const provider = options => {
    const input = JSON.parse(options.input), ask = input.INPUT ?? (input.schemaVersion === 'studio.map.7' ? later : first);
    return fakeProvider(ask, calls)(options);
  };
  const pipeline = make({ callProvider: provider }); await pipeline.call(first); const count = calls.length;
  validateMapReply(await pipeline.call(later), later); assert.ok(calls.length > count + 3);
  const countLater = calls.length; await pipeline.call(first); await pipeline.call(later); assert.equal(calls.length, countLater);
  assert.equal(calls.filter(c => c.stage === 'plan').length, 2);
});

test('later context changes cannot reuse prior plan/render/global or silently change frozen request targets', async t => {
  const { make } = await setup(t), inp = laterFor(), calls = [];
  const pipelineFor = ask => make({ targetChars: 1000, maxPartitions: 24, callProvider: fakeProvider(ask, calls, () => {}, K.replyFor7(ask, inp.records)) });
  await pipelineFor(inp.ask).call(inp.ask);
  const changed = structuredClone(inp.ask); changed.parts[0].role = '사용자가 나중에 다시 고친 책임'; changed.priors[0].text = '다른 범위의 이전 보고';
  const count = calls.length; await pipelineFor(changed).call(changed); assert.ok(calls.length > count + 3);
  assert.deepEqual(calls.at(-1).input.INPUT, changed); assert.deepEqual(calls.at(-1).input.INPUT.requests, inp.ask.requests);
});

test('a completed invalid render is recorded failed before one correction, preserving its untouched rejected output', async t => {
  const { store, make } = await setup(t), ask = askFor(), original = structuredClone(ask), calls = [], events = [], diagnostics = [];
  const wrapped = { ...store,
    async failed(...args) { const result = await store.failed(...args); events.push({ event: 'failed', id: args[1], details: args[2] }); return result; },
    async begin(...args) { events.push({ event: 'begin', id: args[1] }); return store.begin(...args); },
  };
  let rejected;
  const pipeline = make({ store: wrapped, onStageOutput: output => diagnostics.push(structuredClone(output)),
    callProvider: fakeProvider(ask, calls, call => {
      if (call.stage !== 'render' || call.input.correction) return;
      const fragment = payloadFor(call.input, ask, originalWire(ask));
      // first-map-divided.6: five resolvable quotes would keep the first four; five unknown aliases leave the new part with no basis,
      // which still refuses the fragment whole and spends its one correction.
      fragment.parts[0].basis = ['N99.01', 'N99.02', 'N99.03', 'N99.04', 'N99.05'];
      rejected = structuredClone(fragment); return fragment;
    }) });
  validateMapReply(await pipeline.call(ask), ask);
  const renders = calls.filter(call => call.stage === 'render');
  assert.equal(renders.length, 2);
  assert.equal(renders[0].input.correction, undefined);
  assert.deepEqual(renders[1].input.correction.rejected, rejected);
  assert.deepEqual(renders[1].input.INPUT, original);
  assert.equal(renders[1].input.correction.rejected.parts[0].basis.length, 5, 'the rejected wire must not be silently clipped');
  const failedIndex = events.findIndex(event => event.event === 'failed' && event.id === 'render-1');
  const correctionIndex = events.findIndex(event => event.event === 'begin' && event.id === 'render-1-correction');
  assert.ok(failedIndex >= 0 && correctionIndex > failedIndex);
  const { diagnostic, ...details } = events[failedIndex].details;
  assert.deepEqual(details, { usage, uncertain: false });
  assert.deepEqual([diagnostic.stage, diagnostic.phase, diagnostic.total], ['render-1', 'render', 1], 'the refusal is kept with where it happened');
  assert.deepEqual(diagnostics.find(output => output.stage === 'render-1').value, rejected);
  assert.ok(diagnostics.some(output => output.stage === 'render-1-correction'));
  assert.deepEqual(ask, original);
});

test('a second invalid correction stops without a third request or partial global result', async t => {
  const { make } = await setup(t), ask = askFor(), calls = [], diagnostics = [];
  const pipeline = make({ onStageOutput: output => diagnostics.push(output.stage), callProvider: fakeProvider(ask, calls, call => {
    if (call.stage === 'render') return { ...payloadFor(call.input, ask, originalWire(ask)), summary: '아직 잘못된 render 요약' };
  }) });
  await assert.rejects(pipeline.call(ask), matchesCode('INVALID_RESPONSE'));
  assert.equal(calls.filter(call => call.stage === 'render').length, 2);
  assert.deepEqual(diagnostics.filter(id => id.startsWith('render-')), ['render-1', 'render-1-correction']);
  assert.equal(calls.some(call => call.stage === 'global'), false);
  assert.equal(calls.some(call => call.input.correction?.correction), false);
});

test('an uncertain correction blocks explicit replay before the original invalid render can be resent', async t => {
  const { make } = await setup(t), ask = askFor(), calls = [];
  const pipeline = make({ callProvider: fakeProvider(ask, calls, call => {
    if (call.stage !== 'render') return;
    if (call.input.correction) throw new ApiError('AI_NETWORK_ERROR', 503);
    return { ...payloadFor(call.input, ask, originalWire(ask)), summary: '거절된 render 요약' };
  }) });
  await assert.rejects(pipeline.call(ask), matchesCode('AI_NETWORK_ERROR'));
  assert.equal(calls.filter(call => call.stage === 'render').length, 2);
  const count = calls.length;
  await assert.rejects(pipeline.call(ask), matchesCode('MAP_STAGE_UNCERTAIN'));
  assert.equal(calls.length, count);
});

test('valid correction checkpoints take priority while successful render siblings are never regenerated', async t => {
  const { make } = await setup(t), ask = askFor(), wire = manyPartsWire(ask), calls = [], progress = [];
  const pipeline = make({ onProgress: event => progress.push(event), callProvider: fakeProvider(ask, calls, call => {
    if (call.stage === 'render' && call.input.assignment.id === 'parts-2' && !call.input.correction)
      return { ...payloadFor(call.input, ask, wire), summary: '잘못된 그룹 요약' };
  }, wire) });
  const first = await pipeline.call(ask), count = calls.length;
  assert.deepEqual(await pipeline.call(ask), first);
  assert.equal(calls.length, count);
  assert.equal(calls.filter(call => call.stage === 'render' && call.input.assignment.id === 'parts-1').length, 1);
  assert.equal(calls.filter(call => call.stage === 'render' && call.input.assignment.id === 'parts-2').length, 2);
  assert.ok(progress.some(event => event.stage === 'render-2-correction' && event.state === 'cached'));
});

test('a completed invalid global can be corrected once against the same original ask and rendered parts', async t => {
  const { make } = await setup(t), ask = askFor(), wire = manyPartsWire(ask), calls = [];
  const pipeline = make({ callProvider: fakeProvider(ask, calls, call => {
    if (call.stage === 'global' && !call.input.correction) {
      // first-map-divided.6: material over evidence is now set aside alone (see below); a contradiction still refuses the global
      // wire whole: a candidate leaving open the statement s1 that the first rendered part already states.
      const output = payloadFor(call.input, ask, wire);
      output.candidates = [{ target: 'holds', text: '성립 여부가 미정이다.', parts: ['new:flow0'], at: null,
        statement: { key: 's1', kind: 'describes', text: '입력기는 문서를 작업 큐에 전달합니다.', at: ask.records[0].spans[0].s, about: null } }];
      return output;
    }
  }, wire) });
  const result = await pipeline.call(ask); validateMapReply(result, ask);
  const globals = calls.filter(call => call.stage === 'global');
  assert.equal(globals.length, 2);
  assert.deepEqual(globals[1].input.renderedParts, globals[0].input.renderedParts);
  assert.equal(globals[1].input.correction.rejected.candidates.length, 1);
  // .29: the refusal's own issue first, then the diagnostics read against the ask and the rendered parts (no claim backs the summary).
  assert.deepEqual(globals[1].input.correction.issues, [{ path: 'candidates[0].statement.key', rule: 'settled-and-open', expected: null, actual: null },
    { path: 'summary', rule: 'unbacked', expected: 0, actual: 1 }]);
  assert.equal(result.candidates.length, 0);
});

test('transport errors never trigger correction even when their code is INVALID_RESPONSE or billing usage is known', async t => {
  for (const blockedStage of ['render', 'global']) for (const errorCode of ['AI_TIMEOUT', 'AI_NETWORK_ERROR', 'AI_AUTH_FAILED', 'AI_RATE_LIMIT', 'INVALID_RESPONSE']) {
    const { make } = await setup(t), ask = askFor(), calls = [];
    const pipeline = make({ callProvider: fakeProvider(ask, calls, call => {
      if (call.stage !== blockedStage) return;
      if (['AI_AUTH_FAILED', 'AI_RATE_LIMIT'].includes(errorCode)) call.options.onUsage({ inputTokens: 0, outputTokens: 0 });
      throw new ApiError(errorCode, 502);
    }) });
    await assert.rejects(pipeline.call(ask), matchesCode(errorCode));
    assert.equal(calls.some(call => call.input.correction), false, blockedStage + ':' + errorCode);
    assert.equal(calls.filter(call => call.stage === blockedStage).length, 1);
  }
});

test('explicit Terra rendering uses OpenAI credentials, high reasoning and its exact reservation and billed rates', async t => {
  const { store, make } = await setup(t), ask = askFor(), calls = [], reservations = [];
  const wrapped = { ...store, async begin(...args) {
    const reserved = await store.begin(...args); reservations.push({ stage: args[1], ...args[2], ...reserved }); return reserved;
  } };
  const pipeline = make({ store: wrapped, renderModel: 'gpt-6.1-terra', callProvider: fakeProvider(ask, calls) });
  validateMapReply(await pipeline.call(ask), ask);
  for (const call of calls) {
    if (call.stage === 'extract') { assert.equal(call.provider, 'deepseek'); assert.equal(call.options.apiKey, 'fake-deepseek'); }
    else {
      assert.equal(call.provider, 'openai'); assert.equal(call.options.apiKey, 'fake-openai'); assert.equal(call.options.reasoning, 'high');
      assert.equal(call.options.model, call.stage === 'plan' ? 'gpt-6.1-sol' : 'gpt-6.1-terra');
    }
  }
  for (const reserved of reservations.filter(item => item.model === 'gpt-6.1-terra')) {
    assert.equal(reserved.provider, 'openai');
    assert.ok(Math.abs(reserved.reservedUsd - (reserved.inputBytes + reserved.maxOutputTokens * 5) / 1e6) < 1e-12);
  }
  // Sol: (10*2+10*10)/million; Terra render+global: 2*(10*1+10*5)/million.
  assert.equal(store.describe().spentUsd, 0.00024);
  assert.equal(pipeline.describe().renderProvider, 'openai');
  assert.equal(pipeline.describe().renderModel, 'gpt-6.1-terra');
});

test('render model options preserve the DeepSeek default and distinguish provider recipes in both first and later bindings', async t => {
  const { make } = await setup(t), defaults = make({}), terra = make({ renderModel: 'gpt-6.1-terra' }), sol = make({ renderModel: 'gpt-6.1-sol' });
  assert.equal(defaults.describe().renderProvider, 'deepseek'); assert.equal(defaults.describe().renderModel, 'deepseek-flash');
  assert.equal(defaults.model, 'deepseek-flash_gpt-6.1-sol');
  assert.equal(terra.model, 'deepseek-flash_gpt-6.1-sol_gpt-6.1-terra');
  assert.notEqual(terra.identity, defaults.identity); assert.notEqual(terra.laterIdentity, defaults.laterIdentity);
  assert.notEqual(sol.identity, defaults.identity); assert.notEqual(sol.laterIdentity, defaults.laterIdentity);
  for (const pipeline of [defaults, terra, sol]) assert.notEqual(pipeline.identity, pipeline.laterIdentity);
});

// first-map-divided.10: a first map's global review may ask a rewrite only for a withdrawn thing stated as current; a missing
// condition goes to gaps, and the final review is told so too. A later map's reviews keep their rules (its obligations are code).
test('a first map alone carries the first-map review rules in its global and final-global prompts', async t => {
  const { make } = await setup(t), ask = askFor(), calls = [];
  const pipeline = make({ renderModel: 'gpt-6.1-terra', callProvider: fakeProvider(ask, calls) });
  validateMapReply(await pipeline.call(ask), ask);
  const global = calls.find(c => c.stage === 'global');
  assert.ok(global.options.system.endsWith(GLOBAL_RULES + FIRST_GLOBAL_RULES));
  assert.match(FIRST_GLOBAL_RULES, /다음 관문의 결과가 기록 시점 뒤라 아직 없다는 것/); assert.match(FIRST_FINAL_GLOBAL_RULES, /reviseParts를 보내지 말고/);
  const inp = laterFor(), laterCalls = [];
  const later = make({ targetChars: 1000, maxPartitions: 24, callProvider: fakeProvider(inp.ask, laterCalls, () => {}, K.replyFor7(inp.ask, inp.records)) });
  await later.call(inp.ask);
  const laterGlobal = laterCalls.find(c => c.stage === 'global');
  assert.ok(laterGlobal.options.system.endsWith(GLOBAL_RULES)); assert.equal(laterGlobal.options.system.includes(FIRST_GLOBAL_RULES), false);
  assert.notEqual(pipeline.identity, pipeline.laterIdentity);
  // After the one rewrite, a first map's final review carries both first-map rules, in that order after the shared ones.
  // A store of its own: the first run above would otherwise be replayed and no stage sent.
  const wire = manyPartsWire(ask), revisedCalls = [], fresh = await setup(t);
  const revised = fresh.make({ renderModel: 'gpt-6.1-terra', callProvider: fakeProvider(ask, revisedCalls, call => {
    if (call.stage === 'global' && !call.input.semanticReview) return revisionFor(ask, 'new:flow3');
  }, wire) });
  validateMapReply(await revised.call(ask), ask);
  const final = revisedCalls.filter(c => c.stage === 'global').at(-1);
  assert.ok(final.input.semanticReview); assert.ok(final.options.system.endsWith(GLOBAL_RULES + FIRST_GLOBAL_RULES + FINAL_GLOBAL_RULES + FIRST_FINAL_GLOBAL_RULES));
});

// first-map-divided.9: the plan may write 16,384 output tokens within 300 s (600 s since the two-record .30 plan timed out); renders and global stages keep 8,192 within 180 s.
test('the plan stage alone gets the larger output budget and the longer time limit', async t => {
  const { make } = await setup(t), ask = askFor(), calls = [];
  const pipeline = make({ renderModel: 'gpt-6.1-terra', callProvider: fakeProvider(ask, calls) });
  validateMapReply(await pipeline.call(ask), ask);
  const budget = stage => [...new Set(calls.filter(c => c.stage === stage).map(c => `${c.options.maxOutputTokens}/${c.options.timeoutMs}`))];
  assert.deepEqual(budget('plan'), ['16384/600000']);
  assert.deepEqual(budget('render'), ['8192/180000']); assert.deepEqual(budget('global'), ['8192/180000']);
  assert.deepEqual(budget('extract'), ['4096/60000']);
  assert.equal(PLAN_TIMEOUT_MS, 600000);
});

// first-map-divided.9: the global stages may run on a model of their own; unnamed, they run on the render model as before.
test('a global model of its own sends only the global stages to it, names the batch once per model and counts DeepSeek calls', async t => {
  const { make } = await setup(t), ask = askFor();
  const same = make({ renderModel: 'gpt-6.1-terra' }), split = make({ renderModel: 'deepseek-flash', globalModel: 'gpt-6.1-terra' });
  assert.equal(same.describe().globalModel, 'gpt-6.1-terra'); assert.equal(same.describe().globalProvider, 'openai');
  assert.equal(same.model, 'deepseek-flash_gpt-6.1-sol_gpt-6.1-terra');
  assert.equal(split.model, 'deepseek-flash_gpt-6.1-sol_gpt-6.1-terra', 'each distinct model once, in stage order');
  assert.equal(make({ renderModel: 'gpt-6.1-terra', globalModel: 'gpt-6.1-sol' }).model, 'deepseek-flash_gpt-6.1-sol_gpt-6.1-terra');
  assert.notEqual(split.identity, same.identity); assert.notEqual(split.laterIdentity, same.laterIdentity);
  assert.notEqual(make({ renderModel: 'gpt-6.1-terra', globalModel: 'gpt-6.1-sol' }).identity, same.identity);
  // DeepSeek rendering with OpenAI global stages: 12 extractions (no correction) + (.31) 12 groups x (1 + semantic) x (1 + correction).
  assert.deepEqual([split.describe().renderProvider, split.describe().deepseekMaxCalls], ['deepseek', 60]);
  assert.equal(make({ renderModel: 'gpt-6.1-terra', globalModel: 'deepseek-flash' }).describe().deepseekMaxCalls, 28);
  for (const globalModel of ['gpt-unknown', 'deepseek-other', '', null]) assert.throws(() => make({ renderModel: 'gpt-6.1-terra', globalModel }), /Invalid map global model configuration/);
  const calls = [], pipeline = make({ renderModel: 'deepseek-flash', globalModel: 'gpt-6.1-terra', callProvider: fakeProvider(ask, calls) });
  validateMapReply(await pipeline.call(ask), ask);
  assert.deepEqual([...new Set(calls.filter(c => c.stage === 'render').map(c => `${c.provider}:${c.options.model}`))], ['deepseek:deepseek-flash']);
  assert.deepEqual(calls.filter(c => c.stage === 'global').map(c => `${c.provider}:${c.options.model}`), ['openai:gpt-6.1-terra']);
  assert.equal(calls.some(c => c.input.correction), false);
});

test('unsupported render models are rejected rather than substituted or dispatched', async t => {
  const { make } = await setup(t); let calls = 0;
  for (const renderModel of ['gpt-unknown', 'deepseek-other', '', null]) {
    assert.throws(() => make({ renderModel, callProvider: () => { calls++; } }), /Invalid map render model configuration/);
  }
  assert.equal(calls, 0);
});

test('Terra render and global validation failures retain the same one-correction limit and paid accounting', async t => {
  const { store, make } = await setup(t), ask = askFor(), calls = [];
  const pipeline = make({ renderModel: 'gpt-6.1-terra', callProvider: fakeProvider(ask, calls, call => {
    if (call.input.correction) return;
    if (call.stage === 'render') return { ...payloadFor(call.input, ask, originalWire(ask)), summary: '거절된 부분 요약' };
    if (call.stage === 'global') return { parts: [] };
  }) });
  validateMapReply(await pipeline.call(ask), ask);
  for (const stage of ['render', 'global']) {
    const attempts = calls.filter(call => call.stage === stage);
    assert.equal(attempts.length, 2);
    assert.equal(attempts[1].provider, 'openai'); assert.equal(attempts[1].options.model, 'gpt-6.1-terra');
    assert.ok(attempts[1].input.correction);
  }
  assert.equal(store.describe().spentUsd, 0.00036, 'both rejected completed Terra outputs and both corrections are billed');
  const count = calls.length; await pipeline.call(ask); assert.equal(calls.length, count);
});

test('a Terra render reservation exceeding the run ceiling prevents dispatch after an accepted compact plan', async t => {
  // .39: the plan's prompt holds the 「한 줄 요약」 subject rule (its reservation passed 0.03); the Terra render's is still far past the ceiling.
  // .41: the plan's prompt holds the folder, 「전체」 and nested-field rules (its reservation passed 0.032).
  const { make } = await setup(t, {}, { runUsd: 0.035 }), ask = askFor(), calls = [];
  const pipeline = make({ mergeTokens: 64, renderModel: 'gpt-6.1-terra', callProvider: fakeProvider(ask, calls) });
  await assert.rejects(pipeline.call(ask), matchesCode('MAP_BUDGET_EXCEEDED'));
  assert.equal(calls.some(call => call.stage === 'plan'), true);
  assert.equal(calls.some(call => call.stage === 'render'), false);
  const count = calls.length;
  await assert.rejects(pipeline.call(ask), matchesCode('MAP_BUDGET_EXCEEDED'));
  assert.equal(calls.length, count, 'the accepted completed plan is kept when the next paid reservation is refused');
});

const revisionFor = (ask, ref = 'new:flow') => ({ reviseParts: [ref], reason: '명시적 철회가 해당 부분의 구조화된 주장에 빠졌다.', at: [ask.records.at(-1).spans[0].s] });

test('a valid global revision re-renders only the affected original group and final review uses those new parts', async t => {
  const { make } = await setup(t), ask = askFor(), original = structuredClone(ask), wire = manyPartsWire(ask), calls = [], progress = [], phases = [];
  const revision = revisionFor(ask, 'new:flow3');
  const pipeline = make({ onProgress: event => progress.push(event), callProvider: fakeProvider(ask, calls, call => {
    if (call.stage === 'global' && !call.input.semanticReview) return revision;
    if (call.stage === 'render' && call.input.semanticReview) {
      const fragment = payloadFor(call.input, ask, wire);
      fragment.parts[0].claims[0] = { ...fragment.parts[0].claims[0], kind: 'reported', text: '앞 영구 저장 설명을 철회했다고 보고합니다.', at: ask.records[1].spans[0].s };
      return fragment;
    }
  }, wire) });
  const result = await pipeline.call(ask, undefined, phase => phases.push(phase));
  const renders = calls.filter(call => call.stage === 'render'), globals = calls.filter(call => call.stage === 'global');
  assert.equal(renders.length, 3); assert.equal(globals.length, 2);
  const semantic = renders.find(call => call.input.semanticReview);
  assert.equal(semantic.input.assignment.id, 'parts-2'); assert.equal(semantic.input.assignment.keyStart, 61);
  assert.deepEqual(semantic.input.assignment.parts.map(part => part.ref), ['new:flow3']);
  assert.deepEqual(semantic.input.semanticReview, revision);
  assert.deepEqual(semantic.input.previousParts, globals[0].input.renderedParts.slice(3));
  assert.deepEqual(globals[1].input.renderedParts.slice(0, 3), globals[0].input.renderedParts.slice(0, 3), 'unaffected siblings remain untouched');
  assert.match(globals[1].input.renderedParts[3].claims[0].text, /철회/);
  assert.deepEqual(globals[1].input.semanticReview, revision);
  for (const call of calls.filter(call => call.stage !== 'extract')) assert.deepEqual(call.input.INPUT, original);
  validateMapReply(result, ask); assert.deepEqual(ask, original);
  assert.ok(progress.some(event => event.stage === 'render-2-semantic' && event.state === 'complete'));
  assert.ok(progress.some(event => event.stage === 'global-final' && event.state === 'complete'));
  for (const phase of phases) {
    assert.ok(['extract', 'plan', 'render', 'global', 'correction'].includes(phase.phase));
    assert.ok(Number.isInteger(phase.done) && phase.done >= 0 && phase.done <= phase.total);
  }
  assert.ok(phases.some(phase => phase.phase === 'render' && phase.total === 1 && phase.done === 0));
  const count = calls.length;
  assert.deepEqual(await pipeline.call(ask), result);
  assert.equal(calls.length, count, 'the sentinel, semantic group, and final review all resume from distinct checkpoints');
  assert.ok(progress.some(event => event.stage === 'render-2-semantic' && event.state === 'cached'));
  assert.ok(progress.some(event => event.stage === 'global-final' && event.state === 'cached'));
});

test('a second semantic sentinel fails closed without another render or format-correction call', async t => {
  const { make } = await setup(t), ask = askFor(), calls = [], stages = [];
  const pipeline = make({ onStageOutput: output => stages.push(output.stage), callProvider: fakeProvider(ask, calls,
    call => call.stage === 'global' ? revisionFor(ask) : undefined) });
  await assert.rejects(pipeline.call(ask), matchesCode('INVALID_RESPONSE'));
  assert.equal(calls.filter(call => call.stage === 'global').length, 2);
  assert.equal(calls.filter(call => call.stage === 'render').length, 2);
  assert.equal(stages.includes('global-final-correction'), false);
  assert.equal(stages.some(id => id.includes('semantic-semantic')), false);
});

test('malformed global sentinels never trigger semantic re-rendering', async t => {
  const { make } = await setup(t), ask = askFor(), calls = [];
  const pipeline = make({ callProvider: fakeProvider(ask, calls, call => call.stage === 'global'
    ? { ...revisionFor(ask), reviseParts: ['new:unplanned'] } : undefined) });
  await assert.rejects(pipeline.call(ask), matchesCode('INVALID_RESPONSE'));
  assert.equal(calls.filter(call => call.stage === 'global').length, 2, 'only the original and its single format correction are dispatched');
  assert.equal(calls.some(call => call.input.semanticReview), false);
});

test('semantic groups and final review each allow one bounded format correction with original assignment keys', async t => {
  const { make } = await setup(t), ask = askFor(), calls = [], stages = [];
  const pipeline = make({ onStageOutput: output => stages.push(output.stage), callProvider: fakeProvider(ask, calls, call => {
    if (call.stage === 'global' && !call.input.semanticReview) return revisionFor(ask);
    if (call.stage === 'render' && call.input.semanticReview && !call.input.correction)
      return { ...payloadFor(call.input, ask, originalWire(ask)), summary: '유효하지 않은 부분 요약' };
    if (call.stage === 'global' && call.input.semanticReview && !call.input.correction) return { parts: [] };
  }) });
  validateMapReply(await pipeline.call(ask), ask);
  assert.ok(stages.includes('render-1-semantic-correction')); assert.ok(stages.includes('global-final-correction'));
  assert.equal(calls.filter(call => call.stage === 'render' && call.input.semanticReview).length, 2);
  assert.equal(calls.filter(call => call.stage === 'global' && call.input.semanticReview).length, 2);
  for (const call of calls.filter(call => call.stage === 'render' && call.input.semanticReview)) assert.equal(call.input.assignment.keyStart, 1);
  const count = calls.length; await pipeline.call(ask); assert.equal(calls.length, count);
});

for (const blockedStage of ['render', 'global']) test('uncertain semantic ' + blockedStage + ' is not replayed and cannot return a partial result', async t => {
  const { make } = await setup(t), ask = askFor(), calls = [];
  const pipeline = make({ callProvider: fakeProvider(ask, calls, call => {
    if (call.stage === 'global' && !call.input.semanticReview) return revisionFor(ask);
    if (call.stage === blockedStage && call.input.semanticReview) throw new ApiError('AI_NETWORK_ERROR', 503);
  }) });
  await assert.rejects(pipeline.call(ask), matchesCode('AI_NETWORK_ERROR'));
  const count = calls.length;
  await assert.rejects(pipeline.call(ask), matchesCode('MAP_STAGE_UNCERTAIN'));
  assert.equal(calls.length, count);
  assert.equal(calls.some(call => call.input.correction), false);
});

for (const blockedStage of ['render', 'global']) test('cancelling semantic ' + blockedStage + ' preserves checkpoints without applying or replaying', async t => {
  const { make } = await setup(t), ask = askFor(), calls = [], controller = new AbortController();
  let ready; const started = new Promise(resolve => { ready = resolve; });
  const pipeline = make({ callProvider: fakeProvider(ask, calls, call => {
    if (call.stage === 'global' && !call.input.semanticReview) return revisionFor(ask);
    if (call.stage !== blockedStage || !call.input.semanticReview) return;
    ready();
    return new Promise((_, reject) => {
      const abort = () => reject(new ApiError('CANCELLED', 499));
      if (call.options.signal.aborted) abort(); else call.options.signal.addEventListener('abort', abort, { once: true });
    });
  }) });
  const pending = pipeline.call(ask, controller.signal); await started; controller.abort();
  await assert.rejects(pending, matchesCode('CANCELLED'));
  const count = calls.length;
  await assert.rejects(pipeline.call(ask), matchesCode('MAP_STAGE_UNCERTAIN'));
  assert.equal(calls.length, count);
});

// first-map-divided.6: OpenAI rendering leaves room for one extraction correction each (2 x 12); DeepSeek rendering has none (48).
test('semantic pass metadata bounds DeepSeek to (.31) 64 calls while OpenAI rendering allows twelve extractions with one correction each', async t => {
  const { make } = await setup(t);
  assert.equal(make({}).describe().deepseekMaxCalls, 64);
  assert.equal(make({ renderModel: 'gpt-6.1-terra' }).describe().deepseekMaxCalls, 24);
  assert.equal(make({ renderModel: 'gpt-6.1-terra', maxPartitions: 5 }).describe().deepseekMaxCalls, 10);
  assert.equal(make({ maxPartitions: 5 }).describe().deepseekMaxCalls, 57);
});

test('a declared later withdrawal automatically repairs summary-only normal output before its record is consumed', async t => {
  const empty = () => ({ summary: '', parts: [], relations: [], candidates: [], gaps: [], matches: [], material: [] });
  const meta = n => ({ id: 'R_' + crypto.randomUUID(), at: '2026-11-02T00:00:00.000Z', model: 'stub', prompt: 'm6-000000000001', hash: String(n).repeat(64) });
  let project = D.pasteRecord(D.createProject(), '작업 보고: 파일 저장을 구현했다고 보고합니다.', null).project;
  const initial = M.buildMapAsk(project, studioView(project), [], undefined, M.MAP6_SCHEMA), initialAt = initial.ask.records[0].spans[0].s;
  project = M.applyReading(project, initial, M.validateMapReply({ ...empty(), parts: [{ ref: 'new:save', name: '파일 저장', parent: null,
    role: '파일 저장을 맡는다.', roleAbout: null, roleReplaces: null, basis: [initialAt], claims: [{ key: 's1', kind: 'reported',
      text: '파일 저장을 구현했다고 보고함', at: initialAt, about: null, replaces: null }] }] }, initial.ask), meta(1)).project;
  const area = project.space.areas[0].id;
  project = D.pasteRecord(project, '정정: 앞 보고의 파일 저장 구현 주장을 철회합니다. 실제로는 아직 파일 저장을 구현하지 않았습니다.\n저장 위치 설정은 계속 파일 경로를 받습니다.', null).project;
  const input = M.buildMapAsk(project, studioView(project), [], undefined, M.MAP7_SCHEMA), ask = input.ask, part = ask.parts[0], spans = ask.records[0].spans;
  const correctionAt = spans[0].s, notMadeAt = spans.find(span => span.t.includes('실제로는')).s, otherAt = spans.find(span => span.t.includes('저장 위치 설정')).s;
  const wire = { ...empty(), summary: '앞선 파일 저장 구현 보고가 철회되었고 아직 구현하지 않았다.', parts: [{ ref: part.id, name: null, parent: null,
    role: null, roleAboutAt: null, roleReplaces: null, basis: [], claims: [{ key: 's1', kind: 'describes',
      text: '저장 위치 설정은 파일 경로를 받는다.', at: otherAt, aboutAt: null, replaces: null }] }] };
  const { make } = await setup(t), calls = [];
  const pipeline = make({ targetChars: 1000, callProvider: fakeProvider(ask, calls, call => {
    if (call.stage === 'plan') return { ...blueprintFor(wire, ask), corrections: [{ part: part.id, claim: part.current[0].key, at: [correctionAt, notMadeAt] }] };
    if (call.stage === 'render' && call.input.semanticReview) {
      const fragment = payloadFor(call.input, ask, wire);
      fragment.parts[0].claims.push({ key: 's2', kind: 'reported', text: '앞 구현 보고를 철회했으며 파일 저장은 아직 구현하지 않았다고 보고함',
        at: correctionAt + '-' + notMadeAt.split('.')[1], aboutAt: null, replaces: part.current[0].key });
      return fragment;
    }
  }, wire) });
  const result = await pipeline.call(ask), next = M.applyReading(project, input, M.validateMapReply(result, ask), meta(2)).project;
  assert.equal(M.unreadRecords(next, studioView(next)).length, 0);
  assert.equal(M.partUnderstanding(next, area).claims.some(claim => claim.text === '파일 저장을 구현했다고 보고함'), false);
  assert.ok(M.partUnderstanding(next, area).claims.some(claim => claim.replaces));
  assert.equal(calls.filter(call => call.stage === 'global').length, 1, 'known missing replacements skip the ordinary paid global review');
  assert.equal(calls.find(call => call.stage === 'global').input.semanticReview.reviseParts[0], part.id);
});

function conditionalLater() {
  const ask = structuredClone(askFor()); ask.schemaVersion = 'studio.map.7';
  ask.parts = [{ id: 'P01', name: '저장', note: '', parentId: null, readAs: null, role: '사람이 정한 저장 책임', roleBy: 'person', roleAbout: null,
    current: [{ key: 'C01', kind: 'reported', text: '저장을 구현했다고 보고함', about: 'alpha 판본' },
      { key: 'C02', kind: 'reported', text: '저장을 구현했다고 보고함', about: 'beta 판본' }] }];
  validateMapAsk(ask);
  const wire = { summary: 'alpha 보고는 철회되었고 beta 판본과 혼동하지 않습니다.', parts: [{ ref: 'P01', name: null, parent: null, role: null,
    roleAboutAt: null, roleReplaces: null, basis: [], claims: [{ key: 's1', kind: 'reported', text: 'beta 판본의 별도 보고',
      at: ask.records[0].spans[0].s, aboutAt: null, replaces: 'C02' }] }], relations: [], candidates: [], gaps: [], matches: [], material: [] };
  const obligation = { part: 'P01', claim: 'C01', at: [ask.records[1].spans[0].s] };
  return { ask, wire, obligation };
}

test('a replacement of a different conditional current key cannot satisfy a declared obligation or reach global-final', async t => {
  const { make } = await setup(t), { ask, wire, obligation } = conditionalLater(), before = structuredClone(ask), calls = [];
  const pipeline = make({ callProvider: fakeProvider(ask, calls, call => call.stage === 'plan'
    ? { ...blueprintFor(wire, ask), corrections: [obligation] } : undefined, wire) });
  await assert.rejects(pipeline.call(ask), matchesCode('INVALID_RESPONSE'));
  assert.equal(calls.filter(call => call.stage === 'render').length, 2, 'the declared missing key gets exactly one semantic pass');
  assert.equal(calls.filter(call => call.stage === 'global').length, 0, 'a summary cannot remove the still-current claim');
  const semantic = calls.find(call => call.stage === 'render' && call.input.semanticReview);
  assert.deepEqual(semantic.input.blueprint.corrections, [obligation]);
  assert.deepEqual(ask, before);
  const count = calls.length;
  await assert.rejects(pipeline.call(ask), matchesCode('INVALID_RESPONSE'));
  assert.equal(calls.length, count, 'the cached unsuccessful semantic pass cannot silently start another round');
});

test('raw replaces on a map7 soft-excluded claim does not satisfy the ledger and triggers original-key repair', async t => {
  const { make } = await setup(t), { ask, wire, obligation } = conditionalLater(), calls = [];
  const pipeline = make({ callProvider: fakeProvider(ask, calls, call => {
    if (call.stage === 'plan') return { ...blueprintFor(wire, ask), corrections: [obligation] };
    if (call.stage !== 'render') return;
    const fragment = payloadFor(call.input, ask, wire);
    fragment.parts[0].claims.push({ key: 's2', kind: 'reported', text: 'alpha 구현 보고를 철회함',
      at: call.input.semanticReview ? obligation.at[0] : 'N99.001', aboutAt: null, replaces: obligation.claim });
    return fragment;
  }, wire) });
  const checked = validateMapReply(await pipeline.call(ask), ask);
  assert.equal(calls.filter(call => call.stage === 'render').length, 2);
  assert.equal(calls.filter(call => call.stage === 'global').length, 1);
  assert.ok(checked.parts[0].claims.some(claim => claim.replaces === 'C01'));
  assert.ok(checked.parts[0].claims.some(claim => claim.replaces === 'C02'));
});

test('an empty later obligation ledger preserves ordinary global review and the original first blueprint shape', async t => {
  const { make } = await setup(t), { ask, wire } = conditionalLater(), calls = [], plans = [];
  const later = make({ onStageOutput: output => { if (output.stage === 'plan') plans.push(output.value); }, callProvider: fakeProvider(ask, calls, () => {}, wire) });
  validateMapReply(await later.call(ask), ask);
  assert.deepEqual(plans[0].corrections, []);
  assert.equal(calls.filter(call => call.stage === 'global').length, 1);
  assert.equal(calls.some(call => call.input.semanticReview), false);
  const first = askFor(), firstPlans = [];
  await make({ onStageOutput: output => { if (output.stage === 'plan') firstPlans.push(output.value); }, callProvider: fakeProvider(first, []) }).call(first);
  assert.deepEqual(Object.keys(firstPlans[0]).sort(), ['global', 'parts']);
});

test('an obligation already covered by a surviving current-key replacement does not add a semantic pass', async t => {
  const { make } = await setup(t), { ask, wire, obligation } = conditionalLater(), calls = [];
  const covered = { ...obligation, claim: 'C02' };
  const pipeline = make({ callProvider: fakeProvider(ask, calls, call => call.stage === 'plan'
    ? { ...blueprintFor(wire, ask), corrections: [covered] } : undefined, wire) });
  const checked = validateMapReply(await pipeline.call(ask), ask);
  assert.ok(checked.parts[0].claims.some(claim => claim.replaces === 'C02'));
  assert.equal(calls.some(call => call.input.semanticReview), false);
  assert.equal(calls.filter(call => call.stage === 'global').length, 1);
});

test('a cached valid global sentinel is combined with machine obligations in the same single semantic round', async t => {
  const { store, make } = await setup(t), { ask, wire, obligation } = conditionalLater(), calls = [];
  wire.parts.push(...manyPartsWire(ask).parts.slice(0, 3));
  const reviewed = revisionFor(ask, 'new:flow2'), before = structuredClone(reviewed);
  let key;
  const pipeline = make({ onProgress: event => { key = event.key; }, onStageOutput: async output => {
    if (output.stage !== 'plan') return;
    // Represents a durable prior review of this exact immutable ask/blueprint; no provider is contacted.
    await store.begin(key, 'global', { provider: 'deepseek', model: 'deepseek-flash', inputBytes: 100, maxOutputTokens: 100 });
    await store.complete(key, 'global', { value: reviewed, usage });
  }, callProvider: fakeProvider(ask, calls, call => {
    if (call.stage === 'plan') return { ...blueprintFor(wire, ask), corrections: [obligation] };
    if (call.stage === 'render' && call.input.semanticReview && call.input.assignment.parts.some(part => part.ref === 'P01')) {
      const fragment = payloadFor(call.input, ask, wire), part = fragment.parts.find(part => part.ref === 'P01');
      part.claims.push({ key: 's48', kind: 'reported', text: 'alpha 보고의 철회', at: obligation.at[0], aboutAt: null, replaces: obligation.claim });
      return fragment;
    }
  }, wire) });
  validateMapReply(await pipeline.call(ask), ask);
  const semantic = calls.filter(call => call.stage === 'render' && call.input.semanticReview);
  assert.deepEqual(semantic.map(call => call.input.assignment.id), ['parts-1', 'parts-2']);
  assert.deepEqual(semantic[0].input.semanticReview.reviseParts, ['P01', 'new:flow2']);
  assert.equal(calls.filter(call => call.stage === 'global').length, 1, 'only the new final review is sent');
  assert.deepEqual(store.get(key, 'global'), before, 'combining review pointers must not mutate the cached sentinel');
});

// Task A: a refused stage says where (stage, phase, total) and which fixed rule, never text; the refused value is kept only when asked.
const refusedAt = expected => error => {
  assert.ok(error instanceof ApiError); assert.equal(error.code, 'INVALID_RESPONSE');
  assert.deepEqual(error.detail, expected); return true;
};
const PRIVATE = 'sk-PRIVATEsecretVALUE0123456789abcd';

test('a refused render and its one refused correction name the correction stage, phase, total and safe rule/path', async t => {
  const { store, make } = await setup(t), ask = askFor(), calls = [], rejected = [], progress = [];
  const pipeline = make({ onProgress: event => progress.push(event), onRejected: kept => rejected.push(kept), callProvider: fakeProvider(ask, calls, call => {
    if (call.stage !== 'render') return;
    // A new part whose every basis quote fails to resolve has nothing to rest on: still a whole refusal (one bad quote among others is set aside).
    const fragment = payloadFor(call.input, ask, originalWire(ask)); fragment.parts[0].basis = ['N99.001']; return fragment;
  }) });
  await assert.rejects(pipeline.call(ask), refusedAt({ stage: 'render-1-correction', phase: 'correction', total: 1, rule: 'reference', path: 'parts[0].basis[0]' }));
  assert.equal(calls.filter(call => call.stage === 'render').length, 2, 'still exactly one correction round');
  assert.deepEqual(rejected.map(kept => kept.stage), ['render-1', 'render-1-correction']);
  assert.deepEqual(rejected[0].diagnostic, { stage: 'render-1', phase: 'render', total: 1, rule: 'reference', path: 'parts[0].basis[0]' });
  assert.deepEqual(rejected[0].validation, { path: 'parts[0].basis[0]', rule: 'reference' });
  assert.equal(rejected[0].value.parts[0].basis[0], 'N99.001', 'the kept value is the refused output, not a repaired one');
  assert.equal(rejected[0].input.assignment.id, 'parts-1');
  assert.deepEqual(rejected[0].usage, usage);
  const key = progress[0].key, last = store.lastFailure(key);
  assert.equal(typeof last.at, 'string'); delete last.at;
  assert.deepEqual(last, { stage: 'render-1-correction', phase: 'correction', total: 1, rule: 'reference', path: 'parts[0].basis[0]' });
  assert.equal(store.describe().lastFailure.stage, 'render-1-correction');
});

test('a refused render without a validator path still names its stage and a coarse reason', async t => {
  const { make } = await setup(t), ask = askFor(), calls = [];
  const pipeline = make({ callProvider: fakeProvider(ask, calls, call => {
    if (call.stage === 'render') return { ...payloadFor(call.input, ask, originalWire(ask)), summary: '렌더가 쓴 요약' };
  }) });
  await assert.rejects(pipeline.call(ask), refusedAt({ stage: 'render-1-correction', phase: 'correction', total: 1, reason: 'shape' }));
});

test('a refused extraction receipt says extract, its partition and a coarse reason, without any correction', async t => {
  const { store, make } = await setup(t), ask = askFor(), calls = [], rejected = [], progress = [];
  const pipeline = make({ onProgress: event => progress.push(event), onRejected: kept => rejected.push(kept), callProvider: fakeProvider(ask, calls, call => {
    if (call.stage === 'extract' && call.input.partition.id === 'extract-01') return { covered: [], candidates: [] };
  }) });
  let detail;
  await assert.rejects(pipeline.call(ask), error => { detail = error.detail; return error instanceof ApiError && error.code === 'INVALID_RESPONSE'; });
  const partitions = calls.filter(call => call.stage === 'extract')[0].input.partition;
  assert.ok(partitions);
  assert.ok(detail.total > 2);
  assert.deepEqual(detail, { stage: 'extract-1', phase: 'extract', total: detail.total, reason: 'coverage' });
  assert.equal(calls.some(call => call.input.correction), false, 'extraction is never corrected');
  assert.deepEqual(rejected.map(kept => kept.stage), ['extract-1']);
  assert.equal(store.lastFailure(progress[0].key).reason, 'coverage');
  {
    const { make: again } = await setup(t);
    await assert.rejects(again({ callProvider: fakeProvider(ask, [], call => call.stage === 'extract' ? { covered: [] } : undefined) }).call(ask),
      error => error.detail?.phase === 'extract' && error.detail.reason === 'shape' && !('rule' in error.detail));
  }
  // first-map-divided.7: a candidate outside the partition or of an unknown kind is advisory only: it is left out of the receipt
  // the later stages get, and the reading goes on. The planner then sees the acknowledged core and no such candidate.
  for (const mutate of [input => ({ ...receipt(input), candidates: [{ kind: 'part', text: '단서', at: ['N99.001'] }] }),
    input => ({ ...receipt(input), candidates: [{ kind: 'fact', text: '단서', at: [input.partition.records[0].core[0]] }] })]) {
    const { make: again } = await setup(t), seen = [];
    validateMapReply(await again({ callProvider: fakeProvider(ask, seen, call => call.stage === 'extract' ? mutate(call.input) : undefined) }).call(ask), ask);
    const plan = seen.find(call => call.stage === 'plan');
    assert.ok(plan.input.extraction.every(x => x.candidates.length === 0), 'set-aside candidates never reach the planner');
  }
});

test('a refused plan and its one refused correction say plan-correction and a coarse blueprint reason; no third plan is sent', async t => {
  const cases = [
    [plan => { plan.parts[0].at = ['N99.001']; }, 'anchor'],
    [plan => { plan.extra = []; }, 'shape'],
    [plan => { plan.parts[0].ref = 'flow'; }, 'ref'],
    [plan => { plan.parts[0].parent = 'new:missing'; }, 'parent'],
    [plan => { plan.global[0].kind = 'fact'; }, 'kind'],
    [plan => { plan.parts = Array.from({ length: 37 }, (_, i) => ({ ...plan.parts[0], ref: 'new:p' + i })); }, 'count'],
  ];
  for (const [mutate, reason] of cases) {
    const { make } = await setup(t), ask = askFor(), calls = [];
    const pipeline = make({ callProvider: fakeProvider(ask, calls, call => {
      if (call.stage !== 'plan') return;
      const plan = blueprintFor(originalWire(ask), ask); mutate(plan); return plan;
    }) });
    await assert.rejects(pipeline.call(ask), refusedAt({ stage: 'plan-correction', phase: 'correction', reason }));
    assert.equal(calls.filter(call => call.stage === 'plan').length, 2, reason);
    assert.equal(calls.some(call => call.stage === 'render'), false);
  }
});

test('a transport INVALID_RESPONSE is said by stage with the fixed transport reason and is never corrected or kept', async t => {
  const { make } = await setup(t), ask = askFor(), calls = [], rejected = [];
  const pipeline = make({ onRejected: kept => rejected.push(kept), callProvider: fakeProvider(ask, calls, call => {
    if (call.stage === 'global') { call.options.onUsage(usage); throw new ApiError('INVALID_RESPONSE', 502); }
  }) });
  await assert.rejects(pipeline.call(ask), refusedAt({ stage: 'global', phase: 'global', reason: 'transport' }));
  assert.equal(calls.some(call => call.input.correction), false);
  assert.equal(rejected.length, 0, 'nothing readable came back to keep');
});

test('the kept refusal hides key-like text and the configured keys; detail and ledger never hold model text', async t => {
  const { dir, store, make } = await setup(t), ask = askFor(), rejected = [], progress = [];
  const pipeline = make({ onProgress: event => progress.push(event), onRejected: kept => rejected.push(kept), callProvider: fakeProvider(ask, [], call => {
    if (call.stage !== 'global') return;
    const global = payloadFor(call.input, ask, originalWire(ask));
    global.summary = `요약 ${PRIVATE} fake-openai fake-deepseek`;
    global.relations = [{ from: 'new:flow', to: 'new:flow', kind: 'flow', note: PRIVATE, at: 'N99.001' }];
    return global;
  }) });
  let detail;
  await assert.rejects(pipeline.call(ask), error => { detail = error.detail; return error.code === 'INVALID_RESPONSE'; });
  assert.equal(detail.stage, 'global-correction');
  assert.equal(rejected.length, 2);
  const text = JSON.stringify(rejected);
  for (const secret of [PRIVATE, 'fake-openai', 'fake-deepseek']) assert.ok(!text.includes(secret), secret);
  assert.ok(text.includes('[가려진 비밀값]'));
  assert.equal(rejected[0].value.relations[0].at, 'N99.001', 'only secrets are hidden; the refused value is otherwise untouched');
  const ledger = await readFile(join(dir, 'pipeline.json'), 'utf8');
  const visible = JSON.stringify([detail, store.lastFailure(progress[0].key), store.describe()]) + ledger;
  for (const leak of ['PRIVATE', 'fake-openai', '요약 ', 'N99.001']) assert.ok(!visible.includes(leak), leak);
});

test('the host keeps refused stages only when STUDIO_KEEP_REFUSED gives it a folder, and logs the file it wrote', async t => {
  const ask = askFor(), root = await mkdtemp(join(tmpdir(), 'map-keep-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const fetchImpl = async (_url, init) => {
    const body = JSON.parse(init.body), isDeepseek = !!body.messages;
    const input = JSON.parse(isDeepseek ? body.messages[1].content : body.input.slice('Return JSON for this input:\n'.length));
    const value = payloadFor(input, ask, originalWire(ask));
    if (input.assignment) value.summary = `render ${PRIVATE}`;
    return new Response(JSON.stringify(isDeepseek
      ? { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(value) } }], usage: { prompt_tokens: 10, completion_tokens: 10 } }
      : { status: 'completed', output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(value) }] }], usage: { input_tokens: 10, output_tokens: 10 } }));
  };
  const env = { DEEPSEEK_API_KEY: 'host-test-deepseek-inert', OPENAI_API_KEY: 'host-test-openai-inert' };
  const keep = join(root, 'refused'), logs = [];
  const kept = await openFirstMapPipeline({ env, dir: join(root, 'jobs-a'), fetchImpl, keep, log: line => logs.push(line) });
  try { await assert.rejects(kept.call(ask), error => error.code === 'INVALID_RESPONSE' && error.detail.stage === 'render-1-correction'); }
  finally { await kept.close(); }
  const files = (await readdir(keep)).sort();
  assert.equal(files.length, 2);
  assert.ok(files.some(file => file.endsWith('-render-1-INVALID_RESPONSE.json')) && files.some(file => file.endsWith('-render-1-correction-INVALID_RESPONSE.json')));
  for (const file of files) {
    const text = await readFile(join(keep, file), 'utf8'), saved = JSON.parse(text);
    for (const secret of [PRIVATE, env.DEEPSEEK_API_KEY, env.OPENAI_API_KEY]) assert.ok(!text.includes(secret), secret);
    assert.equal(saved.kind, 'map-stage'); assert.ok(['render-1', 'render-1-correction'].includes(saved.stage));
    assert.equal(saved.diagnostic.reason, 'shape'); assert.equal(saved.value.summary, 'render [가려진 비밀값]');
    assert.ok(logs.some(line => line.includes(join(keep, file)) && line.includes(`(${saved.stage} shape)`)));
  }
  const off = await openFirstMapPipeline({ env, dir: join(root, 'jobs-b'), fetchImpl, log: line => logs.push(line) });
  const before = logs.length;
  try { await assert.rejects(off.call(ask), error => error.code === 'INVALID_RESPONSE' && error.detail.stage === 'render-1-correction'); }
  finally { await off.close(); }
  assert.equal(logs.length, before, 'no keeper runs when the option is off');
  assert.deepEqual((await readdir(root)).sort(), ['jobs-a', 'jobs-b', 'refused']);
});

// ---- first-map-divided.6: item set-aside, plan and extraction corrections (fake providers only; no model quality is claimed) ----
const projectFor = () => {
  let p = D.pasteRecord(D.createProject(), '입력기는 프로젝트 문서를 받아 작업 큐에 전달합니다.\n처음에는 모든 자료를 영구 저장한다고 설명했습니다.\n중간 조건: 개발용 판본에만 적용합니다.\n원문 기록은 변경 없이 보존합니다.', null).project;
  p = D.pasteRecord(p, '정정: 모든 자료를 영구 저장한다는 앞 설명을 철회합니다.\n통합기는 입력기의 작업 큐를 읽어 전체 조건을 대조합니다.\n배포 성공 여부는 제공된 자료로 확인되지 않습니다.\n다른 프로젝트의 예제 코드는 실행 증거가 아닙니다.', null).project;
  // Two pastes in one millisecond tie on `at` and keep paste order; distinct times read newest first. Fix the times so the
  // ask's record order is the same on every run (the correction first, as a real paste a moment later would be).
  p = { ...p, pasted: p.pasted.map((r, i) => ({ ...r, at: i === 0 ? '2026-11-02T00:00:00.000Z' : '2026-11-02T00:00:01.000Z' })) };
  const input = M.buildMapAsk(p, studioView(p), [], undefined, M.MAP6_SCHEMA);
  assert.equal(input.problem, null); assert.equal(input.ask.schemaVersion, M.MAP6_SCHEMA);
  return { p, input, ask: input.ask };
};
const readingMeta = n => ({ id: 'R_' + crypto.randomUUID(), at: '2026-11-02T00:00:00.000Z', model: 'stub', prompt: 'm6-000000000001', hash: String(n).repeat(64) });
/** The browser's load() and apply: plain map.6 validation, the checked reasons attached, one saved reading that survives a reload. */
function browserApply(f, wire, exclusions, n = 7) {
  const reply = validateMapReply(wire, f.ask);
  assert.equal(M.setAside(reply).length, 0, 'the applicable wire reads whole under plain map.6, exactly as the browser re-validates it');
  M.attachExclusions(reply, exclusions, f.ask);
  const applied = M.applyReading(f.p, f.input, reply, readingMeta(n));
  assert.deepEqual(parseProject(S.serializeProject(applied.project)).readings.at(-1), applied.reading);
  return applied;
}

test('recipe identities are bumped for the changed prompts and validation semantics', () => {
  assert.equal(PIPELINE_RECIPE, 'first-map-divided.41');
  assert.equal(LATER_PIPELINE_RECIPE, 'later-map-divided.41');
});

test('a render fragment with one unresolvable claim alias is applied with only that claim set aside and a durable diagnostic', async t => {
  const { make } = await setup(t), f = projectFor(), calls = [];
  const pipeline = make({ callProvider: fakeProvider(f.ask, calls, call => {
    if (call.stage !== 'render') return;
    const fragment = payloadFor(call.input, f.ask, originalWire(f.ask));
    fragment.parts[0].claims.splice(1, 0, { ...fragment.parts[0].claims[0], key: 's9', text: '없는 구간을 가리키는 주장', at: 'N01.99' });
    return fragment;
  }) });
  const { wire, exclusions } = await pipeline.read(f.ask);
  assert.equal(calls.filter(c => c.stage === 'render').length, 1); assert.equal(calls.some(c => c.input.correction), false, 'no paid correction');
  assert.deepEqual(wire.parts[0].claims.map(c => c.key), ['s1', 's2'], 'only the offending claim is omitted; others keep their keys and order');
  assert.deepEqual(exclusions, [{ path: 'parts[0].claims[1].at', rule: 'reference', category: null,
    explanation: '이번에 보낸 부분이나 원문 구간을 찾을 수 없어 제외했어요.', record: null, from: null, to: null }]);
  assert.ok(!JSON.stringify(exclusions).includes('없는 구간'), 'the rejected text never enters diagnostics');
  const applied = browserApply(f, wire, exclusions);
  assert.equal(applied.created.length, 1); assert.equal(applied.reading.parts[0].claims.length, 2);
  assert.deepEqual(applied.reading.exclusions, exclusions);
  for (const q of [...applied.reading.parts[0].basis, ...applied.reading.parts[0].claims])
    assert.equal(f.p.pasted.find(r => r.id === q.record).text.slice(q.from, q.to), q.quote, 'every surviving item rests on its exact original passage');
});

test('a basis of five keeps the first four representative quotes and records the count reason', async t => {
  const { make } = await setup(t), f = projectFor(), calls = [], five = ['N01.01', 'N01.02', 'N01.03', 'N01.04', 'N02.01'];
  const pipeline = make({ callProvider: fakeProvider(f.ask, calls, call => {
    if (call.stage !== 'render') return;
    const fragment = payloadFor(call.input, f.ask, originalWire(f.ask)); fragment.parts[0].basis = five; return fragment;
  }) });
  const { wire, exclusions } = await pipeline.read(f.ask);
  assert.equal(calls.some(c => c.input.correction), false);
  assert.deepEqual(wire.parts[0].basis, five.slice(0, 4));
  assert.deepEqual(exclusions.map(x => [x.path, x.rule, x.category, x.explanation]), [['parts[0].basis', 'contract', 'count', '허용 개수를 넘는 뒤쪽 항목들을 제외했어요.']]);
  assert.equal(browserApply(f, wire, exclusions).reading.parts[0].basis.length, 4);
});

test('global with one material range over adopted evidence drops only that material; a real embedded example stays', async t => {
  const { make } = await setup(t), f = projectFor(), calls = [];
  const example = f.ask.records.flatMap(record => record.spans).find(span => span.t.includes('예제 코드')).s;
  const pipeline = make({ callProvider: fakeProvider(f.ask, calls, call => {
    if (call.stage !== 'global') return;
    const global = payloadFor(call.input, f.ask, originalWire(f.ask));
    global.material = [{ at: f.ask.records[0].spans[0].s, what: '보고서 머리말' }, { at: example, what: '다른 프로젝트 예제' }]; return global;
  }) });
  const { wire, exclusions } = await pipeline.read(f.ask);
  assert.equal(calls.filter(c => c.stage === 'global').length, 1);
  assert.deepEqual(wire.material, [{ at: example, what: '다른 프로젝트 예제' }]);
  const first = f.ask.records[0].spans[0].t.replace(/\n$/, ''); // the piece's range, without its line break
  assert.deepEqual(exclusions.map(x => [x.path, x.rule, x.record, x.from, x.to]), [['material[0]', 'material-evidence', 'N01', 0, first.length]]);
  const applied = browserApply(f, wire, exclusions);
  assert.equal(applied.reading.material.length, 1); assert.equal(applied.reading.exclusions[0].record, f.p.pasted.find(r => r.text.startsWith(f.ask.records[0].spans[0].t.trim().slice(0, 8))).id);
});

test('a part whose every claim is set aside still refuses its fragment and spends the one correction', async t => {
  const { make } = await setup(t), f = projectFor(), calls = [];
  const pipeline = make({ callProvider: fakeProvider(f.ask, calls, call => {
    if (call.stage !== 'render' || call.input.correction) return;
    const fragment = payloadFor(call.input, f.ask, originalWire(f.ask));
    for (const claim of fragment.parts[0].claims) claim.at = 'N01.99';
    return fragment;
  }) });
  const { wire, exclusions } = await pipeline.read(f.ask);
  const renders = calls.filter(c => c.stage === 'render');
  assert.equal(renders.length, 2);
  assert.deepEqual(renders[1].input.correction.issues, [{ path: 'parts[0].claims[0].at', rule: 'reference', expected: null, actual: null }]);
  assert.deepEqual(exclusions, []); assert.equal(wire.parts[0].claims.length, 2);
});

test('an invalid plan is corrected once with safe path/rule feedback and never sends a third plan', async t => {
  for (const persistent of [false, true]) {
    const { make } = await setup(t), ask = askFor(), calls = [];
    const pipeline = make({ callProvider: fakeProvider(ask, calls, call => {
      if (call.stage !== 'plan' || (!persistent && call.input.correction)) return;
      const plan = blueprintFor(originalWire(ask), ask); plan.parts[0].at = ['N99.001']; plan.global[0].text = '가'.repeat(241); return plan;
    }) });
    if (persistent) await assert.rejects(pipeline.call(ask), matchesCode('INVALID_RESPONSE'));
    else validateMapReply(await pipeline.call(ask), ask);
    const plans = calls.filter(c => c.stage === 'plan');
    assert.equal(plans.length, 2);
    assert.equal(plans[0].input.correction, undefined);
    assert.deepEqual(plans[1].input.correction.issues, [{ path: 'parts[0].at', rule: 'reference', expected: null, actual: null },
      { path: 'global[0].text', rule: 'length', expected: 240, actual: 241 }]);
    assert.ok(!JSON.stringify(plans[1].input.correction.issues).includes('N99'), 'feedback never copies an alias');
    assert.equal(plans[1].input.correction.rejected.parts[0].at[0], 'N99.001', 'the rejected plan is passed back untouched');
    assert.deepEqual(plans[1].input.INPUT, ask);
    assert.equal(calls.some(c => c.stage === 'render'), !persistent);
  }
});

test('with OpenAI rendering an extraction receipt is corrected once with coarse coverage feedback; DeepSeek rendering never corrects it', async t => {
  for (const renderModel of ['gpt-6.1-terra', 'deepseek-flash']) {
    const { make } = await setup(t), ask = askFor(), calls = []; let bad = true;
    const pipeline = make({ renderModel, callProvider: fakeProvider(ask, calls, call => {
      if (bad && call.stage === 'extract' && call.input.partition.id === 'extract-01') { bad = false; return { covered: [], candidates: [] }; }
    }) });
    if (renderModel === 'deepseek-flash') {
      await assert.rejects(pipeline.call(ask), matchesCode('INVALID_RESPONSE'));
      assert.equal(calls.some(c => c.input.correction), false); assert.equal(calls.some(c => c.stage === 'plan'), false);
      continue;
    }
    validateMapReply(await pipeline.call(ask), ask);
    const attempts = calls.filter(c => c.stage === 'extract' && c.input.partition.id === 'extract-01');
    assert.equal(attempts.length, 2);
    const core = attempts[0].input.partition.records.flatMap(r => r.core).length;
    assert.deepEqual(attempts[1].input.correction.issues, [{ path: 'covered', rule: 'coverage', expected: core, actual: 0 }]);
    assert.equal(attempts[1].provider, 'deepseek');
    assert.equal(calls.filter(c => c.stage === 'plan').length, 1);
  }
});

// ---- first-map-divided.29: the rule sentences and the cost path of a 24-part first map (fake providers only). ----
test('.29 rule sentences: stores are parts, every part-table row is covered, a row belongs to its first cell, one line per citation, versions out of config, the summary on claims', async () => {
  const P = await import('../server/map-pipeline.mjs'), B = await import('../server/map-blueprint.mjs');
  for (const rule of ['「있는 곳」이 파일·큐·경로인 행', '「저장소 ref → 읽는 쪽 ref: 행 이름」', '만드는 쪽 → 읽는 쪽 직통 항목을 쓰지 않는다', '미구현·폐기·모름 행도 그 상태의 부분으로 세우고',
    '첫 지도는 새 부분도 36개까지', '그 행을 흡수한 부분의 focus에 원문 이름과 상태 그대로']) assert.ok(B.MAP_BLUEPRINT_PROMPT.includes(rule), rule);
  assert.ok(B.LATER_BLUEPRINT_PROMPT.includes('새 부분은 12개 이하, global은 32개 이하'));
  for (const rule of ['저장소 부분은 type=store이고 typeAt은 그 산출물 행', '「필드」 칸의 「·」마다 하나씩', '첫 칸이 blueprint.parts의 다른 부분 이름인 행은', '그 행·줄 한 줄의 구간 별칭 하나를 인용',
    '판본(sha·「판본」·「명세 136feaf0」 같은 해시)은 설정이 아니므로', '「,」와 「·」로 나뉜 항목마다 하나씩', '설계 설명(topic=how) 주장보다 먼저',
    // R10: a live-versus-checkout distinction of the record's basis stays a claim.
    '그 구별을 그 판본이 가리키는 부분의 주장 하나(topic=how, where에 두 판본)로 남긴다']) assert.ok(P.RENDER_RULES.includes(rule), rule);
  for (const rule of ['「만드는 쪽 → 저장소」(cadence는 쓰는 쪽 박자)와 「저장소 → 읽는 쪽」', '읽는 쪽의 루프 주기·타이머는 그 선이 아니라 읽는 부분의 config가 맡는다', '관계의 from은 그 at 줄이 보내는 쪽으로 적은 부분',
    'mode=design인 설계 흐름에서만 from이 된다', '연결 표 행 한 줄의 구간 별칭 하나', 'summary의 각 문장은 renderedParts의 어떤 주장이 받치는 사실',
    'relations는 첫 지도(INPUT.parts가 비어 있음)에서 최대48개, 그 밖에는 최대16개', 'relations 상한(첫 지도 48개, 그 밖 16개)을 넘으면']) assert.ok(GLOBAL_RULES.includes(rule), rule);
  assert.ok(!GLOBAL_RULES.includes('relations 최대16개'), 'the old sixteen-only bound is gone');
  for (const category of ['via-store', 'sender', 'wrong-part', 'config이면 판본을 config에서 빼']) assert.ok(P.CORRECTION_RULES.includes(category), category);
});

test('.29: a 24-part first map renders in eight fragments; a run ceiling that cannot hold them refuses a render before dispatch, applies nothing and never resends a finished stage', async t => {
  const ask = askFor(), base = originalWire(ask).parts[0];
  const wide = { ...originalWire(ask), parts: Array.from({ length: 24 }, (_, i) => ({ ...structuredClone(base), ref: `new:u${i}`, name: `단위 ${i}` })) };
  const bytes = [];
  const provider = calls => async options => {
    await options.onDispatch();
    await options.fetchImpl('https://fake.invalid/test-only');
    const input = JSON.parse(options.input), stage = stageOf(input), size = new TextEncoder().encode(options.system + options.input).length;
    calls.push({ stage, input });
    if (stage === 'render') bytes.push(size);
    // A render bills half of its input bound (Terra input at $1 per million tokens): the run total grows with every fragment.
    const used = stage === 'render' ? { inputTokens: Math.floor(size / 2), outputTokens: 0 } : usage;
    options.onUsage(used);
    return { value: payloadFor(input, ask, wide), usage: used, provider: options.provider, model: options.model };
  };
  const options = { mergeTokens: 64, renderTokens: 512, renderModel: 'gpt-6.1-terra' };
  const roomy = await setup(t), calls = [];
  const wire = await roomy.make({ ...options, callProvider: provider(calls) }).call(ask);
  assert.equal(calls.filter(c => c.stage === 'render').length, 8);
  assert.deepEqual(calls.filter(c => c.stage === 'render').map(c => c.input.assignment.keyStart), [1, 61, 121, 181, 241, 301, 361, 421]);
  assert.equal(validateMapReply(wire, ask).parts.length, 24);
  // A ceiling of about three render reservations: two run at once, each bills half, so a later fragment cannot be reserved.
  const bound = Math.max(...bytes) / 1e6;
  const tight = await setup(t, {}, { runUsd: Number((3.2 * bound).toFixed(6)) }), sent = [];
  const pipeline = tight.make({ ...options, callProvider: provider(sent) });
  await assert.rejects(pipeline.call(ask), matchesCode('MAP_BUDGET_EXCEEDED'));
  const renders = () => sent.filter(c => c.stage === 'render').map(c => c.input.assignment.id);
  assert.ok(renders().length >= 2 && renders().length < 8, String(renders().length));
  assert.equal(sent.some(c => c.stage === 'global'), false, 'no global stage is sent and no map is applied');
  await assert.rejects(pipeline.call(ask), matchesCode('MAP_BUDGET_EXCEEDED'));
  assert.equal(new Set(renders()).size, renders().length, 'a finished fragment is never sent again');
  assert.equal(sent.filter(c => c.stage === 'plan').length, 1);
  assert.equal(sent.some(c => c.stage === 'global'), false);
});

// ---- first-map-divided.30: map-reading.9 (steps, loop, kept state, port map) and the rules from the blind judging of the .29 map. ----
test('.30 rule sentences: every connection row a line, absorption into the group parent only, row names verbatim, "·" outside parentheses, state facts first, steps, loop, kept state and the port map', async () => {
  const P = await import('../server/map-pipeline.mjs'), B = await import('../server/map-blueprint.mjs');
  assert.deepEqual([P.PIPELINE_RECIPE, P.LATER_PIPELINE_RECIPE], ['first-map-divided.41', 'later-map-divided.41']);
  for (const rule of ['흡수는 기록의 묶음 표(부모 이름 | 자식 이름들)가 그 행의 부모로 적은 부분에만 하고', '연결 표(보내는 부분 | 받는 부분)에 자기 행이 있는 단위는 부모가 있어도 흡수하지 않고 부분으로 세운다',
    '부분의 name은 그 표 행의 첫 칸 이름을 글자 그대로 쓰고', '「facts-refresh」 행을 「calendar.json」으로 부르지 않는다', '모든 행은 relation 항목 하나(저장소를 거치면 둘)로 빠짐없이 쓴다',
    'global은64개 이하(그중 relation 항목 48개까지)']) assert.ok(B.MAP_BLUEPRINT_PROMPT.includes(rule), rule);
  for (const rule of ['「·」는 괄호(…)·대괄호[…] 밖에서만 나눈다', '「entry_params(wait_max_s·opp_close_q)」는 필드 하나', '「event(CYCLE·ARM_CYCLE·…)」도 필드 하나다', '화살표가 든 구나', '저장소 부분(type=store)의 inputs는 []로 두고',
    'outputs는 내는 것의 이름 최대 8개다', '적힌 그대로 최대 24개(각 60자 이내)', '적힌 그대로 최대 12개(각 80자 이내', '목록이 상한(12개)을 넘으면 칸의 순서대로 앞의 12개를 쓰고',
    '실거래 상태(한 줄 요약·부분 표 행의 돈·노출·가동 상태) → 철회(「철회·변경」 표) → 오류 수치(「오류·미해결」 표) → 규칙(「지켜야 할 것」 표) → 모름·가장 자신 없는 것 → 실제 변화(「최근 요청과 실제 변화」 표) → 설계 설명 순서다', '그 상태 단어만 다시 말하는 status 주장', '돈·손익·대기 상태',
    '「안의 단계」 표(부분 이름 | 순번 | 단계 이름 | 하는 일 | 쓰는 파일·함수·모델 | 조건·분기)에서 첫 칸이 이 부분인 행마다 하나씩', '한 행에 단계 하나이며', '단계 사이의 순서·분기·반복은 쓰지 않는다(이번 계약에 없다)',
    '세 칸은 각각 원문이 말할 때만 채우며', 'stateVars는 기록이 이 부분이 유지한다고 적은 상태', '"steps":[{"name":"봉투 검사"', '"loop":{"unit":"60 s 폴링"']) assert.ok(P.RENDER_RULES.includes(rule), rule);
  for (const rule of ['응답 맨 위에 portMap 배열을 더한다', '"relation":이 응답 relations 배열의 순번(0부터)', '명시가 없으면 []다', '읽는 부분 자신의 행(그 부분의 「받는 산출물」 칸)이어도 되며',
    '연결 표(보내는 부분 | 받는 부분)의 모든 행은 선 하나(저장소를 거치면 둘)로 빠짐없이 그리고', '최대48개']) assert.ok(P.GLOBAL_RULES.includes(rule), rule);
  for (const rule of ['부분의 steps·loop·stateVars·conditions, 응답의 basisAt·basisVersion·portMap', 'category가 step이면', 'loop이면', 'state-var이면', 'port-map이면', 'restate이면']) assert.ok(P.CORRECTION_RULES.includes(rule), rule);
  assert.ok(!P.RENDER_RULES.includes('4개를 넘으면 원문 순서대로 앞의 4개만 쓴다'), 'the old four-settings cut is gone');
});

test('.30: a first map sets item-level problems aside on the first pass (no correction is paid) and each stage keeps which items it set aside', async t => {
  const { dir, make } = await setup(t), f = projectFor(), calls = [];
  const pipeline = make({ callProvider: fakeProvider(f.ask, calls, call => {
    if (call.stage === 'render') {
      const fragment = payloadFor(call.input, f.ask, originalWire(f.ask)), part = fragment.parts[0];
      Object.assign(part, { type: 'engine', typeAt: part.basis[0], fields: Array.from({ length: 25 }, (_, i) => `f${i}`), config: ['618df374'],
        steps: [{ name: '없는 행', at: 'N01.99' }] });
      return fragment;
    }
    if (call.stage === 'global') return { ...payloadFor(call.input, f.ask, originalWire(f.ask)), basisAt: '가'.repeat(61) };
  }) });
  const { wire, exclusions } = await pipeline.read(f.ask);
  assert.equal(calls.some(c => c.input.correction), false, 'no paid correction for an item-level problem');
  assert.deepEqual(exclusions.map(x => `${x.path} ${x.category}`).sort(), ["parts[0].fields fields", "parts[0].config config", "parts[0].type type", "parts[0].steps[0] step", "basisAt basis-at"].sort());
  assert.deepEqual([wire.parts[0].type, wire.parts[0].fields, wire.parts[0].config, wire.parts[0].steps, wire.basisAt], [null, null, null, [], null]);
  browserApply(f, wire, exclusions, 8);
  const saved = JSON.parse(await readFile(join(dir, 'pipeline.json'), 'utf8')), stages = Object.values(saved.body.jobs).at(-1).stages;
  const render = Object.entries(stages).find(([id]) => id.startsWith('render-'))[1], global = stages.global;
  assert.deepEqual(render.setAside.map(x => x.category).sort(), ['config', 'fields', 'step', 'type']);
  assert.deepEqual(global.setAside, [{ path: 'basisAt', rule: 'contract', category: 'basis-at' }]);
  assert.ok(!JSON.stringify(render.setAside).includes('618df374'), 'only fixed paths, rules and categories are kept');
  // A structural problem still refuses the first pass and pays its one correction.
  const s2 = await setup(t), calls2 = [];
  const strict = s2.make({ callProvider: fakeProvider(f.ask, calls2, call => {
    if (call.stage !== 'render' || call.input.correction) return;
    const fragment = payloadFor(call.input, f.ask, originalWire(f.ask)); fragment.parts[0].ref = 'new:other'; return fragment;
  }) });
  await strict.read(f.ask);
  assert.equal(calls2.filter(c => c.stage === 'render' && c.input.correction).length, 1, 'a wrong part ref is corrected once');
});

// Background plan (PLAN_TIMEOUT_MS > MAP_BACKGROUND_AFTER_MS): per plan attempt one paid POST, then free GET polls (and a free cancel
// on a deadline or cancellation). The stage's one attempt keeps the response id; a lost reply is marked; a re-run reads it back.
const RESPONSES_URL = 'https://api.openai.com/v1/responses', RESPONSE_ID = 'resp_plan1';
function backgroundTransport(ask) {
  const direct = transportFetch(ask), log = [], state = { planBody: null, poll: 'complete', post: 'queued' };
  const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
  const fetchImpl = async (url, init) => {
    const background = url === RESPONSES_URL && init.method === 'POST' && JSON.parse(init.body).background === true;
    if (url.startsWith(RESPONSES_URL)) log.push(`${init.method} ${url.slice(RESPONSES_URL.length) || '/'}`);
    if (background) {
      state.planBody = init.body;
      if (state.post === 'network') throw new TypeError('fetch failed');
      return json({ id: RESPONSE_ID, object: 'response', status: 'queued', background: true, output: [], usage: null });
    }
    if (url === `${RESPONSES_URL}/${RESPONSE_ID}/cancel`) return new Response('unavailable', { status: 500 });
    if (url === `${RESPONSES_URL}/${RESPONSE_ID}` && init.method === 'GET') {
      if (state.poll === 'hang') return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true }));
      const done = await (await direct(RESPONSES_URL, { body: state.planBody })).json();
      return json({ ...done, id: RESPONSE_ID, object: 'response', background: true });
    }
    return direct(url, init);
  };
  return { log, state, fetchImpl };
}
const fastPolls = options => callMapProvider({ ...options, pollMs: 0 });
const planOf = async dir => Object.values(JSON.parse(await readFile(join(dir, 'pipeline.json'), 'utf8')).body.jobs).at(-1).stages.plan;

test('the plan stage runs in background mode: one paid POST, then GET polls, charged from usage, the response id kept', async t => {
  const { dir, make } = await setup(t), ask = askFor(), bg = backgroundTransport(ask);
  validateMapReply(await make({ callProvider: fastPolls, fetchImpl: bg.fetchImpl }).call(ask), ask);
  assert.deepEqual(bg.log, ['POST /', `GET /${RESPONSE_ID}`]);
  assert.equal(JSON.parse(bg.state.planBody).store, true);
  const plan = await planOf(dir);
  assert.equal(plan.state, 'complete'); assert.equal(plan.attempts.length, 1);
  const [attempt] = plan.attempts;
  assert.equal(attempt.responseId, RESPONSE_ID); assert.ok(Number.isFinite(Date.parse(attempt.responseAt)));
  assert.equal(attempt.charged, (10 * 2 + 10 * 10) * 1000); // gpt-6.1-sol, 10 in / 10 out, from the reply's usage
  assert.equal(attempt.lost, undefined);
});

test('a plan POST whose reply never came back keeps its reservation as charged and is marked usage: null, lost: true', async t => {
  const { dir, make } = await setup(t), ask = askFor(), bg = backgroundTransport(ask);
  bg.state.post = 'network';
  await assert.rejects(make({ callProvider: fastPolls, fetchImpl: bg.fetchImpl }).call(ask), matchesCode('AI_NETWORK_ERROR'));
  const plan = await planOf(dir), [attempt] = plan.attempts;
  assert.equal(plan.state, 'uncertain');
  assert.equal(attempt.lost, true); assert.equal(attempt.usage, null); assert.equal(attempt.charged, attempt.reserved);
  assert.equal(attempt.responseId, undefined);
  // Without a kept id nothing can be read back: the stage still blocks and nothing is sent again.
  const count = bg.log.length;
  await assert.rejects(make({ callProvider: fastPolls, fetchImpl: bg.fetchImpl }).call(ask), matchesCode('MAP_STAGE_UNCERTAIN'));
  assert.equal(bg.log.length, count);
});

test('a re-run reads an interrupted plan back with one GET of its kept id (no new POST) and charges its usage once', async t => {
  const { dir, store, make } = await setup(t), ask = askFor(), bg = backgroundTransport(ask), controller = new AbortController();
  bg.state.poll = 'hang';
  // The process "dies" before the attempt's outcome is written: the plan stays running with its response id.
  const killed = { ...store, noteResponse: async (...args) => { await store.noteResponse(...args); setImmediate(() => controller.abort()); },
    failed: async () => { throw new Error('process killed'); } };
  await assert.rejects(make({ store: killed, callProvider: fastPolls, fetchImpl: bg.fetchImpl }).call(ask, controller.signal), /process killed/);
  let plan = await planOf(dir);
  assert.equal(plan.state, 'running'); assert.equal(plan.attempts[0].responseId, RESPONSE_ID);
  bg.state.poll = 'complete'; const before = bg.log.length, progress = [];
  validateMapReply(await make({ callProvider: fastPolls, fetchImpl: bg.fetchImpl, onProgress: e => progress.push(e) }).call(ask), ask);
  assert.deepEqual(bg.log.slice(before), [`GET /${RESPONSE_ID}`]);
  assert.ok(progress.some(e => e.stage === 'plan' && e.state === 'running' && e.resumed === true));
  plan = await planOf(dir);
  assert.equal(plan.state, 'complete'); assert.equal(plan.attempts.length, 1);
  assert.equal(plan.attempts[0].charged, (10 * 2 + 10 * 10) * 1000); assert.ok(plan.attempts[0].resumedAt);
});

test('a kept response id older than an hour, or already read back once, is not read again and the stage still blocks', async t => {
  let clock = Date.parse('2026-11-04T00:00:00Z');
  const { dir, store, make } = await setup(t, {}, { now: () => new Date(clock) }), ask = askFor(), bg = backgroundTransport(ask);
  const controller = new AbortController();
  bg.state.poll = 'hang';
  const killed = { ...store, noteResponse: async (...args) => { await store.noteResponse(...args); setImmediate(() => controller.abort()); },
    failed: async () => { throw new Error('process killed'); } };
  await assert.rejects(make({ store: killed, callProvider: fastPolls, fetchImpl: bg.fetchImpl }).call(ask, controller.signal), /process killed/);
  clock += 61 * 60 * 1000;
  const before = bg.log.length;
  await assert.rejects(make({ callProvider: fastPolls, fetchImpl: bg.fetchImpl }).call(ask), matchesCode('MAP_STAGE_UNCERTAIN'));
  assert.equal(bg.log.length, before);
  // Within the hour a read-back that again comes back with nothing is lost once and for all.
  clock -= 30 * 60 * 1000; const controller2 = new AbortController();
  const pending = make({ callProvider: fastPolls, fetchImpl: bg.fetchImpl, onProgress: e => { if (e.stage === 'plan' && e.resumed) setImmediate(() => controller2.abort()); } }).call(ask, controller2.signal);
  await assert.rejects(pending, matchesCode('CANCELLED'));
  let plan = await planOf(dir);
  assert.equal(plan.state, 'uncertain'); assert.equal(plan.attempts.length, 1); assert.equal(plan.attempts[0].lost, true);
  // .35: the cancelled run does not read it back; the next run still sends nothing again and, at its end, reads the lost response
  // once (a free GET) for the ledger: the stage still blocks, its charge becomes the usage the response reports.
  bg.state.poll = 'complete';
  const count = bg.log.length;
  await assert.rejects(make({ callProvider: fastPolls, fetchImpl: bg.fetchImpl }).call(ask), matchesCode('MAP_STAGE_UNCERTAIN'));
  assert.deepEqual(bg.log.slice(count), [`GET /${RESPONSE_ID}`]);
  plan = await planOf(dir);
  assert.equal(plan.state, 'uncertain');
  assert.deepEqual([plan.attempts[0].lost, plan.attempts[0].usage, plan.attempts[0].charged], [false, { inputTokens: 10, outputTokens: 10 }, (10 * 2 + 10 * 10) * 1000]);
  assert.ok(plan.attempts[0].reconciledAt);
  // Reconciled once: a later run reads nothing again.
  const again = bg.log.length;
  await assert.rejects(make({ callProvider: fastPolls, fetchImpl: bg.fetchImpl }).call(ask), matchesCode('MAP_STAGE_UNCERTAIN'));
  assert.equal(bg.log.length, again);
});

// ---- first-map-divided.31: 36 parts in twelve fragments, the named diagnostics in the correction feedback, the rule sentences,
// and the plan stage's own reasoning effort and output-token cap (host knobs; fake providers and an inert transport only). ----
test('.31 rule sentences: 36 parts, the fragment key range, list items alone, the loop unit, kept state, fact rows before design, the summary state first', async () => {
  const P = await import('../server/map-pipeline.mjs'), B = await import('../server/map-blueprint.mjs');
  for (const rule of ['보통5~36개, 총36개 이하(첫 지도는 새 부분도 36개까지)', '부분 36개 안에서 고를 때는', '원문 표의 단위와 저장소가 부분 36개를 넘으면']) assert.ok(B.MAP_BLUEPRINT_PROMPT.includes(rule), rule);
  assert.ok(B.LATER_BLUEPRINT_PROMPT.includes('parts는 총24개 이하(위의 36개가 아니다)'));
  assert.ok(!B.MAP_BLUEPRINT_PROMPT.includes('총24개 이하'), 'the old 24 bound is gone from the first map');
  for (const rule of ['assignment.keyStart부터 assignment.keyEnd까지(둘 다 포함)', '그 항목 하나만 지도에서 빠지고 나머지 항목은 남는다', '적힌 그대로 최대 24개(각 60자 이내)',
    'loop.unit은 기록이 그 부분 자신이 되풀이해 돈다고 말한 문장', 'type이 timer인 부분의 하루 일정', '「설정」 칸의 값(「j1_cadence 60 s」)은 config이지 반복 단위가 아니다',
    '루프 코드를 읽지 않았다고 적었으면([모름], 「이번에 안 읽음」) unit은 null이다', '부분이 스스로 쓰고 다시 읽는 자기 파일(posture.json, counter.jsonl',
    'readBy·changedBy에는 그것을 읽고 바꾸는 이 부분의 단계 이름', '{"name":"posture.json","scope":null,"readBy":["게이트"],"changedBy":["게이트"]}',
    '오류 행의 수치(「−147.6 bp', '그 부분의 설계 설명(topic=how) 주장은 그 행들을 모두 쓴 뒤 자리가 남을 때만 쓴다']) assert.ok(P.RENDER_RULES.includes(rule), rule);
  assert.ok(!P.RENDER_RULES.includes('99개 범위'), 'the old hundred-key range is gone');
  for (const rule of ['둘째 문장은 기록의 기준 시각(basisAt)의 운영 상태다', '−0.433 USDT', '구조·설계 설명이나 가동 여부만으로 첫 문장을 쓰지 않는다', 'reviseParts는 고유한 blueprint ref 1~36개만']) assert.ok(P.GLOBAL_RULES.includes(rule), rule);
  for (const rule of ['rule이 plan-relations이면 names의 「from → to」마다', 'connections이면 names의 연결 표 행마다 선을 그린다', 'uncited이면 names가 가리키는 부분의 실제 변화·오류·철회·가장 자신 없는 것 행을']) assert.ok(P.CORRECTION_RULES.includes(rule), rule);
});

test('.31: a 36-part first map renders in twelve fragments on their own key ranges; the global correction hears which plan relation items no line draws', async t => {
  const ask = askFor(), base = originalWire(ask).parts[0];
  const wide = { ...originalWire(ask), parts: Array.from({ length: 36 }, (_, i) => ({ ...structuredClone(base), ref: `new:u${i}`, name: `단위 ${i}` })) };
  const { make } = await setup(t), calls = [];
  const pipeline = make({ renderModel: 'gpt-6.1-terra', callProvider: fakeProvider(ask, calls, call => {
    if (call.stage === 'plan') { const plan = blueprintFor(wide, ask); plan.global.push({ kind: 'relation', text: 'new:u0 → new:u1: 작업 큐', at: [ask.records[0].spans[0].s] }); return plan; }
    // The global stage's first pass is structurally wrong (it writes parts), so its one correction is paid.
    if (call.stage === 'global' && !call.input.correction) return { ...payloadFor(call.input, ask, wide), parts: [structuredClone(base)] };
  }, wide) });
  const wire = await pipeline.call(ask);
  const renders = calls.filter(c => c.stage === 'render');
  assert.equal(renders.length, 12);
  assert.deepEqual(renders.map(c => [c.input.assignment.keyStart, c.input.assignment.keyEnd]),
    [[1, 60], [61, 120], [121, 180], [181, 240], [241, 300], [301, 360], [361, 420], [421, 480], [481, 540], [541, 600], [601, 660], [661, 720]]);
  assert.equal(validateMapReply(wire, ask).parts.length, 36);
  assert.deepEqual(wire.parts.at(-1).claims.map(c => c.key), ['s665', 's666'], 'the twelfth fragment keys its third part from s661');
  const corrected = calls.filter(c => c.stage === 'global' && c.input.correction);
  assert.equal(corrected.length, 1);
  assert.deepEqual(corrected[0].input.correction.issues.filter(x => x.rule === 'plan-relations'), [{ path: 'relations', rule: 'plan-relations', expected: 1, actual: 0, names: ['new:u0 → new:u1'] }]);
  assert.equal(pipeline.describe().deepseekMaxCalls, 24, 'OpenAI rendering: twelve extractions, one correction each');
});

test('.31 host knobs: the plan takes STUDIO_MAP_PLAN_REASONING and STUDIO_MAP_PLAN_TOKENS (high, 16,384), renders STUDIO_MAP_RENDER_TOKENS and the global stages STUDIO_MAP_GLOBAL_TOKENS (8,192 each); reservations count the configured caps', async t => {
  const ask = askFor(), root = await mkdtemp(join(tmpdir(), 'map-plan-knobs-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sent = [], fetchImpl = async (_url, init) => {
    const body = JSON.parse(init.body), isDeepseek = !!body.messages;
    const input = JSON.parse(isDeepseek ? body.messages[1].content : body.input.slice('Return JSON for this input:\n'.length));
    if (!isDeepseek) sent.push({ stage: stageOf(input), effort: body.reasoning?.effort, tokens: body.max_output_tokens, background: body.background === true });
    else sent.push({ stage: stageOf(input), deepseek: true, tokens: body.max_tokens });
    const value = payloadFor(input, ask, originalWire(ask));
    return new Response(JSON.stringify(isDeepseek
      ? { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(value) } }], usage: { prompt_tokens: 10, completion_tokens: 10 } }
      : { status: 'completed', output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(value) }] }], usage: { input_tokens: 10, output_tokens: 10 } }));
  };
  const env = { DEEPSEEK_API_KEY: 'host-test-deepseek-inert', OPENAI_API_KEY: 'host-test-openai-inert' };
  const run = async (name, extra) => {
    sent.length = 0;
    const pipeline = await openFirstMapPipeline({ env: { ...env, ...extra }, dir: join(root, name), fetchImpl });
    try { validateMapReply(await pipeline.call(ask), ask); return { ...pipeline.describe(), identity: pipeline.identity }; } finally { await pipeline.close(); }
  };
  const plain = await run('defaults', {});
  assert.deepEqual([plain.planReasoning, plain.planTokens, plain.renderTokens, plain.globalTokens, plain.planTimeoutMs], ['high', 16384, 8192, 8192, 600000]);
  assert.deepEqual(sent.find(x => x.stage === 'plan'), { stage: 'plan', effort: 'high', tokens: 16384, background: true });
  assert.deepEqual(['render', 'global'].map(stage => sent.find(x => x.stage === stage)), [{ stage: 'render', effort: 'high', tokens: 8192, background: false }, { stage: 'global', effort: 'high', tokens: 8192, background: false }]);
  const tuned = await run('tuned', { STUDIO_MAP_PLAN_REASONING: 'medium', STUDIO_MAP_PLAN_TOKENS: '32768', STUDIO_MAP_RENDER_TOKENS: '12288', STUDIO_MAP_GLOBAL_TOKENS: '16384', STUDIO_MAP_PLAN_TIMEOUT_S: '1200' });
  assert.deepEqual([tuned.planReasoning, tuned.planTokens, tuned.renderTokens, tuned.globalTokens, tuned.planTimeoutMs], ['medium', 32768, 12288, 16384, 1200000]);
  assert.notEqual(tuned.identity, plain.identity, 'the caps are part of the recipe identity');
  assert.deepEqual(sent.find(x => x.stage === 'plan'), { stage: 'plan', effort: 'medium', tokens: 32768, background: true });
  assert.ok(sent.filter(x => x.stage === 'render').length >= 1 && sent.filter(x => x.stage === 'render').every(x => x.effort === 'high' && x.tokens === 12288), 'every render request carries the render cap');
  assert.ok(sent.filter(x => x.stage === 'global').length === 1 && sent.filter(x => x.stage === 'global').every(x => x.effort === 'high' && x.tokens === 16384), 'the global request carries the global cap');
  assert.ok(sent.filter(x => x.deepseek).length >= 1 && sent.filter(x => x.deepseek).every(x => x.tokens === 4096), 'extraction keeps its own cap');
  const saved = JSON.parse(await readFile(join(root, 'tuned', 'first-map', 'pipeline.json'), 'utf8'));
  const [attempt] = Object.values(saved.body.jobs).at(-1).stages.plan.attempts;
  assert.equal(attempt.maxOutputTokens, 32768);
  assert.equal(attempt.reserved, (attempt.inputBytes * 2 + 32768 * 10) * 1000, 'gpt-6.1-sol, reserved from the configured cap');
  const stages = Object.values(saved.body.jobs).at(-1).stages, [render] = stages['render-1'].attempts, [global] = stages.global.attempts;
  assert.deepEqual([render.maxOutputTokens, render.reserved, global.maxOutputTokens, global.reserved], [12288, (render.inputBytes + 12288 * 5) * 1000, 16384, (global.inputBytes + 16384 * 5) * 1000], 'gpt-6.1-terra');
  assert.notEqual(plain.version, undefined);
  // Bounds: one of the transport's efforts; 8,192-65,536 whole tokens. A wrong value opens nothing.
  for (const [extra, code] of [[{ STUDIO_MAP_PLAN_REASONING: 'extreme' }, 'FIRST_MAP_PLAN_REASONING_INVALID'], [{ STUDIO_MAP_PLAN_TOKENS: '8191' }, 'FIRST_MAP_PLAN_TOKENS_INVALID'],
    [{ STUDIO_MAP_PLAN_TOKENS: '65537' }, 'FIRST_MAP_PLAN_TOKENS_INVALID'], [{ STUDIO_MAP_PLAN_TIMEOUT_S: '299' }, 'FIRST_MAP_PLAN_TIMEOUT_INVALID'], [{ STUDIO_MAP_PLAN_TIMEOUT_S: '1801' }, 'FIRST_MAP_PLAN_TIMEOUT_INVALID'], [{ STUDIO_MAP_PLAN_TOKENS: '16384.5' }, 'FIRST_MAP_PLAN_TOKENS_INVALID'], [{ STUDIO_MAP_PLAN_TOKENS: 'many' }, 'FIRST_MAP_PLAN_TOKENS_INVALID'],
    [{ STUDIO_MAP_RENDER_TOKENS: '4095' }, 'FIRST_MAP_RENDER_TOKENS_INVALID'], [{ STUDIO_MAP_RENDER_TOKENS: '32769' }, 'FIRST_MAP_RENDER_TOKENS_INVALID'],
    [{ STUDIO_MAP_GLOBAL_TOKENS: '4095' }, 'FIRST_MAP_GLOBAL_TOKENS_INVALID'], [{ STUDIO_MAP_GLOBAL_TOKENS: 'lots' }, 'FIRST_MAP_GLOBAL_TOKENS_INVALID']])
    await assert.rejects(openFirstMapPipeline({ env: { ...env, ...extra }, dir: join(root, 'bad'), fetchImpl }), new RegExp(`^Error: ${code}$`));
  for (const [tokens, effort, stage] of [['8192', 'none', '4096'], ['65536', 'max', '32768']]) {
    const pipeline = await openFirstMapPipeline({ env: { ...env, STUDIO_MAP_PLAN_TOKENS: tokens, STUDIO_MAP_PLAN_REASONING: effort, STUDIO_MAP_RENDER_TOKENS: stage, STUDIO_MAP_GLOBAL_TOKENS: stage }, dir: join(root, `edge-${tokens}`), fetchImpl });
    const d = pipeline.describe();
    assert.deepEqual([d.planTokens, d.planReasoning, d.renderTokens, d.globalTokens], [Number(tokens), effort, Number(stage), Number(stage)]); await pipeline.close();
  }
  assert.throws(() => createFirstMapPipeline({ store: {}, deepseekKey: 'x', openaiKey: 'y', planReasoning: 'extreme' }), /Invalid map plan reasoning configuration/);
  // Read from the private file like the model names.
  const read = await loadMapPipelineEnv({ STUDIO_OPENAI_ENV: 'inert-plan-test.env' }, async () => 'STUDIO_MAP_PLAN_REASONING=low\nSTUDIO_MAP_PLAN_TOKENS=24576\nSTUDIO_MAP_RENDER_TOKENS=16384\nSTUDIO_MAP_GLOBAL_TOKENS=24576\nSTUDIO_UNASKED=1');
  assert.deepEqual(read, { STUDIO_OPENAI_ENV: 'inert-plan-test.env', STUDIO_MAP_PLAN_REASONING: 'low', STUDIO_MAP_PLAN_TOKENS: '24576', STUDIO_MAP_RENDER_TOKENS: '16384', STUDIO_MAP_GLOBAL_TOKENS: '24576' });
});

test('.31: a render or global reply cut at its cap fails the run as MAP_STAGE_INCOMPLETE with the stage and the cap; the stage stays failed and charged', async t => {
  const { dir, make } = await setup(t), ask = askFor(), calls = []; let cut = 'render';
  const pipeline = make({ renderModel: 'gpt-6.1-terra', renderTokens: 12000, globalTokens: 20000, callProvider: fakeProvider(ask, calls, call => {
    if (call.stage === cut) { cut = null; call.options.onUsage(usage); throw new ApiError('AI_RESPONSE_INCOMPLETE', 502); }
  }) });
  await assert.rejects(pipeline.call(ask), error => error.code === 'MAP_STAGE_INCOMPLETE' && JSON.stringify(error.detail) === JSON.stringify({ stage: 'render-1', phase: 'render', total: 1, cap: 12000 }));
  const stagesOf = async () => Object.values(JSON.parse(await readFile(join(dir, 'pipeline.json'), 'utf8')).body.jobs).at(-1).stages;
  let stages = await stagesOf();
  assert.equal(stages['render-1'].state, 'failed');
  assert.deepEqual([stages['render-1'].attempts[0].maxOutputTokens, stages['render-1'].attempts[0].charged], [12000, (10 * 1 + 10 * 5) * 1000], 'charged from the usage, terra');
  assert.equal(calls.some(c => c.stage === 'global' || c.input.correction), false, 'nothing is retried or corrected');
  // The next run sends the render again; the global stage is cut at its own cap.
  cut = 'global';
  await assert.rejects(pipeline.call(ask), error => error.code === 'MAP_STAGE_INCOMPLETE' && JSON.stringify(error.detail) === JSON.stringify({ stage: 'global', phase: 'global', cap: 20000 }));
  stages = await stagesOf();
  assert.deepEqual([stages['render-1'].state, stages.global.state, stages.global.attempts[0].maxOutputTokens], ['complete', 'failed', 20000]);
  assert.deepEqual(calls.filter(c => c.stage === 'render').map(c => c.options.maxOutputTokens), [12000, 12000]);
  assert.deepEqual(calls.filter(c => c.stage === 'global').map(c => c.options.maxOutputTokens), [20000]);
  validateMapReply(await pipeline.call(ask), ask);
  // The plan stage's cut stays the provider's own code (its cap is STUDIO_MAP_PLAN_TOKENS).
  const s2 = await setup(t), planCalls = [];
  await assert.rejects(s2.make({ callProvider: fakeProvider(ask, planCalls, call => { if (call.stage === 'plan') { call.options.onUsage(usage); throw new ApiError('AI_RESPONSE_INCOMPLETE', 502); } }) }).call(ask), matchesCode('AI_RESPONSE_INCOMPLETE'));
});

// ---- first-map-divided.32: sixteen claims a part, the plan items that must land (plan-claims) in the render and global corrections,
// the final wire's diagnostics on the global stage record, the row-level, payload and hedge rules (fake providers only). ----
test('.32 rule sentences: sixteen claims a first-map part, a table row one claim, the summary money facts on the engine, withdrawals on their 부분 이름 part, one payload list, the record\'s own hedge', async () => {
  const P = await import('../server/map-pipeline.mjs'), B = await import('../server/map-blueprint.mjs');
  assert.deepEqual([P.PIPELINE_RECIPE, P.LATER_PIPELINE_RECIPE], ['first-map-divided.41', 'later-map-divided.41']);
  for (const rule of ['그 행의 「부분 이름」 칸(없으면 첫 칸)이 이름 붙인 부분에 맡긴다', '「엔진 | 매일 FLAT 재시작 | 채택 안 함」은 → 엔진이며', '한 부분에 맡기는 항목 수는 줄이지 않는다(첫 지도의 부분은 주장을 20개까지 쓴다)',
    '연결 행의 「넘기는 것」 칸은 산출물 이름 목록 하나이며 부분이 아니다', '산출물 표에 그 파일의 행이 있을 때만 그 저장소 부분을 거친다', '「new:facts_refresh → new:engine: fee_policy·calendar.json」']) assert.ok(B.MAP_BLUEPRINT_PROMPT.includes(rule), rule);
  for (const gone of ['돌고 있는 부분에 맡기는 정정·철회·모름은 둘까지로 한다', '넘치는 철회는 원문이 대신 둔 것을 맡은 부분', '기록의 화살표가 파일 이름(calendar.json 같은)을 넘기는 것으로 적은 흐름도 그 파일의 저장소 부분을 거친다'])
    assert.ok(!B.MAP_BLUEPRINT_PROMPT.includes(gone), gone);
  for (const rule of ['첫 지도(INPUT.parts가 비어 있음)에서 20개까지, 그 밖에는 6개까지', '표 행 하나는 주장 하나다', '「쉼 사유의 96 %가 NONE_SIDE」)은 그 행의 부분 이름 칸이 이름 붙인 부분의 topic=defect',
    '「끄기 줄 결판 또는 −8 USDT | 해당 칸을 끈다」)은 그 행의 부분의 kind=want·topic=plan 주장 하나다', '「e=1.00 실거래를 켜 첫 사이클 −0.433 USDT」', '그 상태 문장을 role이나 basis에만 두지 않는다',
    '그것을 대신한 감시를 맡은 LIVE-WATCH의 것이 아니다', '표의 부분 이름 칸이 이 부분이면 이 부분이 쓴다', '「엔진 | 08:49Z 뒤 실제 상태」', '(「08:49Z 뒤 미확인」)을 붙여 지금도 확실히 도는 것처럼 쓰지 않는다',
    '어느 주장도 인용하지 않은 항목은 진단(plan-claims)에 남는다', '단, 그 항목이 인용한 표 행의 부분 이름 칸(첫 칸)이 이 부분이면 표가 우선하여 이 부분이 쓴다']) assert.ok(P.RENDER_RULES.includes(rule), rule);
  assert.ok(!P.RENDER_RULES.includes('이 분할 작성에서는 부분마다 claims를 6개까지 쓸 수 있다'), 'the old six is gone from the first map');
  for (const rule of ['첫 문장에 그 기록 자신의 한정(「08:49Z 뒤 미확인」)을 반드시 붙이며', '보고된 가동을 지금도 확실히 도는 것처럼 쓰지 않는다', 'payload에 칸 그대로(「fee_policy·calendar.json」) 한 번에 쓰고',
    '기록의 산출물 표에 행이 없는 파일(calendar.json)은 저장소 없이 그 한 선의 payload로 둔다']) assert.ok(P.GLOBAL_RULES.includes(rule), rule);
  for (const rule of ['claims는 최대4개(분할 작성은 첫 지도 20개, 그 밖 6개)', 'plan-claims이면 names의 「ref: 항목 앞부분」마다', '실제 변화·오류·철회·가장 자신 없는 것 행을']) assert.ok(P.CORRECTION_RULES.includes(rule), rule);
  assert.ok(P.FIRST_GLOBAL_RULES.includes('부분마다 주장 수에 상한(20개)이 있어'));
});

test('.32: a render correction hears its own parts\' plan items no claim quotes; the global stage record keeps the final wire\'s diagnostics, which a reopened store reads', async t => {
  const { dir, make } = await setup(t), ask = askFor(), calls = [];
  const item = { kind: 'condition', text: '중간 조건: 개발용 판본에만 적용한다 → new:flow', at: [ask.records[0].spans[2].s] };
  const pipeline = make({ callProvider: fakeProvider(ask, calls, call => {
    if (call.stage === 'plan') { const plan = blueprintFor(originalWire(ask), ask); plan.global.push(item); return plan; }
    // A structural first pass (a claim key outside the fragment's range) pays the fragment's one correction.
    if (call.stage === 'render' && !call.input.correction) { const fragment = payloadFor(call.input, ask, originalWire(ask)); fragment.parts[0].claims[0].key = 's801'; return fragment; }
    if (call.stage === 'global') return { ...payloadFor(call.input, ask, originalWire(ask)), summary: '어느 주장도 받치지 않는 요약 문장입니다.' };
  }) });
  const { wire } = await pipeline.read(ask);
  const name = `new:flow: ${item.text.slice(0, 40)}`;
  const corrected = calls.filter(c => c.stage === 'render' && c.input.correction);
  assert.equal(corrected.length, 1);
  assert.deepEqual(corrected[0].input.correction.issues.filter(x => x.rule === 'plan-claims'), [{ path: 'parts', rule: 'plan-claims', expected: 1, actual: 0, names: [name] }]);
  assert.equal(wire.parts[0].claims.length, 2);
  const text = await readFile(join(dir, 'pipeline.json'), 'utf8'), stages = Object.values(JSON.parse(text).body.jobs).at(-1).stages;
  assert.deepEqual(stages.global.diagnostics, [{ path: 'parts', rule: 'plan-claims', expected: 1, actual: 0, names: [name] },
    { path: 'summary', rule: 'unbacked', expected: 0, actual: 1, names: [] }]);
  assert.equal(Object.hasOwn(stages['render-1'], 'diagnostics'), false, 'a render stage keeps none');
  // The kept record reads back; a diagnostic outside its fixed shape marks the store damaged.
  const { writeFile } = await import('node:fs/promises');
  const copy = await mkdtemp(join(tmpdir(), 'map-pipeline-test-')), bad = await mkdtemp(join(tmpdir(), 'map-pipeline-test-'));
  t.after(async () => { await rm(copy, { recursive: true, force: true }); await rm(bad, { recursive: true, force: true }); });
  await writeFile(join(copy, 'pipeline.json'), text);
  const reopened = await openMapPipelineStore({ dir: copy, monthlyUsd: 20, runUsd: 1 });
  assert.equal(reopened.describe().durable, true);
  await reopened.close();
  // Re-signed with the store's own digest, so only the shape of the diagnostic can make it damaged.
  const { createHash } = await import('node:crypto');
  const resigned = JSON.parse(text); resigned.sha256 = createHash('sha256').update(JSON.stringify(resigned.body)).digest('hex');
  assert.equal(resigned.sha256, JSON.parse(text).sha256, 'the digest is the store\'s own');
  const damaged = JSON.parse(text); Object.values(damaged.body.jobs).at(-1).stages.global.diagnostics[0].names = ['줄\n바꿈'];
  damaged.sha256 = createHash('sha256').update(JSON.stringify(damaged.body)).digest('hex');
  await writeFile(join(bad, 'pipeline.json'), JSON.stringify(damaged));
  const refused = await openMapPipelineStore({ dir: bad, monthlyUsd: 20, runUsd: 1 });
  assert.deepEqual([refused.describe().durable, refused.describe().problem], [false, 'STORE_UNAVAILABLE']);
  await refused.close();
});

// ---- first-map-divided.33: map-reading.10 (a rule's scope, places and devices, a withdrawal's kind, a gate's kind) in the render
// and correction rules, with the recipe identity bumped. ----
test('.33 rule sentences: a rule\'s scope from its row, places only from lines that place it, devices from the condition row, a gate line, a person or 「기록상 미설계」, a withdrawal\'s kind from its content, a gate run or dev', async () => {
  const P = await import('../server/map-pipeline.mjs');
  assert.deepEqual([P.PIPELINE_RECIPE, P.LATER_PIPELINE_RECIPE], ['first-map-divided.41', 'later-map-divided.41']);
  for (const rule of ['topic이 rule인 주장(기록의 「지켜야 할 것」 표의 행 하나이며 claim.at은 그 행이다)에는 scope·scopeName·anchors·enforcedBy를 더한다',
    'part(그 행의 부분 이름 칸이 이름 붙인 부분 전체이며 기본값이다)', 'project(행의 부분 이름 칸이 「전체」일 때만)', '「돈 안전」 같은 말만으로 project로 올리지 않는다',
    'anchors는 그 규칙이 적용되는 자리를 놓는 원문 줄에서만 최대 4개이며', '「조건·거부·분기」 표에서 이 규칙을 구현하는 조건 행', '그 규칙을 직접 지키는 행)이 그 자리이며 at은 그 행이다',
    '규칙을 적은 줄과 자리를 적은 줄이 따로 있으면 inferred다', '자리를 놓는 줄이 없으면 anchors는 []다', '이름이 비슷하다는 이유로 자리를 짐작하지 않는다',
    'text는 그 행의 「참이면」 결과', '관문 줄(「TESTS rc 0 + VERIFY GO 파일」 같은)이 지키면 gate', '사람의 승인·규칙(소유자·감독자 세션의 승인)이 지키면 person',
    '「기록상 미설계」처럼 지키는 장치가 없다고 명시하면 none', '[{"kind":"unknown","text":"장치 미상","at":null}] 하나다', '장치(code·gate·person)와 none·unknown을 함께 쓰지 않는다',
    'topic이 withdrawn인 주장(「철회·변경」 표의 행)에는 withdrawalKind를 더한다', '꼬리표만 보고 정하지 않고 그 행의 내용이 그렇게 말할 때만 쓰고 아니면 null이다',
    '「다음 관문」 표의 행으로 쓴 topic=plan 주장에는 gate를 더한다', '운영 조건)이면 run', '개발·배포 조건)이면 dev', 'rule이 아닌 주장의 scope는 null, anchors와 enforcedBy는 []이고',
    '틀린 자리·장치는 그 항목 하나만', '"anchors":[{"kind":"inferred","text":"엔진 · not 1 <= stop <= 250","at":"N02.40"}]', '"enforcedBy":[{"kind":"code","text":"STOP_NOT_RESIDENT","at":"N02.40"}]',
    '"withdrawalKind":"design"', '"gate":"run"']) assert.ok(P.RENDER_RULES.includes(rule), rule);
  for (const rule of ['claim의 topic·evidence·when·where·before와 scope·scopeName·anchors·enforcedBy·withdrawalKind·gate', 'category가 scope이면', 'anchor이면 그 자리를 그것을 놓는 원문 줄로 다시 고르거나 빼며',
    'enforced-by이면', 'withdrawal-kind나 gate이면', '어느 경우에도 주장 자체는 지우지 않는다']) assert.ok(P.CORRECTION_RULES.includes(rule), rule);
  // The new sentences go to the render stage only: the global stage writes no part.
  for (const rule of ['withdrawalKind', 'enforcedBy']) assert.ok(!P.GLOBAL_RULES.includes(rule), rule);
});

// ---- first-map-divided.33 (from the blind judging of the .32 KORU map): one source of inputs and outputs, a global correction for
// undrawn lines, one plan item a table row, twenty claims a part, no claim restating a step or the role (fake providers only). ----
test('.33 rule sentences from the .32 judging: io from one source, a plan item one table row, twenty claims, no claim restating a step or the role; the lines correction costs about $0.07', async () => {
  const P = await import('../server/map-pipeline.mjs'), B = await import('../server/map-blueprint.mjs'), M = await import('../dist/public/shared/map-reading.js');
  assert.deepEqual([P.LINES_CORRECTION_USD, M.MAP6_CLAIMS, B.FRAGMENT_KEYS, B.PLAN_CLAIM_TEXT], [0.07, 20, 60, 120]);
  for (const rule of ['inputs·outputs는 부분마다 한 출처에서만 쓴다', '그 표에 이 부분의 행이 없을 때만 연결 표에서', '둘을 함께 쓰지 않는다', 'allowed_side·valid_until)은 산출물이 아니므로',
    '(「review 행」을 「review」로 쓰지 않는다)', '짝 저장소(이 부분과 선으로 이어진 저장소 부분)의 필드와 같은 항목', '주장은 이 부분의 단계 행(steps의 does)이나 role 문장을 되풀이하지 않는다',
    '첫 지도(INPUT.parts가 비어 있음)에서 20개까지']) assert.ok(P.RENDER_RULES.includes(rule), rule);
  for (const rule of ['한 항목은 원문 표 행 하나다', '여러 행을 한 항목에 묶지 않는다', '그 행을 맡을 부분의 at에 그 행을 두어 맡긴다', '(첫 지도의 부분은 주장을 20개까지 쓴다)'])
    assert.ok(B.MAP_BLUEPRINT_PROMPT.includes(rule), rule);
  assert.ok(!B.MAP_BLUEPRINT_PROMPT.includes('규칙·모름 행 여럿은 한 항목에 묶고'), 'the old combining sentence is gone');
  assert.ok(P.FIRST_GLOBAL_RULES.includes('부분마다 주장 수에 상한(20개)이 있어'));
  assert.ok(P.CORRECTION_RULES.includes('(분할 작성은 첫 지도 20개, 그 밖 6개)'));
});

test('.33: a first map\'s global first pass that leaves a plan relation item undrawn pays one correction, which hears it by name; the correction is taken as it is', async t => {
  const ask = askFor(), base = originalWire(ask).parts[0];
  const two = { ...originalWire(ask), parts: [0, 1].map(i => ({ ...structuredClone(base), ref: `new:u${i}`, name: `단위 ${i}` })), relations: [] };
  const { make } = await setup(t), calls = [];
  const pipeline = make({ renderModel: 'gpt-6.1-terra', callProvider: fakeProvider(ask, calls, call => {
    if (call.stage === 'plan') { const plan = blueprintFor(two, ask); plan.global.push({ kind: 'relation', text: 'new:u0 → new:u1: 작업 큐', at: [ask.records[0].spans[0].s] }); return plan; }
  }, two) });
  const wire = await pipeline.call(ask);
  const globals = calls.filter(c => c.stage === 'global');
  assert.deepEqual(globals.map(c => !!c.input.correction), [false, true], 'one paid correction, never a second');
  assert.deepEqual(globals[1].input.correction.issues.filter(x => x.rule === 'plan-relations'), [{ path: 'relations', rule: 'plan-relations', expected: 1, actual: 0, names: ['new:u0 → new:u1'] }]);
  assert.deepEqual(wire.relations, [], 'the correction that still draws no line is taken as it is');
  assert.equal(validateMapReply(wire, ask).parts.length, 2);
});

// ---- first-map-divided.34 (from the blind judging of the .33 KORU map, signs 8/10): the condition rows the render hears, the
// devices it may say, one kept state per 「·」 item, a hand-over to the next sha an implementation, and one render correction for a
// plan item lost under the cap (fake providers only; no model quality is claimed). ----
test('.34 rule sentences: anchors cite one of the program\'s condition rows or stay [], code only from a condition or file-map row, unknown where the record does not know the device, one kept state per 「·」 item, DROP an implementation', async () => {
  const P = await import('../server/map-pipeline.mjs');
  assert.deepEqual([P.PIPELINE_RECIPE, P.LATER_PIPELINE_RECIPE], ['first-map-divided.41', 'later-map-divided.41']);
  for (const rule of ['입력의 conditions는 프로그램이 원문에서 옮겨 둔 목록이다', '{"at":"그 행의 구간 별칭","condition":"조건 칸","then":"참이면 칸","else":"거짓이면 칸(없으면 null)"}',
    'anchors는 규칙의 말이 conditions 한 행의 조건·결과와 맞을 때', '그 행을 at으로 인용하고, 그렇지 않으면 []다', '프로그램 후보로 따로 붙이고 모델의 답과 구별해 표시하므로',
    'code는 그 at이 「조건·거부·분기」 표의 행이거나 「파일 지도」 표의 행일 때만 쓴다', 'code이고 text는 그 행의 then이다',
    '그 장치가 코드 조건인지 운영 판단인지 모른다고(모름·추정) 적으면 person·gate가 아니라', '그 밖의 줄에서 person은 그 규칙 줄이 승인·지정하는 사람을 이름 댈 때만 쓴다',
    '이 부분의 claims가 20개보다 적은 동안 빼지 않고 행마다 주장 하나로 쓴다', '한 칸 안에서 「·」로 나뉜 항목은 각각 다른 상태 하나다', 'extend·wake·recard 세 stateVars이고',
    '그 칸이 「/일」이라고 적으면 그 항목마다 scope는 「하루」다', '「다음 sha로 넘김」·「DROP」한 행은 그 행이 설계가 바뀌었다고 말하지 않는 한 design이 아니라 implementation이다'])
    assert.ok(P.RENDER_RULES.includes(rule), rule);
  for (const rule of ['enforced-by의 code는 「조건·거부·분기」 행이나 「파일 지도」 행을 at으로 인용할 때만 쓰고', 'render의 plan-claims는 주장이 20개보다 적은 부분의 항목을 다시 쓰라는 뜻이며'])
    assert.ok(P.CORRECTION_RULES.includes(rule), rule);
  for (const rule of ['conditions', 'stateVars']) assert.ok(!P.GLOBAL_RULES.includes(rule), rule);
});

const conditionAsk = () => validateMapAsk({ schemaVersion: 'studio.map.6', project: { name: '자료 흐름', purpose: null }, parts: [], relations: [], requests: [], priors: [],
  records: [
    { id: 'N01', kind: 'pasted', note: '', basis: '앞쪽 기록', ...encodeSpans('N01', ['입력기는 프로젝트 문서를 받아 작업 큐에 전달합니다.', '처음에는 모든 자료를 영구 저장한다고 설명했습니다.', '중간 조건: 개발용 판본에만 적용합니다.', '원문 기록은 변경 없이 보존합니다.',
      '5. 조건·거부·분기', '| 부분 이름 | 조건 | 참이면 | 거짓이면 |', '|---|---|---|---|', '| 자료 처리 | not queue_ready | QUEUE_EMPTY | 다음 |', '| 다른 부분 | x > 1 | X_OVER | 다음 |'].join('\n')) },
    askFor().records[1]],
});

test('.34: each render hears its parts\' 「조건·거부·분기」 rows (alias, 조건, 참이면) under conditions; a first pass losing a plan item under the cap pays one correction that hears it', async t => {
  const ask = conditionAsk(), spans = ask.records[0].spans, row = spans.find(s => s.t.startsWith('| 자료 처리')).s;
  const { make } = await setup(t), calls = [];
  const pipeline = make({ renderModel: 'gpt-6.1-terra', callProvider: fakeProvider(ask, calls, call => {
    if (call.stage === 'plan') { const plan = blueprintFor(originalWire(ask), ask); plan.global.push({ kind: 'condition', text: '개발용 판본에만 적용 → new:flow', at: [spans[2].s] }); return plan; }
  }) });
  const wire = await pipeline.call(ask);
  const renders = calls.filter(c => c.stage === 'render');
  assert.deepEqual(renders.map(c => c.input.conditions), [{ 'new:flow': [{ at: row, condition: 'not queue_ready', then: 'QUEUE_EMPTY', else: '다음' }] }, { 'new:flow': [{ at: row, condition: 'not queue_ready', then: 'QUEUE_EMPTY', else: '다음' }] }],
    'only its own part\'s rows, the program\'s copy of the record');
  assert.deepEqual(renders.map(c => !!c.input.correction), [false, true], 'one paid correction for the lost plan item, never a second');
  // .35: the part's own 「조건·거부·분기」 row is a unit of its own too (the program reads the part's rows by its name).
  assert.deepEqual(renders[1].input.correction.issues.filter(x => x.rule === 'plan-claims').map(x => x.names), [['new:flow: 개발용 판본에만 적용 → new:flow', 'new:flow: 자료 처리 | not queue_ready | QUEUE_EMPTY | 다음']]);
  assert.equal(wire.parts[0].claims.length, 2, 'the correction that still leaves it out is taken as it is');
  assert.equal(validateMapReply(wire, ask).parts.length, 1);
  // Without condition rows the key is there and empty.
  const plainCalls = [], { make: again } = await setup(t);
  await again({ renderModel: 'gpt-6.1-terra', callProvider: fakeProvider(askFor(), plainCalls) }).call(askFor());
  assert.deepEqual(plainCalls.filter(c => c.stage === 'render').map(c => c.input.conditions), [{}]);
});

// ---- first-map-divided.34 (the first .34 KORU run ended at render-1-correction, $0.53, for one wrong-part claim that left 소유자
// with none): a correction reply is read as leniently as the first pass; an item-level fault is set aside with its reason, and only
// what is structural fails the run (fake providers only). ----
test('.34: a render correction reply whose one claim is wrong-part (its part left with none) is accepted with that claim set aside; no further call', async t => {
  const text = ['2. 부분', '| 이름 | 하는 일 |', '|---|---|', '| 입력기 | 프로젝트 문서를 작업 큐에 전달한다 |', '| 통합기 | 작업 큐를 읽어 전체 조건을 대조한다 |'].join('\n');
  const ask = validateMapAsk({ ...askFor(), records: [{ id: 'N01', kind: 'pasted', note: '', basis: '부분 표', ...encodeSpans('N01', text) }, askFor().records[1]] });
  const row = head => ask.records[0].spans.find(s => s.t.startsWith(head)).s;
  const part = (ref, name, head, claimHead, key) => ({ ref, name, parent: null, role: `${name}의 책임`, roleAbout: null, roleReplaces: null, basis: [row(head)],
    claims: [{ kind: 'describes', text: `${name}의 원문 행을 옮긴다.`, at: row(claimHead), about: null, replaces: null, key }] });
  // 입력기's one claim quotes 통합기's row: wrong-part, and 입력기 is left with no claim.
  const wire = { summary: '입력기와 통합기를 읽었다.', relations: [], candidates: [], gaps: [], matches: [], material: [],
    parts: [part('new:in', '입력기', '| 입력기', '| 통합기', 's1'), part('new:merge', '통합기', '| 통합기', '| 통합기', 's2')] };
  const { make } = await setup(t), calls = [];
  const { wire: out, exclusions } = await make({ renderModel: 'gpt-6.1-terra', callProvider: fakeProvider(ask, calls, () => {}, wire) }).read(ask);
  const renders = calls.filter(c => c.stage === 'render');
  assert.deepEqual(renders.map(c => !!c.input.correction), [false, true], 'the first pass is refused for the emptied part; the one correction is read and never a third render');
  assert.deepEqual(renders[1].input.correction.issues.filter(x => x.category === 'wrong-part').map(x => x.path), ['parts[0].claims[0]']);
  assert.deepEqual(calls.filter(c => c.stage === 'global').length, 1, 'the run goes on to the global stage');
  assert.deepEqual(exclusions.map(x => [x.path, x.rule, x.category]), [['parts[0].claims[0]', 'contract', 'wrong-part']]);
  assert.deepEqual(out.parts.map(p => [p.ref, p.claims.map(c => c.key)]), [['new:in', []], ['new:merge', ['s2']]], 'the part stays on its basis with no claim');
  const read = validateMapReply(out, ask);
  assert.equal(M.setAside(read).length, 0);
  M.attachExclusions(read, exclusions, ask);
  assert.deepEqual(M.readingExclusions(read).map(x => x.category), ['wrong-part']);
});

// ---- first-map-divided.35 (from the .34 run and its ledger): the final review hears an undrawn line as the global stage does, the
// rule sentences of the .35 batch, and the run's end reading lost responses back for the ledger (fake providers only). ----
test('.35: a first map\'s final review (global-final) that leaves a plan relation item undrawn pays one correction, which hears it by name; the correction is taken as it is', async t => {
  const ask = askFor(), base = originalWire(ask).parts[0];
  const two = { ...originalWire(ask), parts: [0, 1].map(i => ({ ...structuredClone(base), ref: `new:u${i}`, name: `단위 ${i}` })), relations: [] };
  const { make } = await setup(t), calls = [], stages = [];
  const pipeline = make({ renderModel: 'gpt-6.1-terra', onStageOutput: output => stages.push(output.stage), callProvider: fakeProvider(ask, calls, call => {
    if (call.stage === 'plan') { const plan = blueprintFor(two, ask); plan.global.push({ kind: 'relation', text: 'new:u0 → new:u1: 작업 큐', at: [ask.records[0].spans[0].s] }); return plan; }
    if (call.stage === 'global' && !call.input.semanticReview) return revisionFor(ask, 'new:u0');
  }, two) });
  const wire = await pipeline.call(ask);
  const finals = calls.filter(c => c.stage === 'global' && c.input.semanticReview);
  assert.deepEqual(finals.map(c => !!c.input.correction), [false, true], 'one paid correction of the final review, never a second');
  assert.deepEqual(finals[1].input.correction.issues.filter(x => x.rule === 'plan-relations'), [{ path: 'relations', rule: 'plan-relations', expected: 1, actual: 0, names: ['new:u0 → new:u1'] }]);
  assert.ok(stages.includes('global-final-correction'));
  assert.deepEqual(wire.relations, [], 'the correction that still draws no line is taken as it is');
  assert.equal(validateMapReply(wire, ask).parts.length, 2);
  // A final review that draws every line pays nothing more.
  const drawn = [], { make: again } = await setup(t);
  await again({ renderModel: 'gpt-6.1-terra', callProvider: fakeProvider(ask, drawn, call => {
    if (call.stage === 'plan') { const plan = blueprintFor(two, ask); plan.global.push({ kind: 'relation', text: 'new:u0 → new:u1: 작업 큐', at: [ask.records[0].spans[0].s] }); return plan; }
    if (call.stage === 'global' && !call.input.semanticReview) return revisionFor(ask, 'new:u0');
    if (call.stage === 'global') return { ...structuredClone({ ...two, parts: [] }), relations: [{ from: 'new:u0', to: 'new:u1', kind: 'flow', note: '작업 큐를 넘긴다.', at: ask.records[0].spans[0].s }] };
  }, two) }).call(ask);
  assert.deepEqual(drawn.filter(c => c.stage === 'global' && c.input.semanticReview).map(c => !!c.input.correction), [false]);
});

test('.35 rule sentences: a condition row is the rule\'s place and stated only on its own row or written in it, the program\'s places read file-map rows and settings, a shared noun on every 「·」 item, every 「·」 state item, no claim restating a connection row, loop-missing and settings in the correction', async () => {
  const P = await import('../server/map-pipeline.mjs');
  assert.deepEqual([P.PIPELINE_RECIPE, P.LATER_PIPELINE_RECIPE], ['first-map-divided.41', 'later-map-divided.41']);
  for (const rule of ['kind=stated는 그 자리 줄이 규칙 주장 자신의 at과 같은 행이거나 규칙 행이 그 자리 행의 칸(조건이나 「STOP_NOT_RESIDENT」 같은 결과)을 글자 그대로 적을 때만 쓰고',
    '그 밖의 stated는 지도가 inferred로 읽고 진단 anchor-kind에 남긴다', '같은 부분의 조건 행·「파일 지도」 행·「부분별 설계」 설정 칸 가운데 낱말이 겹치는 것을 프로그램 후보로',
    '그 명사를 앞 항목마다 붙인다(「review 행」·「policy 행」·「state 행」', '이 부분의 「부분별 설계」 칸 항목의 앞부분만 쓴 항목(「review 행」 자리의 「review」)은 지도에서 빠진다',
    '칸의 「·」 항목 하나하나가 상태 변수 하나이며 하나도 빼지 않는다', '「팔당 16회/일 넘으면 DAILY_CAP」의 팔당 호출 수도 stateVars 하나다(scope 「하루」)',
    '연결 표의 행(보내는 부분 | 받는 부분)은 관계가 맡으므로 그 행을 인용해 넘기는 것·박자만 다시 말하는 status·how 주장은 쓰지 않는다',
    '"anchors":[{"kind":"inferred","text":"엔진 · not 1 <= stop <= 250","at":"N02.40"}]']) assert.ok(P.RENDER_RULES.includes(rule), rule);
  assert.ok(!P.RENDER_RULES.includes('"anchors":[{"kind":"stated","text":"엔진 · not 1 <= stop <= 250"'), 'the old stated example is gone');
  assert.ok(!P.RENDER_RULES.includes('kind=stated이고 at은 그 행이다'), 'the old sentence making a condition row stated is gone');
  for (const rule of ['「부분별 설계」 칸의 설정·상태 항목(「이름 | 설정 | 항목」)은 그 부분의 config나 stateVars 항목 하나씩이다', 'loop-missing이면 names의 부분마다 기록이 그 부분이 반복한다고 적은 행(「매분 tick」 같은)을 at으로 loop를 쓴다'])
    assert.ok(P.CORRECTION_RULES.includes(rule), rule);
  for (const rule of ['anchor-kind', '공통 명사']) assert.ok(!P.GLOBAL_RULES.includes(rule), rule);
});

test('.35: a run ends by reading its store\'s lost responses back once for the ledger; the pipeline\'s reconcile does the same later, and a cancelled run does not', async t => {
  let clock = Date.parse('2026-11-03T18:00:00Z');
  const { store, make } = await setup(t, {}, { now: () => new Date(clock) }), ask = askFor(), seen = [];
  // Another run's plan lost in background mode (its POST returned the id, nothing came back after).
  const other = 'a'.repeat(64);
  await store.run(other, async () => { await store.begin(other, 'plan', { provider: 'openai', model: 'gpt-6.1-sol', inputBytes: 1000, maxOutputTokens: 1000 }); await store.noteResponse(other, 'plan', 'resp_other'); await store.failed(other, 'plan', { uncertain: true }); });
  const before = store.describe().spentUsd;
  const fetchImpl = async (url, init) => {
    seen.push(`${init?.method ?? 'GET'} ${url}`);
    if (url === 'https://api.openai.com/v1/responses/resp_other') return new Response(JSON.stringify({ id: 'resp_other', status: 'cancelled', usage: { input_tokens: 900, output_tokens: 0 } }));
    return new Response('{}');
  };
  // A cancelled run reads nothing back.
  const controller = new AbortController(); controller.abort();
  await assert.rejects(make({ fetchImpl, callProvider: fakeProvider(ask, []) }).call(ask, controller.signal), matchesCode('CANCELLED'));
  assert.deepEqual(seen, []);
  validateMapReply(await make({ fetchImpl, callProvider: fakeProvider(ask, []) }).call(ask), ask);
  assert.deepEqual(seen.filter(s => s.includes('resp_other')), ['GET https://api.openai.com/v1/responses/resp_other'], 'one free GET at the run\'s end');
  // The lost plan now costs what its response reports (900 input tokens at $2 per million); the month counts it so, beside this
  // run's own plan (10 in, 10 out).
  assert.equal(before, 0.012);
  assert.equal(store.spentByRun(other), 0.0018);
  assert.equal(Math.round(store.describe().spentUsd * 1e9), 900 * 2 * 1000 + (10 * 2 + 10 * 10) * 1000);
  // Later, on its own: nothing lost is left, so nothing is read.
  const pipeline = make({ fetchImpl, callProvider: fakeProvider(ask, []) });
  assert.deepEqual(await pipeline.reconcile(), []);
  assert.equal(seen.filter(s => s.includes('resp_other')).length, 1);
});

// ---- first-map-divided.36 (map-reading.12, from the blind judging of the .35 KORU and web-app maps): a plan standing two store parts on
// one 있는 곳 pays one plan correction that hears the fold, and the rule sentences of the .36 batch (fake providers only; the rows are
// the web app's design record rows, copied as written). ----
const storeAsk = () => validateMapAsk({ schemaVersion: 'studio.map.6', project: { name: '모아배송', purpose: null }, parts: [], relations: [], requests: [], priors: [],
  records: [{ id: 'N01', kind: 'pasted', note: '', basis: '설계 기록', ...encodeSpans('N01', ['1. 부분 유형', '| 이름 | 유형 | 한 줄 |', '|---|---|---|',
    '| 주문 API | 루프·엔진 | 요청마다 처리하는 express 서버 [파일: A/server.ts] |', '| orders 테이블 | 행 파일·저장소 | Postgres orders와 딸린 표 [파일: M/] |',
    '2. 산출물', '| 이름 | 필드 | 만드는 부분 | 읽는 부분 | 있는 곳 | 꼬리표 |', '|---|---|---|---|---|---|',
    '| orders 행 | id·shop_id·status·amount·items·address·phone·payment_id·paid_at·refunded_at·created_at·updated_at | 주문 API·결제 웹훅 수신기·작업자 | 작업자·정산 배치·관리자 화면 | orders 테이블 | [파일: M/0001_orders.sql] |'].join('\n')) },
    askFor().records[1]] });

test('.36: a first map\'s plan standing two store parts on one place pays one plan correction that hears the fold; the correction is taken as it is and the combined wire leaves the duplicate out', async t => {
  const P = await import('../server/map-pipeline.mjs');
  const ask = storeAsk(), at = head => ask.records[0].spans.find(s => s.t.startsWith(head)).s;
  const part = (ref, name, head, extra = {}) => ({ ref, name, parent: null, role: `${name}의 책임`, roleAbout: null, roleReplaces: null, basis: [at(head)],
    claims: [{ kind: 'describes', text: `${name}의 행을 옮긴다.`, at: at(head), about: null, replaces: null, key: 's1' }], ...extra });
  const wire = { ...originalWire(ask), gaps: [], parts: [part('new:api', '주문 API', '| 주문 API'), part('new:table', 'orders 테이블', '| orders 테이블', { type: 'store', typeAt: at('| orders 테이블') }),
    part('new:rows', 'orders 행', '| orders 행', { type: 'store', typeAt: at('| orders 행') })] };
  const { make } = await setup(t), calls = [];
  const result = await make({ renderModel: 'gpt-6.1-terra', targetChars: 3500, callProvider: fakeProvider(ask, calls, () => undefined, wire) }).read(ask);
  const plans = calls.filter(c => c.stage === 'plan');
  assert.deepEqual(plans.map(c => !!c.input.correction), [false, true], 'one paid plan correction, never a second');
  assert.deepEqual(plans[1].input.correction.issues.find(x => x.rule === 'store-dup'), { path: 'parts', rule: 'store-dup', expected: 0, actual: 1, names: ['orders 행 → orders 테이블'] });
  assert.equal(plans[1].options.system, (await import('../server/map-blueprint.mjs')).MAP_BLUEPRINT_PROMPT + P.PLAN_CORRECTION_RULES);
  assert.deepEqual(result.wire.parts.map(p => p.ref), ['new:api', 'new:table'], 'the correction that still folds nothing is taken as it is');
  assert.deepEqual(result.exclusions.filter(x => x.category === 'store-dup').map(x => x.path), ['parts[2]']);
  assert.equal(validateMapReply(result.wire, ask).parts.length, 2);
  // A plan holding one store per place pays nothing more.
  const one = { ...wire, parts: wire.parts.slice(0, 2) }, again = [], { make: other } = await setup(t);
  await other({ renderModel: 'gpt-6.1-terra', targetChars: 3500, callProvider: fakeProvider(ask, again, () => undefined, one) }).read(ask);
  assert.deepEqual(again.filter(c => c.stage === 'plan').map(c => !!c.input.correction), [false]);
});

test('.36 rule sentences: condition rows to conditions outside the cap and the cap\'s priority, artifacts folded into their place\'s store, a self row\'s two lines, a line\'s kind by its artifact, a loop unit\'s words, the shared noun, recorded lines only', async () => {
  const P = await import('../server/map-pipeline.mjs'), B = await import('../server/map-blueprint.mjs');
  assert.deepEqual([P.PIPELINE_RECIPE, P.LATER_PIPELINE_RECIPE], ['first-map-divided.41', 'later-map-divided.41']);
  for (const rule of ['설계 기록의 「조건·거부·분기」 표의 행은 claims가 아니라 그 부분의 conditions에 행마다 하나씩 쓴다',
    '{"when":"조건 칸","then":"참이면 칸","else":"거짓이면 칸(칸이 없거나 비면 null)","at":"그 행 한 줄의 구간 별칭"}', 'conditions는 claims 20개 상한 밖이므로 조건 행 때문에 기록 행을 빼지 않는다',
    '조건 행을 주장으로 다시 쓰지 않는다(conditions가 같은 행을 가지면 그 주장은 지도에서 빠진다, restate)',
    '그래도 그 부분의 행이 20개보다 많으면 이 순서로 남기고 뒤에서부터 뺀다: 실거래 상태 → 철회 → 오류 수치 → 규칙 → 모름·가장 자신 없는 것 → 실제 변화 → 설계 설명',
    '규칙 주장의 anchors·enforcedBy가 이미 인용한 행(「조건·거부·분기」·「파일 지도」 행)은 따로 주장으로 쓰지 않는다',
    '저장소 부분은 「있는 곳」 하나에 하나다', 'outputs에는 접힌 산출물 행 이름을 산출물 표 순서대로 모두(최대 8개)',
    'unit은 시간·사건 단위만 쓴다', '「없으면 다시 읽기」처럼 다시 도는 조건은 resume에', 'state가 retired·unbuilt인 부분의 loop는 null이다',
    '「재진입 간격」처럼 기다림만 말하는 줄은 반복이 아니다', '설정 칸의 주기 값이 근거이면 unit에는 그 값의 주기만 적힌 그대로(「60 s」) 쓰고 at은 그 행이다',
    '그 명사를 앞 항목마다 붙인다(「review 행」·「policy 행」·「state 행」', '칸의 맨이름 항목에 단위 명사를 덧붙인 항목(「cards」 자리의 「cards 행」)은 지도에서 빠진다'])
    assert.ok(P.RENDER_RULES.includes(rule), rule);
  // .38: the two-word unit phrase is shared whole again (「journal 경주 행」), now as the artifact-noun rule's own example.
  assert.ok(P.RENDER_RULES.includes('「journal 경주 행」·「outcomes 경주 행」'), 'the two-word shared phrase example is back (.38)');
  assert.ok(!P.RENDER_RULES.includes('blueprint가 이 부분에 맡긴 condition·uncertain 항목'), 'condition rows are no claims now');
  for (const rule of ['선의 종류는 나르는 산출물로 정한다', 'control은 넘기는 것이 산출물 표의 산출물이 아닌 깨우기·발주·지시·켜기와 끄기·보고 선에만 쓴다',
    '「그 부분 → 저장소」 쓰기 선과 「저장소 → 그 부분」 읽기 선을 둘 다 그 산출물 행을 at으로 그린다',
    '관계의 at은 연결 표 행, 화살표 줄, 산출물 표 행, 「부분별 설계」 행, 「안의 단계」 행 가운데 하나다']) assert.ok(P.GLOBAL_RULES.includes(rule), rule);
  for (const rule of ['category가 condition이면 그 조건을 그 부분의 「조건·거부·분기」 행 하나로 칸 그대로', 'unrecorded이면 그 선을 연결 표 행·화살표 줄·산출물 행으로 다시 고르거나 빼고',
    'store-island이면 names의 저장소마다', 'names가 「이름: 설정 | j1_cadence 60 s」처럼 설정 칸 항목이면 unit에는 그 값의 주기만 적힌 그대로(「60 s」) 쓰고']) assert.ok(P.CORRECTION_RULES.includes(rule), rule);
  assert.ok(P.PLAN_CORRECTION_RULES.includes('store-dup은 같은 「있는 곳」에 저장소 부분을 둘 세웠다는 뜻이다'));
  for (const rule of ['저장소 부분은 「있는 곳」 하나에 하나다', '「있는 곳」이 HTTP·메모리·외부 검사(GitHub 검사)이면 저장소 부분도 그 산출물의 부분도 세우지 않고',
    '만드는 부분과 읽는 부분이 같은 산출물 행도 「있는 곳」이 부분 표의 저장소 부분이면', '「있는 곳」이 부분 표의 어느 저장소도 이름 대지 않는 폴더(「/var/lib/koru-desk/cards/」)일 때만 행의 파일마다 따로 세운다'])
    assert.ok(B.MAP_BLUEPRINT_PROMPT.includes(rule), rule);
  assert.ok(B.LATER_BLUEPRINT_PROMPT.startsWith(B.MAP_BLUEPRINT_PROMPT));
});

// ---- first-map-divided.37 (map-reading.13, from the blind judging of the .36 KORU and web-app maps): lines the contract set aside are
// no missing lines, the program fills a loop from its cadence setting and a stop from a condition, rule places and kept state come from
// conditions, the shared noun in its final form, format fields on their line, cadence kept, one line per pair and payload, a withdrawal's
// 폐기·철회, and a render correction's dropped items. ----
test('.37 rule sentences: the shared noun\'s final form, the program\'s loop, stop and kept state, places from the conditions a line reaches, a withdrawal\'s 폐기·철회, cadence kept, one line per pair, format fields; the correction\'s lines-set-aside', async () => {
  const P = await import('../server/map-pipeline.mjs');
  assert.deepEqual([P.PIPELINE_RECIPE, P.LATER_PIPELINE_RECIPE], ['first-map-divided.41', 'later-map-divided.41']);
  for (const rule of ['그 명사를 앞 항목마다 붙인다', '「전날 체결 원자료」·「마크 원자료」', '「GTX 진입 주문」·「HARD STOP_MARKET 주문」·「TP GTX 주문」',
    '자기 종류 낱말(행·메시지·스트림·파일·줄·요청·응답·값·키·결과·답)로 끝나면(「orders 행·결제 세션 요청·관리자 세션 키」) 붙이지 않고',
    '프로그램이 그 항목을 글자 그대로 unit으로 채우고 프로그램 표시를 붙이므로, 지어내 채우지 않는다', '그 칸을 stop에, 재개 코드(RESUME·재개)이면 resume에 칸 그대로 쓴다',
    '메시지마다의 끝(「events:dlq로 XADD」)과 스탑 가격(STOP_NOT_RESIDENT)은 stop이 아니다', '프로그램이 그 이름만으로 stateVars 하나를 더해 표시한다',
    '그 부분의 나가는 선이 닿는 부분의 conditions에서 낱말이 둘 이상 겹치는 조건', '「지금」 칸이 「폐기」·「철회」로 설계 결정을 거둔 행', '(implementation·report로 쓰면 그 칸이 빠진다)',
    'withdrawalKind를 null로 두면 진단(withdrawal-kind)에 남는다']) assert.ok(P.RENDER_RULES.includes(rule), rule);
  assert.ok(!P.RENDER_RULES.includes('두 낱말 명사이거나(「journal·outcomes 경주 행」은 「journal」·「outcomes 경주 행」)'), 'the .36 two-word exception is gone');
  for (const rule of ['그 행의 선은 그 칸을 cadence에 적힌 그대로 쓰고, 그 값이 받는 부분의 loop unit이나 설정과 같아도 지우지 않는다', '같은 from·to·channel·payload의 선은 한 번만 쓴다',
    '형식 산출물(결제 세션 요청·결제 웹훅·송장 요청·추적 응답·관리자 요청·플래그 값)은 부분도 저장소도 아니다', 'payloadFields에 그 행의 「필드」 칸을 「·」(괄호 밖)마다 나눈 이름을 적힌 그대로 최대 24개',
    '"payloadFields":["order_id","amount","currency","success_url","cancel_url"]']) assert.ok(P.GLOBAL_RULES.includes(rule), rule);
  for (const rule of ['rule이 lines-set-aside이면 names의 선은 계약이 기록에 없는 줄이나 규칙 위반으로 이미 뺀 것이므로 다시 그리지 않는다', 'dup-line이면 겹친 뒤의 선을 빼며',
    'payload-fields이면 그 선이 나르는 형식 산출물 행의 「필드」 칸 이름만', '관계의 payload·cadence·mode·channel·payloadFields']) assert.ok(P.CORRECTION_RULES.includes(rule), rule);
});

test('.37: a render correction\'s stage record names what its first pass held and the correction dropped (dropped); a stage taken on its first pass keeps none', async t => {
  const { dir, make } = await setup(t), ask = askFor(), calls = [], wire0 = originalWire(ask);
  const used = new Set(wire0.parts.flatMap(p => [...p.basis, ...p.claims.map(c => c.at)]));
  const spare = ask.records[0].spans.map(s => s.s).find(s => !used.has(s));
  assert.ok(spare, 'a piece no part of the wire cites');
  let firstPass = null;
  const pipeline = make({ callProvider: fakeProvider(ask, calls, call => {
    // A structural first pass (a claim key outside the fragment's range) pays the fragment's one correction, which leaves that claim out.
    if (call.stage === 'render' && !call.input.correction && call.input.assignment.id === 'parts-1') {
      const fragment = payloadFor(call.input, ask, wire0);
      fragment.parts[0].claims.push({ ...structuredClone(fragment.parts[0].claims[0]), key: 's801', text: '첫 판에만 있던 주장이다.', at: spare });
      firstPass = structuredClone(fragment); return fragment;
    }
  }) });
  await pipeline.read(ask);
  const items = firstPass.parts.reduce((n, p) => n + (p.steps ?? []).length + p.claims.length + (p.stateVars ?? []).length, 0);
  const stages = Object.values(JSON.parse(await readFile(join(dir, 'pipeline.json'), 'utf8')).body.jobs).at(-1).stages;
  // .38: named by the record's own words at the claim's range (its first 40 characters), not by the model's text.
  const record = ask.records[0], piece = record.spans.find(s => s.s === spare), quote = piece.t.replace(/\s+/g, ' ').trim().slice(0, 40);
  assert.deepEqual(stages['render-1-correction'].diagnostics, [{ path: 'parts', rule: 'dropped', expected: items, actual: items - 1, names: [`${firstPass.parts[0].ref} claim ${spare}: 「${quote}」`] }]);
  assert.equal(Object.hasOwn(stages['render-1'], 'diagnostics'), false, 'the refused first pass keeps none');
  assert.ok(Object.keys(stages).filter(id => /^render-\d+$/.test(id) && id !== 'render-1').every(id => !Object.hasOwn(stages[id], 'diagnostics')), 'a fragment taken on its first pass keeps none');
});

// ---- first-map-divided.38 (map-reading.13; an io exclusion may carry its value): the render prompt says the shared noun is an artifact
// or unit noun only, that a cell's own fragment stays, that a rule on a code condition row adds that row's code device and that each
// 「한 줄 요약」 sentence naming the part is a status claim of it. ----
test('.38 rule sentences: the shared noun only for artifact or unit nouns, a cell fragment kept, a code device on a code condition row, a status claim per summary sentence', async () => {
  const P = await import('../server/map-pipeline.mjs');
  assert.deepEqual([P.PIPELINE_RECIPE, P.LATER_PIPELINE_RECIPE], ['first-map-divided.41', 'later-map-divided.41']);
  for (const rule of ['붙이는 명사는 산출물·단위 명사(행·메시지·스트림·파일·줄·원자료·주문·요청·결과·이벤트·응답·알림톡)일 때만이고', '「journal·outcomes 경주 행」은 「journal 경주 행」·「outcomes 경주 행」',
    '「한 줄 보고·결정 필요」, 「읽기 한 쪽·메모·사전 등록」, 「주문서 입력·배송 조회」', '-기 동작으로 끝나면 그 목록에는 붙이지 않는다', '앞머리의 시각 낱말(「전날」)은 그 항목에만 둔다',
    '「넘기는 것」 칸에 적힌 조각 그대로의 항목은 지도에서 빠지지 않는다', 'enforcedBy에 그 행의 code 장치 {"kind":"code","text":"그 참이면 칸","at":"그 행"}를 더한다', '진단 anchor-enforce에 「프로그램이 채움」으로 남는다',
    '이 부분의 status 주장 하나로 쓰고 at은 그 문장이다']) assert.ok(P.RENDER_RULES.includes(rule), rule);
});

// ---- first-map-divided.39 (map-reading.14): the render prompt writes 3절 chains as steps, fileRoles, one range one home, the subject
// rule of the 「한 줄 요약」, a refusal or file-map row's code device and run/dev gates; the global prompt a query line as data, the writer
// side's port rows and calls kept apart; the plan and extraction never take a 「한 줄 요약」 sentence for material. ----
test('.39 rule sentences: 3절 chains as steps, fileRoles, one range one home, the summary subject rule, refusal codes and file-map devices, run gates; query lines, writer-side port rows and merged calls; never material', async () => {
  const P = await import('../server/map-pipeline.mjs'), B = await import('../server/map-blueprint.mjs');
  assert.deepEqual([P.PIPELINE_RECIPE, P.LATER_PIPELINE_RECIPE], ['first-map-divided.41', 'later-map-divided.41']);
  for (const rule of ['화살표로 나눈 조각마다 단계 하나씩을 순서대로 쓴다', '비워 두면 프로그램이 같은 단계를 채우고 프로그램 표시를 붙인다', '각 부분에 fileRoles를 더한다',
    '그 구간이 풀어 주는 모르는 것·철회·가장 자신 없는 것 행이 있는 부분', '꼬리표 안의 보고자(운영 담당자·개발 세션)는 그 문장의 주어가 아니다', '한 줄 요약 문장은 material이 아니다',
    '403 ROLE_REQUIRED처럼 4xx와 ROLE·REQUIRED·FORBIDDEN', '기능 플래그·상태 확인(「!flags.isOn(\'checkout_enabled\') → 503 CHECKOUT_DISABLED」)은 사람이 정한 규칙의 장치가 아니다',
    '「C/calls.py | 카드 러너 | 모델 호출·지출 상한 CL 20·DS 5 USD」: 그 행을 at으로 code 하나', '문턱도 운영 상태도 없는 run은 그 칸만 지도에서 빠진다'])
    assert.ok(P.RENDER_RULES.includes(rule), rule);
  assert.ok(!P.RENDER_RULES.includes('「부분별 설계」 표의 「안의 단계」 칸이나 다른 설명에서 단계를 지어내지 않는다'), 'the old sentence refusing 3절 chains is gone');
  for (const rule of ['넘기는 것이 조회·요청·응답·결과인 선', '읽는 쪽만이 아니라 쓰는 쪽', '계획 항목에 합친 호출 이름(「payon.refund」)을 버리지 않는다', '어느 부분의 주장도 아니며, 그 운영 규모·상태를 원문의 값 그대로 summary 첫 문장(프로젝트 정의)이나 둘째 문장에 쓴다'])
    assert.ok(P.GLOBAL_RULES.includes(rule), rule);
  assert.ok(B.MAP_BLUEPRINT_PROMPT.includes('「한 줄 요약」 문장은 material이 아니며, 꼬리표 밖에서 이름이 하나만 나오는 부분에 맡기고(꼬리표 안의 보고자가 아니다)'));
  assert.ok(P.EXTRACTION_PROMPT.includes('「한 줄 요약」(「1. 한 줄 요약」) 문장은 이 프로젝트의 상태 문장이며 material이 아니다'));
  for (const rule of ['category가 file-role이면', 'dup-claim이면', 'gate이면 문턱·운영 상태가 없는 계획을 dev나 null로 쓴다', '「원문이 단계를 대지 않음」 줄은 그대로 두고']) assert.ok(P.CORRECTION_RULES.includes(rule), rule);
});

// ---- first-map-divided.40 (map-reading.15): the render input hands a part the other parts' condition rows its 「지켜야 할 것」 row
// speaks of (from), the prompts say the from rows, step tails, loop types, VCS units, version claims and the matcher's reach, and the
// correction hears 「단계 후보 있음」 and 「판본 …」 (fake providers only; no model quality is claimed). ----
test('.40 rule sentences: the from rows, step tails, loop types and VCS units, version tokens as claims; the matcher\'s reach; the correction hears 단계 후보 and 판본', async () => {
  const P = await import('../server/map-pipeline.mjs'), B = await import('../server/map-blueprint.mjs');
  assert.deepEqual([P.PIPELINE_RECIPE, P.LATER_PIPELINE_RECIPE], ['first-map-divided.41', 'later-map-divided.41']);
  for (const rule of ['이 목록의 행마다(from이 있는 행은 빼고) 그 부분의 conditions 칸에 하나씩 옮긴다', 'from이 있는 행은 7절 「지켜야 할 것」의 이 부분 규칙 행이 말하는 다른 부분(from)의 조건 행이다',
    '프로그램이 그 행의 code 장치를 채우고 프로그램 표시를 붙이며', '단계 이름에는 괄호 꼬리를 남기지 않는다: 「plan 행(실패면 FALLBACK)」은 name 「plan 행」, does 「실패면 FALLBACK」이다',
    'loop는 type이 loop·collector·compute·ai·actor이거나 type이 없는 부분에만 쓴다', 'CI 관문의 「PR마다」, 「커밋마다」', '판본 낱말(sha', '판본은 config에 넣지 않고 버리지도 않는다'])
    assert.ok(P.RENDER_RULES.includes(rule), rule);
  for (const rule of ['행의 키 필드(processed_events 행의 event_id: 「event_id 조회」)', '사슬 마지막 조각(성적표 「render」 → SHEET-<날>.md)을 out 포트 단계로 쓴다'])
    assert.ok(P.GLOBAL_RULES.includes(rule), rule);
  for (const rule of ['「단계 후보 있음 · 모델이 비움」 줄은 후보 단계 가운데', 'uncited의 「판본 <sha>: 부분」 이름은']) assert.ok(P.CORRECTION_RULES.includes(rule), rule);
  assert.ok(B.MAP_BLUEPRINT_PROMPT.includes('그 규칙 행의 부분 at에도 넣는다'));
});

const ruleAsk = () => validateMapAsk({ schemaVersion: 'studio.map.6', project: { name: '자료 흐름', purpose: null }, parts: [], relations: [], requests: [], priors: [],
  records: [
    { id: 'N01', kind: 'pasted', note: '', basis: '앞쪽 기록', ...encodeSpans('N01', ['입력기는 프로젝트 문서를 받아 작업 큐에 전달합니다.', '처음에는 모든 자료를 영구 저장한다고 설명했습니다.', '중간 조건: 개발용 판본에만 적용합니다.', '원문 기록은 변경 없이 보존합니다.',
      '5. 조건·거부·분기', '| 부분 이름 | 조건 | 참이면 | 거짓이면 |', '|---|---|---|---|', '| 자료 처리 | not queue_ready | QUEUE_EMPTY | 다음 |', '| 다른 부분 | queue_size > limit | 409 QUEUE_FORBIDDEN | 다음 |',
      '7. 지켜야 할 것', '| 부분 이름 | 규칙 한 줄 | 누가 정했나 |', '|---|---|---|', '| 자료 처리 | 큐 queue_size는 limit을 넘지 않는다 | 소유자 |'].join('\n')) },
    askFor().records[1]],
});

test('.40: a render hears, beside its parts\' own 「조건·거부·분기」 rows, the other parts\' rows a 「지켜야 할 것」 row of its part speaks of, marked from', async t => {
  const ask = ruleAsk(), spans = ask.records[0].spans, own = spans.find(s => s.t.startsWith('| 자료 처리 | not')).s, other = spans.find(s => s.t.startsWith('| 다른 부분')).s;
  const { make } = await setup(t), calls = [];
  await make({ renderModel: 'gpt-6.1-terra', callProvider: fakeProvider(ask, calls) }).call(ask);
  const renders = calls.filter(c => c.stage === 'render');
  assert.deepEqual(renders[0].input.conditions, { 'new:flow': [{ at: own, condition: 'not queue_ready', then: 'QUEUE_EMPTY', else: '다음' },
    { at: other, condition: 'queue_size > limit', then: '409 QUEUE_FORBIDDEN', else: '다음', from: '다른 부분' }] });
});
