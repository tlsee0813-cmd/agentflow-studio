import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBatch, resumeCase } from './engine.mjs';
import { readJSON } from './transport.mjs';
import { renderRun } from './report.mjs';
export async function main(args) {
  const { values: v, positionals: p } = parseArgs({ args, strict: true, allowPositionals: true,
    options: Object.fromEntries(['mode', 'out', 'run', 'case', 'answer'].map(k => [k, { type: 'string' }])) });
  if (p.length !== 1) throw new Error('USAGE');
  if (p[0] === 'run' && v.mode && v.out && !v.run && !v.answer) {
    return runBatch({ mode: v.mode, out: resolve(v.out), ...(v.case ? { caseIds: [v.case] } : {}) });
  }
  if (p[0] === 'resume' && v.run && v.case && v.answer && !v.mode && !v.out) {
    return resumeCase({ root: resolve(v.run), caseId: v.case, answer: readJSON(resolve(v.answer)) });
  }
  if (p[0] === 'report' && v.run && Object.keys(v).length === 1) return renderRun(resolve(v.run));
  throw new Error('USAGE');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await main(process.argv.slice(2));
    console.log(JSON.stringify(result, null, 2));
    // A waiting question is not a provider error. Inspect REPORT.md for every case state.
    const run = readJSON(resolve(result.report, '..', 'run.json'));
    const { existsSync } = await import('node:fs');
    if (run.caseIds.some(id => {
      const path = resolve(result.report, '..', id, 'checkpoint.json');
      return existsSync(path) && ['failed', 'inflight'].includes(readJSON(path).phase);
    })) process.exitCode = 1;
  } catch (e) {
    const allowed = /^(USAGE|MODE_REQUIRED|UNKNOWN_CASE|CASE_SELECTION|OUTPUT_ALREADY_EXISTS|LIVE_REQUIRES_DEEPSEEK|AI_NOT_CONFIGURED|PAID_CALLS_DISABLED|NOT_AWAITING_ANSWER|ANSWER_SHAPE|ANSWER_QUESTION_MISMATCH|ANSWER_SELECTION_REQUIRED|ANSWER_OUTSIDE_SCENARIO|BASELINE_CHANGED|RUNTIME_CONFIG_CHANGED)$/;
    const code = allowed.test(e?.message ?? '') ? e.message : 'TOOL_FAILED';
    console.error(JSON.stringify({ error: code, automaticRetry: false, fallback: false }));
    if (code === 'USAGE') console.error('run --mode mock|live --out NEW_DIR [--case C01]\nresume --run DIR --case C02 --answer FILE\nreport --run DIR');
    process.exitCode = 1;
  }
}
