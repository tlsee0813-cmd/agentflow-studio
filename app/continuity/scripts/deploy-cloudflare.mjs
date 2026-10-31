// Small, dependency-free deployment using Cloudflare's documented Workers + Assets APIs.
// Secrets are environment inputs, attached as secret_text bindings, never written into assets/logs.
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, relative, resolve, posix, dirname } from 'node:path';

const app = fileURLToPath(new URL('../../', import.meta.url));
// AF124: --release=existing-map packages the limited existing-map release (its own Worker main, no map reading or jobs);
// --manifest=<file> also writes the exact Worker + assets manifest there (it is always printed). Without them, as before.
const usage = 'Usage: node [--env-file=private.env] continuity/scripts/deploy-cloudflare.mjs [--dry-run] [--release=existing-map] [--manifest=<file>]';
const args = process.argv.slice(2), opt = key => args.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3) ?? null;
if (args.some(a => a !== '--dry-run' && !/^--(release|manifest)=./.test(a)) || args.filter(a => a.startsWith('--release=')).length > 1 || args.filter(a => a.startsWith('--manifest=')).length > 1) throw new Error(usage);
const dry = args.includes('--dry-run'), policy = opt('release'), manifestOut = opt('manifest');
const RELEASES = { 'existing-map': 'continuity/server/worker-existing-map.mjs' };
if (policy !== null && !Object.hasOwn(RELEASES, policy)) throw new Error(usage);
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: app, encoding: 'utf8' }).trim();
const appTree = execFileSync('git', ['rev-parse', 'HEAD:app'], { cwd: app, encoding: 'utf8' }).trim();
const dirty = !!execFileSync('git', ['status', '--porcelain'], { cwd: app, encoding: 'utf8' }).trim();
if (!dry && dirty) throw new Error('Commit the intended release before deployment.');
// The public site's Worker keeps its default name; a limited release goes only to a Worker named for it explicitly, never that one.
const DEFAULT_NAME = 'agentflow-studio';
const name = process.env.CLOUDFLARE_WORKER_NAME || (policy ? null : DEFAULT_NAME);
if (policy && name === DEFAULT_NAME) throw new Error(`The ${policy} release is never deployed to the default Worker ${DEFAULT_NAME}.`);
if (policy && !name && !dry) throw new Error(`Name the Worker of the ${policy} release with CLOUDFLARE_WORKER_NAME.`);
if (name !== null && !/^[a-z][a-z0-9-]{2,62}$/.test(name)) throw new Error('Invalid Worker name.');
const account = process.env.CLOUDFLARE_ACCOUNT_ID, token = process.env.CLOUDFLARE_API_TOKEN;
const secretNames = ['DEEPSEEK_API_KEY', 'STUDIO_ACCESS_CODE'];
// The web AI connector (server/cloud-connector.mjs) goes along when its GitHub OAuth app is given: a KV namespace of its own
// (made once, found by name after that), the app's id and secret, and an optional allow-list of GitHub logins (empty: everyone).
const connector = !!(process.env.GITHUB_CLIENT_ID?.trim() && process.env.GITHUB_CLIENT_SECRET?.trim());
const CONNECTOR_KV_TITLE = process.env.CONNECTOR_KV_TITLE || 'agentflow-connector';
const CLOUD_PATHS = ['/mcp', '/.well-known/*', '/oauth/*', '/auth/*'];
if (!dry) {
  if (!/^[a-f0-9]{32}$/i.test(account || '') || !token) throw new Error('Cloudflare account ID and API token required.');
  for (const key of secretNames) if (!process.env[key]?.trim()) throw new Error(`${key} required for public AI deployment.`);
}
for (const script of ['build.mjs', 'build-static.mjs']) {
  const run = spawnSync(process.execPath, [join(app, 'continuity/scripts', script), ...(script === 'build-static.mjs' ? ['--preview'] : [])], {
    cwd: app, env: { ...process.env, STUDIO_API_BASE: 'same-origin' }, encoding: 'utf8'
  });
  if (run.status !== 0) throw new Error(`Build failed: ${script}\n${run.stderr}`);
}
const assetDir = join(app, 'continuity/static-dist');
await writeFile(join(assetDir, 'BUILD.txt'), `AgentFlow Studio\nsource=${sha}\nhost=Cloudflare Workers\n${policy ? `release=${policy}\n` : ''}`);
const files = async dir => (await Promise.all((await readdir(dir, { withFileTypes: true })).map(e => e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]))).flat();
const mime = f => f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.css') ? 'text/css; charset=utf-8' : f.endsWith('.js') ? 'application/javascript; charset=utf-8' : 'text/plain; charset=utf-8';
const secrets = [...secretNames, 'CLOUDFLARE_API_TOKEN', 'GITHUB_CLIENT_SECRET'].map(k => process.env[k]).filter(Boolean);
const assertNoSecret = (bytes, label) => { for (const value of secrets) if (bytes.includes(Buffer.from(value))) throw new Error(`Secret found in ${label}; stopped before upload.`); };
const manifest = {}, assets = new Map(), assetList = [];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
for (const file of await files(assetDir)) {
  const path = '/' + relative(assetDir, file).replaceAll('\\', '/');
  if (!/^(\/index\.html|\/styles\.css|\/BUILD\.txt|\/\.nojekyll|\/(client|shared)\/[\w-]+\.js)$/.test(path)) throw new Error(`Unexpected public asset: ${path}`);
  const bytes = await readFile(file); assertNoSecret(bytes, path);
  const hash = createHash('sha256').update(bytes).update(mime(file)).digest('hex').slice(0, 32);
  manifest[path] = { hash, size: bytes.length }; assets.set(hash, { bytes, type: mime(file) }); assetList.push({ path, bytes: bytes.length, sha256: sha256(bytes) });
}
// Preserve relative module names; Cloudflare supports native ES modules, so no bundler/runtime install is needed.
const modules = new Map();
async function collect(path) {
  if (modules.has(path)) return;
  if (path.startsWith('../') || !/\.(mjs|js)$/.test(path)) throw new Error(`Invalid Worker module ${path}`);
  const bytes = await readFile(resolve(app, path)); assertNoSecret(bytes, path);
  const code = bytes.toString('utf8');
  if (/\b(?:import\s*\(|require\s*\(|from\s*['"]node:)/.test(code)) throw new Error(`Unsupported Worker import in ${path}`);
  modules.set(path, bytes);
  for (const match of code.matchAll(/^\s*(?:import|export)\s+(?:[^;\n]*?\s+from\s*)?['"]([^'"]+)['"]/gm)) {
    if (!match[1].startsWith('.')) throw new Error(`Non-relative import in ${path}`);
    await collect(posix.normalize(posix.join(posix.dirname(path), match[1])));
  }
}
const main = policy ? RELEASES[policy] : 'continuity/server/worker.mjs';
await collect(main);
// A limited release carries none of the local Node host: no job store, CLI executor, Node server or its config/static files.
if (policy) for (const path of modules.keys()) if (/(^|\/)(map-jobs|index|app|config|static-files|mock|[\w-]*(cli|executor)[\w-]*)\.m?js$/i.test(path)) throw new Error(`Local-only module in the ${policy} Worker: ${path}`);
const built = await readFile(join(assetDir, 'client/static-target.js'), 'utf8'), prefix = /prefix:\s*'([^']+)'/.exec(built)?.[1] ?? null;
const endpoint = await readFile(join(assetDir, 'client/studio-endpoint.js'), 'utf8');
if (!/STUDIO_ENDPOINT = "";/.test(endpoint) || !prefix) throw new Error('The packaged UI must call its own origin and name its storage prefix.');
assetList.sort((a, b) => (a.path < b.path ? -1 : 1));
const moduleList = [...modules].map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) })).sort((a, b) => (a.path < b.path ? -1 : 1));
const closure = list => sha256(list.map(m => `${m.sha256}  ${m.path}\n`).join(''));
const release = { version: 'agentflow.release-manifest.1', source: sha, appTree, dirty, policy, worker: name, main, compatibilityDate: '2026-10-24',
  api: { base: 'same-origin', connectSrc: "'self'", paths: '/api/*' }, storagePrefix: prefix,
  assets: { count: assetList.length, bytes: assetList.reduce((n, x) => n + x.bytes, 0), sha256: closure(assetList), files: assetList },
  modules: { count: moduleList.length, bytes: moduleList.reduce((n, x) => n + x.bytes, 0), sha256: closure(moduleList), files: moduleList },
  bindings: ['ASSETS', ...secretNames, 'AI_MODE', 'DEEPSEEK_MODEL', ...(connector ? ['CONNECTOR_KV', 'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', ...(process.env.ALLOWED_GITHUB_LOGINS ? ['ALLOWED_GITHUB_LOGINS'] : [])] : [])],
  connector: connector ? { kv: CONNECTOR_KV_TITLE, workerFirst: CLOUD_PATHS } : null };
if (manifestOut) await mkdir(dirname(resolve(process.cwd(), manifestOut)), { recursive: true }), await writeFile(resolve(process.cwd(), manifestOut), `${JSON.stringify(release, null, 2)}\n`);
console.log(JSON.stringify({ phase: 'prepared', source: sha, worker: name, policy, assets: assets.size, modules: modules.size, bytes: [...assets.values()].reduce((n, x) => n + x.bytes.length, 0), dryRun: dry }));
console.log(JSON.stringify({ phase: 'manifest', ...release }));
if (dry) process.exit(0);
const base = `https://api.cloudflare.com/client/v4/accounts/${account}/workers`;
async function api(path, { method = 'GET', body, bearer = token } = {}) {
  const json = body && !(body instanceof FormData);
  const res = await fetch(base + path, { method, redirect: 'error', signal: AbortSignal.timeout(120000), headers: { Authorization: `Bearer ${bearer}`, ...(json ? { 'Content-Type': 'application/json' } : {}) }, body: json ? JSON.stringify(body) : body });
  let result; try { result = await res.json(); } catch { throw new Error(`Cloudflare HTTP ${res.status}`); }
  if (!res.ok || !result.success) throw new Error(`Cloudflare HTTP ${res.status}; error codes ${(result.errors || []).map(e => e.code).join(',')}`);
  return result.result;
}
const sub = await api('/subdomain');
if (!sub.subdomain) throw new Error('Choose a workers.dev subdomain in Cloudflare first.');
const session = await api(`/scripts/${name}/assets-upload-session`, { method: 'POST', body: { manifest } });
let completion = session.buckets.length === 0 ? session.jwt : null;
for (const bucket of session.buckets) {
  const form = new FormData();
  for (const hash of bucket) {
    const asset = assets.get(hash); if (!asset) throw new Error('Unknown asset requested by Cloudflare.');
    form.append(hash, new Blob([asset.bytes.toString('base64')], { type: asset.type }), hash);
  }
  const uploaded = await api('/assets/upload?base64=true', { method: 'POST', body: form, bearer: session.jwt });
  if (uploaded?.jwt) completion = uploaded.jwt;
}
if (!completion) throw new Error('Cloudflare asset upload did not return a completion token.');
/** The connector's KV namespace id: the one named CONNECTOR_KV_TITLE, made when there is none. */
async function connectorNamespace() {
  const kvBase = `https://api.cloudflare.com/client/v4/accounts/${account}/storage/kv/namespaces`;
  const call = async (url, init = {}) => { const res = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(60000), ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }); const r = await res.json().catch(() => null); if (!res.ok || !r?.success) throw new Error(`Cloudflare KV HTTP ${res.status}; error codes ${(r?.errors || []).map(e => e.code).join(',')} (the API token needs Workers KV Storage: Edit)`); return r.result; };
  for (let page = 1; page < 20; page++) { const list = await call(`${kvBase}?per_page=100&page=${page}`); const hit = list.find(n => n.title === CONNECTOR_KV_TITLE); if (hit) return hit.id; if (list.length < 100) break; }
  return (await call(kvBase, { method: 'POST', body: JSON.stringify({ title: CONNECTOR_KV_TITLE }) })).id;
}
const connectorBindings = connector ? [{ name: 'CONNECTOR_KV', type: 'kv_namespace', namespace_id: await connectorNamespace() }, { name: 'GITHUB_CLIENT_ID', type: 'plain_text', text: process.env.GITHUB_CLIENT_ID.trim() },
  { name: 'GITHUB_CLIENT_SECRET', type: 'secret_text', text: process.env.GITHUB_CLIENT_SECRET.trim() }, ...(process.env.ALLOWED_GITHUB_LOGINS ? [{ name: 'ALLOWED_GITHUB_LOGINS', type: 'plain_text', text: process.env.ALLOWED_GITHUB_LOGINS }] : [])] : [];
const bindings = [{ name: 'ASSETS', type: 'assets' }, ...connectorBindings, ...secretNames.map(name => ({ name, type: 'secret_text', text: process.env[name] })),
  { name: 'AI_MODE', type: 'plain_text', text: 'deepseek' }, { name: 'DEEPSEEK_MODEL', type: 'plain_text', text: process.env.DEEPSEEK_MODEL || 'deepseek-flash' }];
const metadata = { main_module: main, compatibility_date: '2026-10-24', bindings,
  assets: { jwt: completion, config: { run_worker_first: ['/api/*', ...(connector ? CLOUD_PATHS : [])], html_handling: 'auto-trailing-slash', not_found_handling: '404-page' } },
  annotations: { 'workers/message': `AgentFlow Studio ${sha}${policy ? ` ${policy}` : ''}`, 'workers/tag': sha.slice(0, 12) } };
const form = new FormData(); form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
for (const [path, bytes] of modules) form.append(path, new Blob([bytes], { type: 'application/javascript+module' }), path);
const uploaded = await api(`/scripts/${name}`, { method: 'PUT', body: form });
await api(`/scripts/${name}/subdomain`, { method: 'POST', body: { enabled: true, previews_enabled: false } });
console.log(JSON.stringify({ phase: 'deployed', source: sha, version: uploaded.version_id ?? uploaded.id, url: `https://${name}.${sub.subdomain}.workers.dev`, connector: connector ? `https://${name}.${sub.subdomain}.workers.dev/mcp` : 'off (no GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET)' }));
