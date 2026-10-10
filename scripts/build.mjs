import { rm, mkdir, copyFile, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
// Uses the local pinned compiler after npm ci. PATH compiler is an explicit
// offline bootstrap path; its version must match, and is not an npm ci success.
const version = spawnSync('tsc', ['--version'], { encoding: 'utf8', shell: process.platform === 'win32' });
if (version.status !== 0 || version.stdout.trim() !== 'Version 5.8.3') {
  throw new Error('TypeScript 5.8.3 required. Run npm ci in a network-enabled environment.');
}
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
if (pkg.devDependencies.typescript !== '5.8.3') throw new Error('Compiler version mismatch');
await rm('dist', { recursive: true, force: true });
const result = spawnSync('tsc', [], { stdio: 'inherit', shell: process.platform === 'win32' });
if (result.status !== 0) process.exit(result.status ?? 1);
await mkdir('dist/public', { recursive: true });
for (const file of ['index.html', 'styles.css']) await copyFile(`public/${file}`, `dist/public/${file}`);
console.log('Built TypeScript client/shared modules + static assets. Server remains native Node ESM.');
