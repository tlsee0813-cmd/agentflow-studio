import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
async function files(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    out.push(...(e.isDirectory() ? await files(p) : [p]));
  }
  return out;
}
for (const file of [...await files('server'), ...await files('scripts'), ...await files('tests')].filter(p => p.endsWith('.mjs'))) {
  if (spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' }).status !== 0) process.exit(1);
}
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
if (pkg.devDependencies.typescript !== lock.packages['node_modules/typescript'].version) throw new Error('Lock mismatch');
// Static boundary check: no server secret name / external fetch endpoint in client sources.
for (const file of [...await files('src'), ...await files('public')]) {
  if (/DEEPSEEK_API_KEY|api\.deepseek\.com|process\.env|sk-[A-Za-z0-9]{16}/.test(await readFile(file, 'utf8'))) {
    throw new Error(`Unexpected credential/provider boundary reference: ${file}`);
  }
}
console.log('Syntax, lock alignment and client credential boundary checks passed. Not a full security audit.');
