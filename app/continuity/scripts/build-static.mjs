// Static build of the same UI (continuity/static-dist), e.g. for gh-pages or a host that serves files.
// STUDIO_API_BASE (optional, build time):
//   unset        → no AI server: the page shows an honest "not connected" state, nothing is sent anywhere (connect-src 'none');
//   same-origin  → /api/studio/* on the page's own origin (a host that serves both UI and the handler);
//   https://host → that origin only (it must list this site in STUDIO_ALLOWED_ORIGINS). No credentials are ever bundled.
import { compile, compilerSource } from './compiler.mjs';
import { mkdtemp, rm, mkdir, cp, copyFile, readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const cwd = fileURLToPath(new URL('..', import.meta.url));
if (process.argv.length > 2) throw new Error('Usage: [STUDIO_API_BASE=same-origin|https://origin] node continuity/scripts/build-static.mjs');
const raw = (process.env.STUDIO_API_BASE ?? '').trim();
let endpoint = null, connect = "'none'";
if (raw === 'same-origin') { endpoint = ''; connect = "'self'"; }
else if (raw) {
  let u; try { u = new URL(raw); } catch { throw new Error('STUDIO_API_BASE must be same-origin or an https origin.'); }
  if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash || (u.pathname !== '/' && u.pathname !== '')) throw new Error('STUDIO_API_BASE must be a bare https origin (no path, query or credentials).');
  endpoint = u.origin; connect = u.origin;
}
const output = new URL('../static-dist/', import.meta.url);
const version = compile(['--version'], { cwd, encoding: 'utf8' });
if (version.status !== 0 || version.stdout.trim() !== 'Version 5.8.3') throw new Error('TypeScript 5.8.3 required.');
const stage = await mkdtemp(join(tmpdir(), 'agentflow-static-'));
try {
  const built = compile(['-p', 'tsconfig.json', '--outDir', stage], { cwd, stdio: 'inherit' });
  if (built.status !== 0) throw new Error('Static compilation failed.');
  await rm(output, { recursive: true, force: true }); await mkdir(output, { recursive: true });
  await cp(join(stage, 'shared'), new URL('shared/', output), { recursive: true });
  await cp(join(stage, 'client'), new URL('client/', output), { recursive: true });
  await copyFile(join(stage, 'client/runtime-static.js'), new URL('client/runtime.js', output));
  await rm(new URL('client/runtime-static.js', output));
  await writeFile(new URL('client/studio-endpoint.js', output), `export const STUDIO_ENDPOINT = ${JSON.stringify(endpoint)};\n`);
  let html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  html = html.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src ${connect}; object-src 'none'; base-uri 'none'; form-action 'none'">\n  <meta name="referrer" content="no-referrer">`);
  if (!html.includes('connect-src')) throw new Error('Static CSP missing.');
  await writeFile(new URL('index.html', output), html);
  await copyFile(new URL('../public/styles.css', import.meta.url), new URL('styles.css', output));
  await writeFile(new URL('.nojekyll', output), '');
  const files = async (dir, base = '') => (await Promise.all((await readdir(dir, { withFileTypes: true })).map(f => f.isDirectory() ? files(join(dir, f.name), `${base}${f.name}/`) : [`${base}${f.name}`]))).flat();
  const root = fileURLToPath(output);
  for (const f of await files(root)) if (/DEEPSEEK_API_KEY|api\.deepseek\.com|sk-[A-Za-z0-9]{16,}/.test(await readFile(join(root, f), 'utf8'))) throw new Error(`Credential/provider reference in static output: ${f}`);
  console.log(`Static build: continuity/static-dist · AI server: ${endpoint === null ? 'none' : endpoint === '' ? 'same origin' : endpoint}`);
  console.log(compilerSource);
  for (const f of (await files(root)).sort()) console.log(`sha256 ${createHash('sha256').update(await readFile(join(root, f))).digest('hex')}  ${f}`);
} finally { await rm(stage, { recursive: true, force: true }); }
