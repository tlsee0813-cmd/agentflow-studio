// Recipe .50 step 2: replay helpers for the stored growth-run artefacts (stage4-r4, stage4-r6), model-free. The stored stages stand in a
// fake store; the one stage those runs never reached (global) is a fake global wire with nothing of its own. Imported by
// containment50.test.mjs only when AF_GROWTH_DIR is set; the artefacts never enter the repo.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createFirstMapPipeline } from '../server/map-pipeline.mjs';

export const emptyGlobal = () => ({ summary: '', parts: [], relations: [], candidates: [], gaps: [], matches: [], material: [] });
const json = (dir, f) => JSON.parse(readFileSync(join(dir, f), 'utf8'));
/** A run's stored stages (by stage id), its map input and the ask the pipeline read. */
export function storedRun(growth, run) {
  const dir = join(growth, 'runs', run), pipeline = json(dir, 'jobs/first-map/pipeline.json'), job = Object.values(pipeline.body.jobs)[0];
  const input = json(dir, 'input.json');
  return { stages: job.stages, input: input.input, ask: input.input.ask };
}
/** A store that answers every completed stored stage and records what else is asked of it (begin/complete for the fake calls). */
export function replayStore(stages) {
  const extra = new Map(), began = [];
  return {
    began, extra,
    describe: () => ({ durable: true, problem: null }),
    run: (_key, fn) => fn(),
    get: (_key, id) => extra.has(id) ? structuredClone(extra.get(id).value) : stages[id]?.state === 'complete' ? structuredClone(stages[id].value) : null,
    begin: async (_key, id) => { began.push(id); },
    complete: async (_key, id, record) => { extra.set(id, structuredClone(record)); },
    failed: async () => {},
    pendingResponse: () => null, noteResponse: () => {},
  };
}
/** The pipeline over the stored stages with the run's own settings (Terra render and global, 3500-character partitions); every call
 * that reaches the provider is recorded and answered by `answer` (the fake global wire unless told otherwise). */
export function replayPipeline(stages, answer = () => emptyGlobal()) {
  const store = replayStore(stages), calls = [];
  const callProvider = async options => {
    await options.onDispatch();
    const input = JSON.parse(options.input), stage = input.partition ? 'extract' : input.assignment ? 'render' : input.renderedParts ? 'global' : 'plan';
    calls.push({ stage, input });
    const value = answer({ stage, input });
    const usage = { inputTokens: 0, outputTokens: 0 }; options.onUsage(usage);
    return { value, usage, provider: options.provider, model: options.model };
  };
  const pipeline = createFirstMapPipeline({ store, deepseekKey: 'fake-deepseek', openaiKey: 'fake-openai', mergeModel: 'gpt-6.1-sol', renderModel: 'gpt-6.1-terra', globalModel: 'gpt-6.1-terra',
    targetChars: 3500, maxPartitions: 12, firstMaxPartitions: 24, planTimeoutMs: 1200000, renderTokens: 16384, globalTokens: 16384, mergeTokens: 32768, callProvider, fetchImpl: async () => new Response('{}') });
  return { pipeline, store, calls };
}
