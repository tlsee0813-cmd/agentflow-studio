// AF116: writes the lawful ready6 fixture with the pre116 producer and codec, never with 116 code. Run against a checkout of
// db63a4293aad5983feafca70c4016ec1abc4874d whose app/continuity/dist was built from that checkout:
//   node docs/cycles/2026-10-30-condition-reference-116/make-ready6.mjs <pre116 checkout> <out dir>
// Every module that builds the project, the map.6 later ask, the job input (map-input.1), the binding (map-job.1), the m6 recipe,
// the standard handler and the durable job store is imported from <pre116 checkout>. Only the author-written fixture composition
// (tests/condition116-case.mjs: pure calls on the modules it is given) and the map.6 reply below come from this commit. The fake
// provider answers once; no network, no model. The out dir receives the job store (store.json, ops/), manifest.json, and the same
// project as a pre116 backup (project14-backup.json) with its plan bundle (plans-bundle.json) for the normal-UI check.
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const [root, out] = process.argv.slice(2).map(x => resolve(x));
if (!root || !out) throw new Error('usage: make-ready6.mjs <pre116 checkout> <out dir>');
const PRE116 = 'db63a4293aad5983feafca70c4016ec1abc4874d';
const head = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (head !== PRE116) throw new Error(`not the pre116 producer: ${head}`);
const at = rel => import(pathToFileURL(join(root, 'app/continuity', rel)).href);
const D = await at('dist/public/shared/domain.js'), M = await at('dist/public/shared/map-reading.js'), C = await at('dist/public/shared/change-plan.js'), S = await at('dist/public/shared/storage.js');
const J = await at('dist/public/shared/map-job.js'), { studioView } = await at('dist/public/shared/studio.js'), { emptyBundle } = await at('dist/public/client/plan-store.js');
const { parseProject } = await at('dist/public/shared/validation.js'), { parseBundle } = await at('dist/public/client/plan-store.js');
const { createStudioHandler, mapPromptId } = await at('server/studio.mjs'), { openMapJobs } = await at('server/map-jobs.mjs');
if (M.MAP7_SCHEMA !== undefined) throw new Error('the producer knows studio.map.7: not pre116');
const K = await import(new URL('../../../app/continuity/tests/condition116-case.mjs', import.meta.url).href);

const { project, bundle, rq } = K.conditionProject({ D, M, C, S, studioView, emptyBundle });
const p = parseProject(JSON.stringify(project)), inp = M.buildMapAsk(p, studioView(p), [rq], rq.id, M.MAP6_SCHEMA);
if (inp.problem || inp.ask.schemaVersion !== 'studio.map.6') throw new Error('not a later map.6 ask');
// The map.6 reply as a pre116 reader answers it (plain about strings), checked by the pre116 validator.
const wire = K.replyFor6(inp.ask, inp.records);
M.validateMapReply(wire, inp.ask);

rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
let calls = 0;
const fetchImpl = async () => { calls++; return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(wire) } }] }), { status: 200 }); };
const jobs = await openMapJobs({ dir: out }), handle = createStudioHandler({ env: { DEEPSEEK_API_KEY: 'k-fixture-116', STUDIO_REQUESTS_PER_MINUTE: '60' }, fetchImpl, jobs });
const status = await (await handle(new Request('http://127.0.0.1/api/studio/status'))).json();
const id = `MJ_${randomUUID()}`, cap = randomBytes(32).toString('base64url'), input = J.encodeMapInput(inp), prompt = await mapPromptId();
const binding = { entryId: 'E_ready6-116a', projectId: p.id, lifecycle: 1, seq: 1, after: inp.after, schemaVersion: inp.ask.schemaVersion, prompt, model: status.map.model, askHash: await J.jobHash(inp.ask), inputHash: await J.jobHash(input) };
const post = await handle(new Request('http://127.0.0.1/api/studio/jobs', { method: 'POST', headers: { 'content-type': 'application/json', 'x-agentflow-request': '1', 'x-studio-operation': cap }, body: JSON.stringify({ version: 'map-job.1', id, binding, input }) }));
if (post.status !== 202) throw new Error(`not accepted: ${post.status} ${await post.text()}`);
let v; for (let i = 0; i < 400; i++) { v = await (await handle(new Request(`http://127.0.0.1/api/studio/jobs/${id}`, { headers: { 'x-agentflow-request': '1', 'x-studio-operation': cap } }))).json(); if (v.state === 'ready') break; await new Promise(r => setTimeout(r, 5)); }
await jobs.close();
if (v.state !== 'ready' || calls !== 1) throw new Error(`not ready once: ${v.state} ${calls}`);
parseBundle(JSON.parse(JSON.stringify(bundle)), p.id);
writeFileSync(join(out, 'project14-backup.json'), S.serializeBackup(p, null)); writeFileSync(join(out, 'plans-bundle.json'), JSON.stringify(bundle));
const sha = b => createHash('sha256').update(b).digest('hex');
const files = Object.fromEntries(['store.json', 'project14-backup.json', 'plans-bundle.json', ...readdirSync(join(out, 'ops')).map(f => `ops/${f}`)].map(f => [f, sha(readFileSync(join(out, f)))]));
writeFileSync(join(out, 'manifest.json'), JSON.stringify({ format: 'af116.ready6-fixture.1', producer: { commit: head, build: 'app/continuity/dist of that commit (offline PATH tsc 6.0.2 emit; not npm ci evidence)', status: status.map },
  job: { id, cap, entryId: binding.entryId, state: v.state, prompt, askHash: binding.askHash, inputHash: binding.inputHash, providerCalls: calls },
  project, bundle, files }, null, 1) + '\n');
console.log(JSON.stringify({ id, prompt, status: status.map, files }));
