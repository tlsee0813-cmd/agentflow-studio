// 외부 수집자. 사용: node tests/collect11.mjs <runId> [--png]; echo $? > runs/<runId>/collector-exit.txt
// 임시 입력 생성 → 검사 child 5개(각각 별도 프로세스) → 실제 exit code·첫 실패·실행 전후 소스/검사 코드 해시 기록.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const here = path.dirname(new URL(import.meta.url).pathname), root = path.resolve(here, '..'), outRoot = path.resolve(root, '..', 'runs');
const runId = process.argv[2], png = process.argv.includes('--png');
const runDir = path.join(outRoot, runId); fs.mkdirSync(runDir, { recursive: true });
const h = f => { const b = fs.readFileSync(f); return { bytes: b.length, sha256: crypto.createHash('sha256').update(b).digest('hex') }; };
const files = ['index.html', 'engine.js', 'style.css', 'fixtures/flow091.json', 'fixtures/powertoys.json', 'tests/check11.mjs', 'tests/pagelib.js', 'tests/collect11.mjs', 'tests/make-temp-inputs.mjs'];
const snap = () => Object.fromEntries(files.map(f => [f, h(path.join(root, f))]));
const sum = { runId, png, started: new Date().toISOString(), node: process.version, before: snap(), children: [] };
const t = spawnSync(process.execPath, [path.join(here, 'make-temp-inputs.mjs'), root], { encoding: 'utf8' });
sum.tempInputs = { exit: t.status, out: (t.stdout || '') + (t.stderr || ''), files: fs.existsSync(path.join(root, 'tests/fixtures-tmp')) ? Object.fromEntries(fs.readdirSync(path.join(root, 'tests/fixtures-tmp')).map(f => [f, h(path.join(root, 'tests/fixtures-tmp', f))])) : null };
for (const mode of ['static', 'pc-1280', 'pc-1440', 'temp-inputs', 'smoke-390']) {
  const out = path.join(runDir, mode), t0 = Date.now();
  const p = spawnSync(process.execPath, [path.join(here, 'check11.mjs'), root, out, mode, ...(png ? ['--png'] : [])], { encoding: 'utf8', timeout: 400000 });
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'child-stdout.txt'), (p.stdout || '') + (p.stderr ? '\n--- stderr ---\n' + p.stderr : ''));
  let raw = null; try { raw = JSON.parse(fs.readFileSync(path.join(out, 'raw.json'), 'utf8')); } catch { }
  sum.children.push({ mode, childExitCode: p.status, signal: p.signal, ms: Date.now() - t0, scenarios: raw && Object.keys(raw.scenarios), incomplete: raw && raw.incompleteScenarios, assertions: raw && raw.assertions, clickWheelPreconditions: raw && raw.clickPreconditions, failed: raw && raw.failed, firstFailure: raw && raw.firstFailure, consoleErrors: raw && raw.consoleErrors, wheels: raw && raw.wheels, selectOption: raw && raw.selectOptionCalls, pngs: raw && raw.pngs });
  console.log(mode, 'child exit', p.status, raw ? `assertions=${raw.assertions} failed=${raw.failed} incomplete=${JSON.stringify(raw.incompleteScenarios)}` : 'no raw');
}
sum.after = snap(); sum.finished = new Date().toISOString();
sum.sourceUnchangedDuringRun = JSON.stringify(sum.before) === JSON.stringify(sum.after);
sum.firstFailingChild = (sum.children.find(c => c.childExitCode !== 0) || {}).mode || null;
sum.allChildrenZero = sum.children.every(c => c.childExitCode === 0) && sum.tempInputs.exit === 0;
fs.writeFileSync(path.join(runDir, 'collector.json'), JSON.stringify(sum, null, 1));
process.exit(sum.allChildrenZero && sum.sourceUnchangedDuringRun ? 0 : 1);
