// Small, dependency-free deployment using Cloudflare's documented Workers + Assets APIs.
// Secrets are environment inputs, attached as secret_text bindings, never written into assets/logs.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, relative, resolve, posix } from 'node:path';

const app = fileURLToPath(new URL('../../', import.meta.url));
const dry = process.argv.includes('--dry-run');
if (process.argv.slice(2).some(a => a !== '--dry-run')) throw new Error('Usage: node [--env-file=private.env] continuity/scripts/deploy-cloudflare.mjs [--dry-run]');
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: app, encoding: 'utf8' }).trim();
if (!dry && execFileSync('git', ['status', '--porcelain'], { cwd: app, encoding: 'utf8' }).trim()) throw new Error('Commit the intended release before deployment.');
const name = process.env.CLOUDFLARE_WORKER_NAME || 'agentflow-studio';
if (!/^[a-z][a-z0-9-]{2,62}$/.test(name)) throw new Error('Invalid Worker name.');
const account = process.env.CLOUDFLARE_ACCOUNT_ID, token = process.env.CLOUDFLARE_API_TOKEN;
const secretNames = ['DEEPSEEK_API_KEY', 'STUDIO_ACCESS_CODE'];
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
await writeFile(join(assetDir, 'BUILD.txt'), `AgentFlow Studio\nsource=${sha}\nhost=Cloudflare Workers\n`);
const files = async dir => (await Promise.all((await readdir(dir, { withFileTypes: true })).map(e => e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]))).flat();
const mime = f => f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.css') ? 'text/css; charset=utf-8' : f.endsWith('.js') ? 'application/javascript; charset=utf-8' : 'text/plain; charset=utf-8';
const secrets = [...secretNames, 'CLOUDFLARE_API_TOKEN'].map(k => process.env[k]).filter(Boolean);
const assertNoSecret = (bytes, label) => { for (const value of secrets) if (bytes.includes(Buffer.from(value))) throw new Error(`Secret found in ${label}; stopped before upload.`); };
const manifest = {}, assets = new Map();
for (const file of await files(assetDir)) {
  const path = '/' + relative(assetDir, file).replaceAll('\\', '/');
  if (!/^(\/index\.html|\/styles\.css|\/BUILD\.txt|\/\.nojekyll|\/(client|shared)\/[\w-]+\.js)$/.test(path)) throw new Error(`Unexpected public asset: ${path}`);
  const bytes = await readFile(file); assertNoSecret(bytes, path);
  const hash = createHash('sha256').update(bytes).update(mime(file)).digest('hex').slice(0, 32);
  manifest[path] = { hash, size: bytes.length }; assets.set(hash, { bytes, type: mime(file) });
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
const main = 'continuity/server/worker.mjs';
await collect(main);
console.log(JSON.stringify({ phase: 'prepared', source: sha, worker: name, assets: assets.size, modules: modules.size, bytes: [...assets.values()].reduce((n, x) => n + x.bytes.length, 0), dryRun: dry }));
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
const bindings = [{ name: 'ASSETS', type: 'assets' }, ...secretNames.map(name => ({ name, type: 'secret_text', text: process.env[name] })),
  { name: 'AI_MODE', type: 'plain_text', text: 'deepseek' }, { name: 'DEEPSEEK_MODEL', type: 'plain_text', text: process.env.DEEPSEEK_MODEL || 'deepseek-flash' }];
const metadata = { main_module: main, compatibility_date: '2026-10-24', bindings,
  assets: { jwt: completion, config: { run_worker_first: ['/api/*'], html_handling: 'auto-trailing-slash', not_found_handling: '404-page' } },
  annotations: { 'workers/message': `AgentFlow Studio ${sha}`, 'workers/tag': sha.slice(0, 12) } };
const form = new FormData(); form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
for (const [path, bytes] of modules) form.append(path, new Blob([bytes], { type: 'application/javascript+module' }), path);
const uploaded = await api(`/scripts/${name}`, { method: 'PUT', body: form });
await api(`/scripts/${name}/subdomain`, { method: 'POST', body: { enabled: true, previews_enabled: false } });
console.log(JSON.stringify({ phase: 'deployed', source: sha, version: uploaded.version_id ?? uploaded.id, url: `https://${name}.${sub.subdomain}.workers.dev` }));
