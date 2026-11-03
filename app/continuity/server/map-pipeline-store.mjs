// Private, local stage results and an OpenAI-only USD ledger. A reservation is durable before dispatch.
// An interrupted/unknown attempt keeps its whole reservation and can never be dispatched again.
import { mkdir, open, readFile, realpath, rename, unlink } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { ApiError } from '../../server/errors.mjs';

const FORMAT = 'agentflow.map-pipeline.1';
const FILE = 'pipeline.json';
const MAX_BYTES = 32 * 1024 * 1024;
const NANO = 1_000_000_000;
const hash = value => createHash('sha256').update(value).digest('hex');
const clone = value => structuredClone(value);
const own = (o, key) => Object.hasOwn(o, key);
const natural = n => Number.isSafeInteger(n) && n >= 0;
const plain = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const validKey = k => typeof k === 'string' && /^[a-f0-9]{64}$/.test(k);
const validStage = s => typeof s === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(s);
// Where a stage was refused, kept beside its failed attempt: fixed categories only (no model, record or key text).
const DIAGNOSTIC_PHASES = ['extract', 'plan', 'render', 'global', 'correction'];
const WORD = /^[a-z][a-z-]{0,39}$/, DIAGNOSTIC_PATH = /^[A-Za-z][A-Za-z0-9_.[\]]{0,239}$/;
function stageDiagnostic(d, at) {
  if (!plain(d) || !validStage(d.stage) || !DIAGNOSTIC_PHASES.includes(d.phase)) return null;
  const out = { stage: d.stage, phase: d.phase };
  for (const name of ['rule', 'category', 'reason']) if (typeof d[name] === 'string' && WORD.test(d[name])) out[name] = d[name];
  if (typeof d.path === 'string' && DIAGNOSTIC_PATH.test(d.path)) out.path = d.path;
  if (Number.isSafeInteger(d.total) && d.total >= 1 && d.total <= 99) out.total = d.total;
  out.at = at;
  return out;
}
const validDiagnostic = d => plain(d) && typeof d.at === 'string' && JSON.stringify(stageDiagnostic(d, d.at)) === JSON.stringify(d);
// Prices are USD per million tokens. No cached-input discount is assumed.
export const MAP_OPENAI_RATES = Object.freeze({
  'gpt-6.1-sol': Object.freeze([2, 10]), 'gpt-6.1-terra': Object.freeze([1, 5]), 'gpt-6-astra': Object.freeze([10, 50])
});

function canonical(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (plain(value)) return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  throw new TypeError('Pipeline key material must be JSON');
}
/** Bind ask, every recipe/prompt, model configuration and limits into the caller's key material. */
export const mapPipelineKey = material => hash(canonical(material));

export const pipelineFileIo = {
  async writeAtomic(dir, name, text) {
    const tmp = join(dir, `${name}.${randomUUID()}.tmp`);
    const h = await open(tmp, 'wx', 0o600);
    try { await h.writeFile(text, 'utf8'); await h.sync(); } finally { await h.close(); }
    try {
      for (let retry = 0; ; retry++) {
        try { await rename(tmp, join(dir, name)); break; }
        catch (e) { if (retry >= 5 || !['EPERM', 'EACCES', 'EBUSY'].includes(e?.code)) throw e; await new Promise(r => setTimeout(r, 20 * (retry + 1))); }
      }
      if (process.platform !== 'win32') {
        const d = await open(dir, 'r');
        try { await d.sync(); } finally { await d.close(); }
      }
    } finally { await unlink(tmp).catch(() => {}); }
  }
};

async function acquire(dir) {
  // The OS releases this ownership on a crash; realpath joins aliases to the same store.
  const id = hash(process.platform === 'win32' ? dir.toLowerCase() : dir);
  const address = process.platform === 'win32' ? `\\\\.\\pipe\\agentflow-pipeline-${id}` : process.platform === 'linux' ? `\0agentflow-pipeline-${id}` : join(dir, 'owner.socket');
  const server = createServer(socket => socket.destroy());
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(address, resolve); });
  server.unref();
  return () => new Promise(resolve => server.close(resolve));
}

function cost(provider, model, input, output) {
  if (provider === 'deepseek') return 0;
  const rate = provider === 'openai' && MAP_OPENAI_RATES[model];
  if (!rate) throw new ApiError('MAP_BUDGET_MODEL_UNSUPPORTED', 400);
  const n = (input * rate[0] + output * rate[1]) * 1000;
  if (!natural(n)) throw new ApiError('MAP_BUDGET_INVALID', 400);
  return n;
}
function usageTokens(usage) {
  if (!plain(usage)) return null;
  const input = usage.input_tokens ?? usage.inputTokens ?? usage.prompt_tokens;
  const output = usage.output_tokens ?? usage.outputTokens ?? usage.completion_tokens;
  return natural(input) && natural(output) ? [input, output] : null;
}
/** .30: what a completed first-map stage set aside on its first pass: fixed paths, rules and categories only (at most 64). */
const validSetAside = list => Array.isArray(list) && list.length >= 1 && list.length <= 64 && list.every(x => plain(x) && Object.keys(x).length === 3
  && typeof x.path === 'string' && x.path.length <= 160 && /^[A-Za-z]+(\[\d{1,4}\])?(\.[A-Za-z]+(\[\d{1,4}\])?)*$/.test(x.path)
  && typeof x.rule === 'string' && /^[a-z][a-z-]{0,39}$/.test(x.rule) && (x.category === null || typeof x.category === 'string' && /^[a-z][a-z-]{0,39}$/.test(x.category)));
function validate(body) {
  if (!plain(body) || !plain(body.jobs) || Object.keys(body.jobs).length > 10000) throw Error('damaged');
  for (const [key, job] of Object.entries(body.jobs)) {
    if (!validKey(key) || !plain(job) || !plain(job.stages)) throw Error('damaged');
    for (const [name, stage] of Object.entries(job.stages)) {
      if (!validStage(name) || !plain(stage) || !['running', 'complete', 'failed', 'uncertain'].includes(stage.state) || !Array.isArray(stage.attempts) || !stage.attempts.length) throw Error('damaged');
      if (stage.state === 'complete' && !own(stage, 'value')) throw Error('damaged');
      if (own(stage, 'diagnostic') && !validDiagnostic(stage.diagnostic)) throw Error('damaged');
      if (own(stage, 'setAside') && (stage.state !== 'complete' || !validSetAside(stage.setAside))) throw Error('damaged');
      for (const a of stage.attempts) {
        if (!plain(a) || !/^\d{4}-\d{2}$/.test(a.month) || !natural(a.inputBytes) || !natural(a.maxOutputTokens) || !natural(a.reserved) || !natural(a.charged) || a.charged > a.reserved || cost(a.provider, a.model, a.inputBytes, a.maxOutputTokens) !== a.reserved) throw Error('damaged');
      }
    }
  }
}

/** get() returns only a completed value (or null). Missing usage never refunds a reservation.
 * failed(...,{uncertain:false}) is reserved for a known completed provider outcome; the next explicit run may retry it.
 * close() releases the exclusive process owner after current runs finish. No paid calls or credentials enter this module.
 */
export async function openMapPipelineStore({ dir, monthlyUsd = 20, runUsd = 1, now = () => new Date(), io = pipelineFileIo } = {}) {
  if (![monthlyUsd, runUsd].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && natural(Math.round(n * NANO)))) throw new ApiError('MAP_BUDGET_INVALID', 400);
  const monthlyLimit = Math.floor(monthlyUsd * NANO), runLimit = Math.floor(runUsd * NANO);
  let body = { jobs: {} }, problem = null, release = null, directory, closed = false, closing = false, queue = Promise.resolve();
  const active = new Set(), running = new Set();
  const date = () => { const d = new Date(now()); if (!Number.isFinite(d.valueOf())) throw new ApiError('MAP_BUDGET_INVALID', 400); return d; };
  try {
    await mkdir(dir, { recursive: true, mode: 0o700 }); directory = await realpath(dir); release = await acquire(directory);
    try {
      const text = await readFile(join(directory, FILE), 'utf8');
      if (Buffer.byteLength(text) > MAX_BYTES) throw Error('damaged');
      const file = JSON.parse(text);
      if (file.format !== FORMAT || hash(JSON.stringify(file.body)) !== file.sha256) throw Error('damaged');
      validate(file.body); body = file.body;
    } catch (e) { if (e?.code !== 'ENOENT') throw e; }
    // Probe actual persistence even for a new empty ledger. Existing running stages remain uncertain on reads.
    await write(body);
  } catch (e) { problem = e?.code === 'EADDRINUSE' ? 'STORE_BUSY' : 'STORE_UNAVAILABLE'; if (release) { await release(); release = null; } }

  function available() { if (problem || closed) throw new ApiError('MAP_PIPELINE_STORE_UNAVAILABLE', 503); }
  function identity(key, stage) { if (!validKey(key) || !validStage(stage)) throw new ApiError('MAP_PIPELINE_INVALID', 400); }
  function serial(fn) { const p = queue.then(fn, fn); queue = p.catch(() => {}); return p; }
  async function write(next) {
    const text = JSON.stringify({ format: FORMAT, body: next, sha256: hash(JSON.stringify(next)) });
    if (Buffer.byteLength(text) > MAX_BYTES) throw new ApiError('MAP_PIPELINE_STORE_FULL', 507);
    await io.writeAtomic(directory, FILE, text);
  }
  async function persist(next) {
    available();
    try { await write(next); body = next; }
    catch (e) { problem = 'STORE_WRITE_FAILED'; throw e instanceof ApiError ? e : new ApiError('MAP_PIPELINE_STORE_UNAVAILABLE', 503); }
  }
  function totals(key, month) {
    let monthly = 0, run = 0;
    for (const [k, job] of Object.entries(body.jobs)) for (const s of Object.values(job.stages)) for (const a of s.attempts) {
      if (a.month === month) monthly += a.charged;
      if (k === key) run += a.charged;
    }
    return { monthly, run };
  }
  function get(key, stage) {
    available(); identity(key, stage);
    const s = body.jobs[key]?.stages[stage];
    if (s && ['running', 'uncertain'].includes(s.state)) throw new ApiError('MAP_STAGE_UNCERTAIN', 409);
    return s?.state === 'complete' ? clone(s.value) : null;
  }
  async function begin(key, stage, { provider, model, inputBytes, maxOutputTokens } = {}) {
    return serial(async () => {
      available(); identity(key, stage);
      if (!natural(inputBytes) || !natural(maxOutputTokens)) throw new ApiError('MAP_BUDGET_INVALID', 400);
      const prior = body.jobs[key]?.stages[stage];
      if (prior?.state === 'complete') throw new ApiError('MAP_STAGE_ALREADY_COMPLETE', 409);
      if (prior && ['running', 'uncertain'].includes(prior.state)) throw new ApiError('MAP_STAGE_UNCERTAIN', 409);
      const reserved = cost(provider, model, inputBytes, maxOutputTokens), month = date().toISOString().slice(0, 7), used = totals(key, month);
      if (used.monthly + reserved > monthlyLimit || used.run + reserved > runLimit) throw new ApiError('MAP_BUDGET_EXCEEDED', 429);
      if (!own(body.jobs, key) && Object.keys(body.jobs).length >= 10000) throw new ApiError('MAP_PIPELINE_STORE_FULL', 507);
      const next = clone(body); next.jobs[key] ??= { stages: {} };
      const attempts = [...(prior?.attempts ?? []), { month, provider, model, inputBytes, maxOutputTokens, reserved, charged: reserved }];
      next.jobs[key].stages[stage] = { state: 'running', attempts };
      await persist(next);
      return { attempt: attempts.length, reservedUsd: reserved / NANO };
    });
  }
  async function finish(key, stage, options, complete) {
    return serial(async () => {
      available(); identity(key, stage);
      const prior = body.jobs[key]?.stages[stage];
      if (!prior || prior.state !== 'running') throw new ApiError('MAP_PIPELINE_INVALID', 409);
      const next = clone(body), s = next.jobs[key].stages[stage], a = s.attempts.at(-1), tokens = usageTokens(options.usage);
      if (tokens) {
        // Usage outside the reservation is evidence that our upper bound was invalid: keep the ceiling, stop resending.
        if (tokens[0] > a.inputBytes || tokens[1] > a.maxOutputTokens) throw new ApiError('MAP_STAGE_UNCERTAIN', 409);
        a.charged = cost(a.provider, a.model, ...tokens);
      }
      if (complete) {
        if (!own(options, 'value') || options.value === undefined) throw new ApiError('MAP_PIPELINE_INVALID', 400);
        // JSON round trip prevents an in-memory success that cannot survive a restart.
        s.value = JSON.parse(JSON.stringify(options.value)); s.state = 'complete';
        if (own(options, 'setAside')) { if (!validSetAside(options.setAside)) throw new ApiError('MAP_PIPELINE_INVALID', 400); s.setAside = JSON.parse(JSON.stringify(options.setAside)); }
      } else {
        s.state = options.uncertain === false ? 'failed' : 'uncertain';
        const diagnostic = stageDiagnostic(options.diagnostic, date().toISOString());
        if (diagnostic) s.diagnostic = diagnostic;
      }
      await persist(next);
      return complete ? clone(s.value) : undefined;
    });
  }
  function run(key, fn) {
    available(); if (!validKey(key) || typeof fn !== 'function') throw new ApiError('MAP_PIPELINE_INVALID', 400);
    if (closing) throw new ApiError('MAP_PIPELINE_STORE_UNAVAILABLE', 503);
    if (active.has(key)) throw new ApiError('MAP_PIPELINE_BUSY', 409);
    active.add(key);
    const task = Promise.resolve().then(fn).finally(() => { active.delete(key); running.delete(task); });
    running.add(task); return task;
  }
  /** The most recent refusal kept for one key (or, without a key, for any): { stage, phase, rule?, path?, category?, reason?, total?, at }. */
  function lastFailure(key = null) {
    let last = null;
    for (const [k, job] of Object.entries(body.jobs)) {
      if (key !== null && k !== key) continue;
      for (const s of Object.values(job.stages)) if (s.diagnostic && (!last || s.diagnostic.at >= last.at)) last = s.diagnostic;
    }
    return last ? clone(last) : null;
  }
  return {
    run, get, begin, lastFailure,
    complete: (key, stage, options = {}) => finish(key, stage, options, true),
    failed: (key, stage, options = {}) => finish(key, stage, options, false),
    describe() { const month = date().toISOString().slice(0, 7); return { durable: !problem && !closed, problem, openaiOnly: true, monthlyUsd, runUsd, month, spentUsd: totals(null, month).monthly / NANO, lastFailure: lastFailure() }; },
    async close() { closing = true; await Promise.allSettled([...running]); await queue; closed = true; if (release) { const unlock = release; release = null; await unlock(); } }
  };
}
