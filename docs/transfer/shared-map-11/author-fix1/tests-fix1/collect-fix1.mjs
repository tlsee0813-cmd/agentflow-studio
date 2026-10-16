// fix1 회귀 수집자. 같은 회귀 검사를 v0 원본 app과 fix1 app에 각각 PC 1280·1440으로 돌린다(child 4개).
// 사용: node collect-fix1.mjs <runId> <v0AppRoot> <fix1AppRoot> [--png]; echo $? > runs/<runId>/collector-exit.txt
// 수집자 exit 0 = fix1 child가 모두 0 이고, v0 child는 결함 재현(nonzero)으로 끝남.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const here = path.dirname(new URL(import.meta.url).pathname), base = path.resolve(here, '..');
const [runId, v0, f1] = process.argv.slice(2), png = process.argv.includes('--png');
const runDir = path.join(base, 'runs', runId); fs.mkdirSync(runDir, { recursive: true });
const h = f => { const b = fs.readFileSync(f); return { bytes: b.length, sha256: crypto.createHash('sha256').update(b).digest('hex') }; };
const FILES = ['index.html', 'engine.js', 'style.css', 'fixtures/flow091.json', 'fixtures/powertoys.json'];
const snap = () => ({ v0: Object.fromEntries(FILES.map(f => [f, h(path.join(v0, f))])), fix1: Object.fromEntries(FILES.map(f => [f, h(path.join(f1, f))])), test: h(path.join(here, 'regress-preview.mjs')), collector: h(path.join(here, 'collect-fix1.mjs')) });
const sum = { runId, started: new Date().toISOString(), before: snap(), children: [] };
for (const [label, root] of [['v0', v0], ['fix1', f1]]) for (const vp of ['1280x720', '1440x900']) {
  const out = path.join(runDir, `${label}-${vp}`), t0 = Date.now();
  const p = spawnSync(process.execPath, [path.join(here, 'regress-preview.mjs'), root, out, vp, ...(png ? ['--png'] : [])], { encoding: 'utf8', timeout: 300000 });
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'child-stdout.txt'), (p.stdout || '') + (p.stderr ? '\n--- stderr ---\n' + p.stderr : ''));
  let raw = null; try { raw = JSON.parse(fs.readFileSync(path.join(out, 'raw.json'), 'utf8')); } catch { }
  sum.children.push({ app: label, viewport: vp, childExitCode: p.status, ms: Date.now() - t0, assertions: raw && raw.assertions, clickPreconditions: raw && raw.clickPreconditions, failed: raw && raw.failed, failedNames: raw && Object.values(raw.scenarios).flatMap(s => s.assertions.filter(a => !a.pass).map(a => `${s.id}: ${a.name}`)), firstFailure: raw && raw.firstFailure, incomplete: raw && raw.incomplete, consoleErrors: raw && raw.consoleErrors.length, receivedMatchesDisk: raw && raw.receivedMatchesDisk, engineServed: raw && raw.served.find(x => x.path === 'engine.js'), pngs: raw && raw.pngs });
  console.log(label, vp, 'child exit', p.status, raw ? `assertions=${raw.assertions} failed=${raw.failed}` : 'no raw');
}
sum.after = snap(); sum.sourceUnchangedDuringRun = JSON.stringify(sum.before) === JSON.stringify(sum.after);
sum.v0Reproduced = sum.children.filter(c => c.app === 'v0').every(c => c.childExitCode !== 0 && c.failedNames && c.failedNames.length);
sum.fix1AllZero = sum.children.filter(c => c.app === 'fix1').every(c => c.childExitCode === 0);
sum.finished = new Date().toISOString();
fs.writeFileSync(path.join(runDir, 'collector.json'), JSON.stringify(sum, null, 1));
process.exit(sum.v0Reproduced && sum.fix1AllZero && sum.sourceUnchangedDuringRun ? 0 : 1);
