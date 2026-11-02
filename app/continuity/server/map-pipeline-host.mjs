import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { join } from 'node:path';
import { openMapPipelineStore } from './map-pipeline-store.mjs';
import { createFirstMapPipeline } from './map-pipeline.mjs';

const ALLOWED = ['OPENAI_API_KEY', 'STUDIO_MAP_MERGE_MODEL', 'STUDIO_MAP_MONTHLY_USD', 'STUDIO_MAP_RUN_USD'];
/** This is a server-only local file, never a browser setting, bundle asset, or shell command. Existing env wins. */
export async function loadMapPipelineEnv(env, read = readFile) {
  const out = { ...env };
  const path = env.STUDIO_OPENAI_ENV || (env.LOCALAPPDATA ? join(env.LOCALAPPDATA, 'AgentFlowStudio', 'openai.env') : null);
  if (!path || env.AI_MODE === 'mock') return out;
  let text;
  try { text = await read(path, 'utf8'); } catch (error) { if (error.code === 'ENOENT' && !env.STUDIO_OPENAI_ENV) return out; throw new Error('OPENAI_ENV_UNREADABLE'); }
  if (Buffer.byteLength(text) > 16384) throw new Error('OPENAI_ENV_INVALID');
  const parsed = parseEnv(text);
  for (const key of ALLOWED) if (!Object.hasOwn(out, key) && parsed[key]) out[key] = parsed[key];
  return out;
}
export async function openFirstMapPipeline({ env, dir, fetchImpl, onProgress } = {}) {
  if (env.AI_MODE === 'mock' || !env.OPENAI_API_KEY || env.STUDIO_FIRST_MAP === 'single') return null;
  if (!dir) throw new Error('FIRST_MAP_NEEDS_DURABLE_JOBS');
  const limit = (key, fallback) => { const n = Number(env[key] || fallback); if (!Number.isFinite(n) || n <= 0 || n > 200) throw new Error('FIRST_MAP_BUDGET_INVALID'); return n; };
  const store = await openMapPipelineStore({ dir: join(dir, 'first-map'), monthlyUsd: limit('STUDIO_MAP_MONTHLY_USD', 20), runUsd: limit('STUDIO_MAP_RUN_USD', 1) });
  try {
    const pipeline = createFirstMapPipeline({ store, deepseekKey: env.DEEPSEEK_API_KEY, openaiKey: env.OPENAI_API_KEY,
      deepseekModel: env.DEEPSEEK_PLAN_MODEL || env.DEEPSEEK_MODEL || 'deepseek-flash', mergeModel: env.STUDIO_MAP_MERGE_MODEL || 'gpt-6.1-sol', fetchImpl, onProgress });
    return { ...pipeline, close: () => store.close() };
  } catch (error) { await store.close(); throw error; }
}
