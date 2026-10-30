// The default local entry (server/index.mjs) as a real process: a start that cannot go ahead says why in one line (no stack, no
// value), a setting that is set aside is named, and a stop signal closes the job store so the next start can own it at once.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ENTRY = fileURLToPath(new URL('../server/index.mjs', import.meta.url));
const clean = { PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT, AI_MODE: 'mock', STUDIO_SESSIONS: 'off' };
function run(args, env, { until } = {}) {
  const child = spawn(process.execPath, [ENTRY, ...args], { env: { ...clean, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = '';
  child.stdout.on('data', c => { out += c; }); child.stderr.on('data', c => { err += c; });
  const exited = new Promise(r => child.once('exit', code => r(code)));
  const ready = until ? new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error(`not ready: ${out} ${err}`)), 15000);
    child.stdout.on('data', () => { if (until.test(out)) { clearTimeout(t); res(); } });
  }) : null;
  return { child, exited, ready, text: () => ({ out, err }) };
}
const freePort = () => new Promise(r => { const s = createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });

test('ENTRY-1 an unknown argument and an invalid PORT stop with one line and exit 1', async () => {
  for (const [args, env, pattern] of [[['--key=x'], {}, /only --mock is supported/], [[], { PORT: '99999' }, /INVALID_SERVER_CONFIG/]]) {
    const r = run(args, env); assert.equal(await r.exited, 1);
    const { err } = r.text();
    assert.match(err, /^AgentFlow Studio did not start: /); assert.match(err, pattern); assert.doesNotMatch(err, /\n\s+at /, 'no stack');
  }
});

test('ENTRY-2 a port in use is named instead of a crash', async () => {
  const blocker = createServer().listen(0, '127.0.0.1'); await new Promise(r => blocker.once('listening', r));
  try {
    const r = run([], { PORT: String(blocker.address().port), STUDIO_JOBS: 'off' });
    assert.equal(await r.exited, 1); assert.match(r.text().err, /port \d+ is already in use/);
  } finally { blocker.close(); }
});

test('ENTRY-3 a set-aside setting is named (never its value); a stop signal releases the job store for the next start', { skip: process.platform === 'win32' && 'Windows has no catchable SIGTERM for a child' }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'af-entry-')), port = await freePort();
  const env = { PORT: String(port), STUDIO_JOBS_DIR: dir, STUDIO_TIMEOUT_MS: 'soon', STUDIO_ACCESS_CODE: 'secret-code-1' };
  const first = run([], env, { until: /map jobs kept on this PC/ }); await first.ready;
  const { out, err } = first.text();
  assert.match(err, /STUDIO_TIMEOUT_MS is not a usable value/); assert.doesNotMatch(out + err, /soon|secret-code-1/);
  first.child.kill('SIGTERM'); assert.equal(await first.exited, 0);
  const second = run([], env, { until: /map jobs (kept on this PC|not available)/ }); await second.ready;
  assert.match(second.text().out, /map jobs kept on this PC/, 'the store is not left busy');
  second.child.kill('SIGTERM'); assert.equal(await second.exited, 0);
});
