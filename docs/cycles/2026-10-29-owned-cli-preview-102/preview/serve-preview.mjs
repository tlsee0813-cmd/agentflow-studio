// AF102 local preview launcher: the real local app (server/app.mjs: localhost host check), studio handler and AF100 job store, with
// map jobs run by this cycle's CLI executor. The default server (app/continuity/server/index.mjs) and the Worker are unchanged and
// never load this. Only the operator's policy file chooses the binary, arguments, model and deadlines; nothing comes from a browser.
//   node --env-file-if-exists=app/.env docs/cycles/2026-10-29-owned-cli-preview-102/preview/serve-preview.mjs --policy <private policy.json>
// Options: --state <dir> (default app/continuity/.studio-data/cli-preview-102; one executor state for every port, so one child at
// a time across them), --executor off (the same store with no executor: kept results stay readable, no new map job).
// Env as the local server: PORT, STUDIO_JOBS_DIR, DEEPSEEK_API_KEY (other AI features only), STUDIO_ACCESS_CODE.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { readConfig } from '../../../../app/server/config.mjs';
import { createContinuityApp } from '../../../../app/continuity/server/app.mjs';
import { createStudioHandler } from '../../../../app/continuity/server/studio.mjs';
import { openMapJobs } from '../../../../app/continuity/server/map-jobs.mjs';
import { openCliExecutor } from './cli-executor.mjs';

const args = process.argv.slice(2), opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
for (let i = 0; i < args.length; i += 2) if (!['--policy', '--state', '--executor'].includes(args[i]) || args[i + 1] === undefined) throw new Error('Usage: --policy <file> [--state <dir>] [--executor off]');
const off = opt('--executor') === 'off';
if (!off && !opt('--policy')) throw new Error('--policy <file> is required (or --executor off)');
const env = { ...process.env }, config = readConfig(env);
const dir = env.STUDIO_JOBS_DIR || (config.port ? fileURLToPath(new URL(`../../../../app/continuity/.studio-data/map-jobs-${config.port}`, import.meta.url)) : null);
if (!dir) throw new Error('A random port needs STUDIO_JOBS_DIR (the job store is per address).');
const jobs = await openMapJobs({ dir, log: m => console.log(m) });
const stateDir = opt('--state') ?? fileURLToPath(new URL('../../../../app/continuity/.studio-data/cli-preview-102', import.meta.url));
const executor = off ? null : await openCliExecutor({ policy: JSON.parse(await readFile(opt('--policy'), 'utf8')), stateDir, log: m => console.log(m) });
const studio = createStudioHandler({ env, jobs, mapExecutor: executor });
const server = createContinuityApp({ config, studio }).listen(config.port, config.host, function () {
  const j = jobs.describe(), x = executor?.describe();
  console.log(`READY http://127.0.0.1:${this.address().port} jobs=${j.durable ? 'durable' : j.problem} executor=${x ? `${x.state}${x.problem ? `:${x.problem}` : ''}` : 'off'}`);
});
// An orderly stop: the job store is fenced and its calls aborted, the child is waited for (its lease removed once it is gone), and
// only then are the store and the executor state let go. A child that will not end leaves its lease, so the next start stays closed.
let stopping = false;
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => {
  if (stopping) return; stopping = true; server.close();
  await jobs.close(); await executor?.close();
  console.log(`STOPPED executor=${executor ? JSON.stringify(executor.held()) : 'off'}`); process.exit(0);
});
