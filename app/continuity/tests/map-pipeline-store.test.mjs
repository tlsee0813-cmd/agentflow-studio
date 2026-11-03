import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mapPipelineKey, openMapPipelineStore, pipelineFileIo } from '../server/map-pipeline-store.mjs';

const key = n => mapPipelineKey({ ask: n, recipe: 'test', model: 'gpt-6.1-sol' });
const spec = { provider: 'openai', model: 'gpt-6.1-sol', inputBytes: 100, maxOutputTokens: 100 };
const usage = { input_tokens: 10, output_tokens: 20 };
async function fixture(t, options = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'map-pipeline-'));
  const stores = [];
  t.after(async () => { for (const s of stores.reverse()) await s.close(); await rm(dir, { recursive: true, force: true }); });
  const open = async extra => { const s = await openMapPipelineStore({ dir, ...options, ...extra }); stores.push(s); return s; };
  return { dir, open, store: await open() };
}
const code = expected => error => error.code === expected;

test('key includes every JSON value and ignores object insertion order', () => {
  assert.equal(mapPipelineKey({ b: [1, 2], a: 'x' }), mapPipelineKey({ a: 'x', b: [1, 2] }));
  assert.notEqual(mapPipelineKey({ a: 'x', recipe: 1 }), mapPipelineKey({ a: 'x', recipe: 2 }));
  assert.throws(() => mapPipelineKey({ a: undefined }), TypeError);
});

test('completed stage is durable, cloned, and replays without a second reservation', async t => {
  const { dir, store, open } = await fixture(t);
  await store.run(key(1), async () => {
    await store.begin(key(1), 'partition', spec);
    await store.complete(key(1), 'partition', { value: { shards: ['a'] }, usage });
    await store.begin(key(1), 'shard.0', spec);
    await store.failed(key(1), 'shard.0', { uncertain: false, usage });
  });
  const copy = store.get(key(1), 'partition'); copy.shards.push('mutated');
  assert.deepEqual(store.get(key(1), 'partition'), { shards: ['a'] });
  assert.equal(store.get(key(1), 'shard.0'), null);
  assert.equal(store.describe().spentUsd, 0.00044);
  const raw = JSON.parse(await readFile(join(dir, 'pipeline.json'), 'utf8'));
  assert.equal(raw.body.jobs[key(1)].stages.partition.state, 'complete');
  await store.close();
  const reopened = await open();
  assert.deepEqual(reopened.get(key(1), 'partition'), { shards: ['a'] });
  await assert.rejects(reopened.begin(key(1), 'partition', spec), code('MAP_STAGE_ALREADY_COMPLETE'));
  assert.equal(reopened.describe().spentUsd, 0.00044);
});

test('crash-window reservation survives restart and cannot be resent', async t => {
  const { store, open } = await fixture(t);
  await store.begin(key(2), 'shard.0', spec);
  await store.close();
  const reopened = await open();
  assert.equal(reopened.describe().spentUsd, 0.0012);
  assert.throws(() => reopened.get(key(2), 'shard.0'), code('MAP_STAGE_UNCERTAIN'));
  await assert.rejects(reopened.begin(key(2), 'shard.0', spec), code('MAP_STAGE_UNCERTAIN'));
});

test('timeout retains full reservation and an explicit known failure allows a newly charged retry', async t => {
  const { store } = await fixture(t);
  await store.begin(key(3), 'timeout', spec);
  await store.failed(key(3), 'timeout');
  assert.throws(() => store.get(key(3), 'timeout'), code('MAP_STAGE_UNCERTAIN'));
  await store.begin(key(3), 'known', spec);
  await store.failed(key(3), 'known', { uncertain: false });
  const attempt = await store.begin(key(3), 'known', spec);
  assert.equal(attempt.attempt, 2);
  assert.equal(store.describe().spentUsd, 0.0036);
});

test('actual usage reconciles both reasoning/output and input tokens, without cached discounts', async t => {
  const { store } = await fixture(t);
  await store.begin(key(4), 'one', { ...spec, model: 'gpt-6-astra' });
  assert.equal(store.describe().spentUsd, 0.006);
  await store.complete(key(4), 'one', { value: ['ok'], usage: { input_tokens: 10, output_tokens: 30, input_tokens_details: { cached_tokens: 10 }, output_tokens_details: { reasoning_tokens: 20 } } });
  assert.equal(store.describe().spentUsd, 0.0016);
  await store.begin(key(4), 'two', spec);
  await store.complete(key(4), 'two', { value: ['ok'] });
  assert.equal(store.describe().spentUsd, 0.0028);
});

test('over-reservation usage leaves attempt uncertain and does not release its bound', async t => {
  const { store } = await fixture(t);
  await store.begin(key(5), 'one', spec);
  await assert.rejects(store.complete(key(5), 'one', { value: 'x', usage: { input_tokens: 101, output_tokens: 0 } }), code('MAP_STAGE_UNCERTAIN'));
  assert.equal(store.describe().spentUsd, 0.0012);
  assert.throws(() => store.get(key(5), 'one'), code('MAP_STAGE_UNCERTAIN'));
});

test('global serialization prevents two distinct keys from exceeding the monthly ceiling', async t => {
  const { store } = await fixture(t, { monthlyUsd: 0.0012 });
  const results = await Promise.allSettled([store.begin(key(6), 'one', spec), store.begin(key(7), 'one', spec)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.code, 'MAP_BUDGET_EXCEEDED');
  assert.equal(store.describe().spentUsd, 0.0012);
});

test('per-logical-run ceiling includes attempts across stages and retries', async t => {
  const { store } = await fixture(t, { runUsd: 0.0012 });
  await store.begin(key(8), 'one', spec);
  await store.failed(key(8), 'one', { uncertain: false });
  await assert.rejects(store.begin(key(8), 'one', spec), code('MAP_BUDGET_EXCEEDED'));
  await assert.rejects(store.begin(key(8), 'two', spec), code('MAP_BUDGET_EXCEEDED'));
  await store.begin(key(9), 'one', spec);
});

test('UTC month rollover counts reservation in its original month while run limit persists', async t => {
  let instant = new Date('2026-10-31T23:59:59.000Z');
  const { store } = await fixture(t, { monthlyUsd: 0.0012, now: () => instant });
  await store.begin(key(10), 'one', spec);
  instant = new Date('2026-11-01T00:00:00.000Z');
  assert.equal(store.describe().month, '2026-11');
  assert.equal(store.describe().spentUsd, 0);
  await store.complete(key(10), 'one', { value: 'old-month', usage });
  assert.equal(store.describe().spentUsd, 0);
  await store.begin(key(10), 'two', spec);
  assert.equal(store.describe().spentUsd, 0.0012);
});

test('begin rejects before caller dispatch when reservation persistence fails', async t => {
  let writes = 0;
  const { store } = await fixture(t, { io: { async writeAtomic(...args) { if (++writes === 2) throw Error('simulated disk failure'); await pipelineFileIo.writeAtomic(...args); } } });
  let dispatches = 0;
  await assert.rejects(store.run(key(11), async () => { await store.begin(key(11), 'one', spec); dispatches++; }), code('MAP_PIPELINE_STORE_UNAVAILABLE'));
  assert.equal(dispatches, 0);
  assert.equal(store.describe().durable, false);
  await assert.rejects(store.begin(key(12), 'one', spec), code('MAP_PIPELINE_STORE_UNAVAILABLE'));
});

test('failed completion persistence keeps the on-disk stage pending for the next process', async t => {
  let writes = 0;
  const { store, open } = await fixture(t, { io: { async writeAtomic(...args) { if (++writes === 3) throw Error('completion failure'); await pipelineFileIo.writeAtomic(...args); } } });
  await store.begin(key(13), 'one', spec);
  await assert.rejects(store.complete(key(13), 'one', { value: 'ok', usage }), code('MAP_PIPELINE_STORE_UNAVAILABLE'));
  await store.close();
  const reopened = await open({ io: pipelineFileIo });
  assert.throws(() => reopened.get(key(13), 'one'), code('MAP_STAGE_UNCERTAIN'));
  assert.equal(reopened.describe().spentUsd, 0.0012);
});

test('same-key runs reject overlap, different keys can run, and throwing run releases ownership', async t => {
  const { store } = await fixture(t);
  let release;
  const held = store.run(key(14), () => new Promise(resolve => { release = resolve; }));
  assert.throws(() => store.run(key(14), () => {}), code('MAP_PIPELINE_BUSY'));
  assert.equal(await store.run(key(15), () => 42), 42);
  await Promise.resolve(); release(); await held;
  await assert.rejects(store.run(key(14), () => { throw Error('known'); }), /known/);
  assert.equal(await store.run(key(14), () => 43), 43);
});

test('a second process-owner service fails closed without affecting the first store', async t => {
  const { store, open } = await fixture(t);
  const contender = await open();
  assert.equal(contender.describe().durable, false);
  assert.equal(contender.describe().problem, 'STORE_BUSY');
  await assert.rejects(contender.begin(key(16), 'one', spec), code('MAP_PIPELINE_STORE_UNAVAILABLE'));
  await store.begin(key(16), 'one', spec);
});

test('malformed existing ledger fails closed and is preserved for inspection', async t => {
  const { dir, store, open } = await fixture(t);
  await store.close();
  await writeFile(join(dir, 'pipeline.json'), '{"incomplete":');
  const broken = await open();
  assert.equal(broken.describe().durable, false);
  await assert.rejects(broken.begin(key(17), 'one', spec), code('MAP_PIPELINE_STORE_UNAVAILABLE'));
  assert.equal(await readFile(join(dir, 'pipeline.json'), 'utf8'), '{"incomplete":');
});

test('DeepSeek is excluded from the OpenAI USD meter; unknown priced models are refused', async t => {
  const { store } = await fixture(t, { monthlyUsd: 0, runUsd: 0 });
  await store.begin(key(18), 'deepseek', { ...spec, provider: 'deepseek', model: 'deepseek-chat' });
  await store.complete(key(18), 'deepseek', { value: 'ok' });
  assert.equal(store.describe().openaiOnly, true);
  assert.equal(store.describe().spentUsd, 0);
  await assert.rejects(store.begin(key(18), 'unknown', { ...spec, model: 'unknown-priced-model' }), code('MAP_BUDGET_MODEL_UNSUPPORTED'));
});

test('a refused stage keeps only a fixed diagnostic beside its failed attempt; a retry clears it and the ledger stays valid', async t => {
  const { dir, store, open } = await fixture(t, { now: () => new Date('2026-11-02T10:00:00Z') });
  await store.begin(key(19), 'render-2', spec);
  await store.failed(key(19), 'render-2', { uncertain: false, usage, diagnostic: { stage: 'render-2', phase: 'render', total: 3, rule: 'reference',
    path: 'parts[0].basis[1]', category: 'PRIVATE category text', reason: 'shape', target: 'PRIVATE_TARGET', text: 'PRIVATE_SOURCE' } });
  const expected = { stage: 'render-2', phase: 'render', rule: 'reference', reason: 'shape', path: 'parts[0].basis[1]', total: 3, at: '2026-11-02T10:00:00.000Z' };
  assert.deepEqual(store.lastFailure(key(19)), expected);
  assert.deepEqual(store.describe().lastFailure, expected);
  assert.equal(store.lastFailure(key(20)), null);
  assert.equal(store.describe().spentUsd, 0.00022, 'cost accounting is unchanged');
  assert.equal(store.get(key(19), 'render-2'), null);
  const raw = await readFile(join(dir, 'pipeline.json'), 'utf8');
  assert.ok(!raw.includes('PRIVATE'));
  // An unusable diagnostic is left out; the failure itself is still recorded as before.
  await store.begin(key(19), 'plan', spec);
  await store.failed(key(19), 'plan', { uncertain: false, usage, diagnostic: { stage: 'plan\nPRIVATE', phase: 'plan' } });
  await store.close();
  const reopened = await open();
  assert.deepEqual(reopened.lastFailure(key(19)), expected, 'the diagnostic survives a restart');
  await reopened.begin(key(19), 'render-2', spec);
  assert.equal(reopened.lastFailure(key(19)), null, 'a new attempt is no longer the refused one');
  await reopened.close();
  const file = JSON.parse(await readFile(join(dir, 'pipeline.json'), 'utf8'));
  file.body.jobs[key(19)].stages.plan.diagnostic = { stage: 'plan', phase: 'plan', at: '2026-11-02T10:00:00.000Z', text: 'PRIVATE_SOURCE' };
  const { createHash } = await import('node:crypto');
  file.sha256 = createHash('sha256').update(JSON.stringify(file.body)).digest('hex');
  await writeFile(join(dir, 'pipeline.json'), JSON.stringify(file));
  assert.equal((await open()).describe().durable, false, 'a ledger diagnostic holding anything else reads as damaged');
});

// ---- first-map-divided.35: a lost attempt (cancelled or lost, its whole reservation charged) that kept a background response id
// under 24 h is read back once (the caller's free GET) and charged by the usage the response reports; anything else stays. The real
// usage of three stalled .32 plans was 0-1,259 reasoning tokens against reservations of about $0.49 each. ----
const lostAttempt = async (store, k, stage, responseId) => {
  await store.begin(k, stage, spec);
  await store.noteResponse(k, stage, responseId);
  await store.failed(k, stage, { uncertain: true });
};
test('.35 reconcileLost: a lost attempt with a response id under 24 h is charged by the usage its response reports; totals follow and a reopened ledger reads it', async t => {
  let clock = Date.parse('2026-11-03T18:00:00Z');
  const { store, open } = await fixture(t, { now: () => new Date(clock) });
  await store.run(key(1), async () => { await lostAttempt(store, key(1), 'plan', 'resp_lost1'); await lostAttempt(store, key(1), 'render-1', 'resp_lost2'); });
  const reserved = 0.0012; // 100 bytes in at $2 and 100 tokens out at $10 per million: the whole reservation
  assert.equal(store.describe().spentUsd, reserved * 2);
  clock += 3 * 60 * 60 * 1000;
  const asked = [];
  const out = await store.reconcileLost(async id => { asked.push(id); return id === 'resp_lost1' ? { inputTokens: 40, outputTokens: 7 } : null; });
  assert.deepEqual(asked, ['resp_lost1', 'resp_lost2'], 'each lost response is read once');
  assert.deepEqual(out.map(x => [x.stage, x.reconciled, x.beforeUsd, x.chargedUsd]), [['plan', true, reserved, 0.00015], ['render-1', false, reserved, reserved]]);
  assert.equal(store.describe().spentUsd, 0.00135, 'the monthly total is the sum of the charges, the reconciled one included');
  assert.equal(store.spentByRun(key(1)), 0.00135, 'and so is the run total');
  // The reconciled attempt says so; the stage still blocks (nothing came back to apply).
  assert.throws(() => store.get(key(1), 'plan'), code('MAP_STAGE_UNCERTAIN'));
  await store.close();
  const reopened = await open({ now: () => new Date(clock) });
  assert.equal(reopened.describe().durable, true, 'the reconciled attempt reads as a valid ledger');
  assert.equal(reopened.describe().spentUsd, 0.00135);
  // Read again: the reconciled one is not asked twice; the one with nothing to read still is.
  const again = [];
  assert.deepEqual((await reopened.reconcileLost(async id => { again.push(id); return null; })).map(x => x.stage), ['render-1']);
  assert.deepEqual(again, ['resp_lost2']);
});
test('.35 reconcileLost: a failed read, a usage past the reservation and an attempt older than 24 h are left as they were', async t => {
  let clock = Date.parse('2026-11-03T18:00:00Z');
  const { dir, store, open } = await fixture(t, { now: () => new Date(clock) });
  await store.run(key(2), async () => { await lostAttempt(store, key(2), 'plan', 'resp_old'); });
  clock += 25 * 60 * 60 * 1000;
  await store.run(key(3), async () => { await lostAttempt(store, key(3), 'plan', 'resp_over'); await lostAttempt(store, key(3), 'render-1', 'resp_throws'); });
  // A lost attempt without a response id (its POST never returned) has nothing to read.
  await store.run(key(4), async () => { await store.begin(key(4), 'plan', spec); await store.failed(key(4), 'plan', { uncertain: true }); });
  const before = await readFile(join(dir, 'pipeline.json'), 'utf8'), asked = [];
  const out = await store.reconcileLost(async id => {
    asked.push(id);
    if (id === 'resp_throws') throw new Error('network');
    return { inputTokens: 101, outputTokens: 1 }; // more input than the reservation allows
  });
  assert.deepEqual(asked, ['resp_over', 'resp_throws'], 'the attempt older than 24 h and the one with no id are not read');
  assert.deepEqual(out.map(x => x.reconciled), [false, false]);
  assert.equal(await readFile(join(dir, 'pipeline.json'), 'utf8'), before, 'nothing reconciled, nothing written');
  assert.equal(store.describe().spentUsd, 0.0012 * 4);
  // A narrower window is the caller's to give (two minutes later, a one-minute window reads none); a bad reader or window is refused.
  clock += 2 * 60 * 1000;
  assert.deepEqual(await store.reconcileLost(async () => ({ inputTokens: 1, outputTokens: 1 }), { maxAgeMs: 60 * 1000 }), []);
  await assert.rejects(store.reconcileLost(null), code('MAP_PIPELINE_INVALID'));
  await assert.rejects(store.reconcileLost(async () => null, { maxAgeMs: 0 }), code('MAP_PIPELINE_INVALID'));
  // A reconciled attempt whose usage does not price to its charge, or one reconciled without lost: false, reads as damaged.
  await store.reconcileLost(async id => id === 'resp_over' ? { inputTokens: 50, outputTokens: 50 } : null);
  await store.close();
  const file = JSON.parse(await readFile(join(dir, 'pipeline.json'), 'utf8')), attempt = file.body.jobs[key(3)].stages.plan.attempts[0];
  assert.deepEqual([attempt.lost, attempt.usage, attempt.charged, typeof attempt.reconciledAt], [false, { inputTokens: 50, outputTokens: 50 }, 600000, 'string']);
  const { createHash } = await import('node:crypto');
  for (const mutate of [a => { a.charged = 1; }, a => { delete a.reconciledAt; }, a => { a.lost = true; }, a => { a.usage = { inputTokens: 500, outputTokens: 50 }; }, a => { delete a.lost; }]) {
    const bad = structuredClone(file); mutate(bad.body.jobs[key(3)].stages.plan.attempts[0]);
    bad.sha256 = createHash('sha256').update(JSON.stringify(bad.body)).digest('hex');
    await writeFile(join(dir, 'pipeline.json'), JSON.stringify(bad));
    const s = await open(); assert.equal(s.describe().durable, false, String(mutate)); await s.close();
  }
});
