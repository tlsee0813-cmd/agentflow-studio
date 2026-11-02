import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ApiError } from '../../server/errors.mjs';
import { encodeSpans } from '../dist/public/shared/evidence-span.js';
import { validateMapAsk, validateMapReply } from '../dist/public/shared/map-reading.js';
import { createFirstMapPipeline, PIPELINE_RECIPE, LATER_PIPELINE_RECIPE , PLAN_TIMEOUT_MS, GLOBAL_RULES, FIRST_GLOBAL_RULES, FIRST_FINAL_GLOBAL_RULES, FINAL_GLOBAL_RULES } from '../server/map-pipeline.mjs';
import { openFirstMapPipeline } from '../server/map-pipeline-host.mjs';
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

test('a known incomplete render keeps its successful sibling and resumes only the failed group', async t => {
  const { make } = await setup(t), ask = askFor(), wire = manyPartsWire(ask), calls = []; let fail = true;
  const pipeline = make({ callProvider: fakeProvider(ask, calls, call => {
    if (fail && call.stage === 'render' && call.input.assignment.id === 'parts-2') {
      fail = false; call.options.onUsage(usage); throw new ApiError('AI_RESPONSE_INCOMPLETE', 502);
    }
  }, wire) });
  await assert.rejects(pipeline.call(ask), matchesCode('AI_RESPONSE_INCOMPLETE'));
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
  assert.deepEqual(globals[1].input.correction.issues, [{ path: 'candidates[0].statement.key', rule: 'settled-and-open', expected: null, actual: null }]);
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
  assert.match(FIRST_GLOBAL_RULES, /빠진 중요한 조건은 gaps/); assert.match(FIRST_FINAL_GLOBAL_RULES, /reviseParts를 보내지 말고/);
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

// first-map-divided.9: the plan may write 16,384 output tokens within 300 s; renders and global stages keep 8,192 within 180 s.
test('the plan stage alone gets the larger output budget and the longer time limit', async t => {
  const { make } = await setup(t), ask = askFor(), calls = [];
  const pipeline = make({ renderModel: 'gpt-6.1-terra', callProvider: fakeProvider(ask, calls) });
  validateMapReply(await pipeline.call(ask), ask);
  const budget = stage => [...new Set(calls.filter(c => c.stage === stage).map(c => `${c.options.maxOutputTokens}/${c.options.timeoutMs}`))];
  assert.deepEqual(budget('plan'), ['16384/300000']);
  assert.deepEqual(budget('render'), ['8192/180000']); assert.deepEqual(budget('global'), ['8192/180000']);
  assert.deepEqual(budget('extract'), ['4096/60000']);
  assert.equal(PLAN_TIMEOUT_MS, 300000);
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
  // DeepSeek rendering with OpenAI global stages: 12 extractions (no correction) + 8 groups x (1 + semantic) x (1 + correction).
  assert.deepEqual([split.describe().renderProvider, split.describe().deepseekMaxCalls], ['deepseek', 44]);
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
  const { make } = await setup(t, {}, { runUsd: 0.03 }), ask = askFor(), calls = [];
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
  assert.equal(semantic.input.assignment.id, 'parts-2'); assert.equal(semantic.input.assignment.keyStart, 101);
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
test('semantic pass metadata bounds DeepSeek to 48 calls while OpenAI rendering allows twelve extractions with one correction each', async t => {
  const { make } = await setup(t);
  assert.equal(make({}).describe().deepseekMaxCalls, 48);
  assert.equal(make({ renderModel: 'gpt-6.1-terra' }).describe().deepseekMaxCalls, 24);
  assert.equal(make({ renderModel: 'gpt-6.1-terra', maxPartitions: 5 }).describe().deepseekMaxCalls, 10);
  assert.equal(make({ maxPartitions: 5 }).describe().deepseekMaxCalls, 41);
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
      part.claims.push({ key: 's99', kind: 'reported', text: 'alpha 보고의 철회', at: obligation.at[0], aboutAt: null, replaces: obligation.claim });
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
    [plan => { plan.parts = Array.from({ length: 25 }, (_, i) => ({ ...plan.parts[0], ref: 'new:p' + i })); }, 'count'],
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
  assert.equal(PIPELINE_RECIPE, 'first-map-divided.18');
  assert.equal(LATER_PIPELINE_RECIPE, 'later-map-divided.18');
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
