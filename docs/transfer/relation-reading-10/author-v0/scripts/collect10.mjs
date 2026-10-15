// cycle10 외부 수집자. 뷰포트별 child 실행·실제 exit code·소스/검사코드 해시(실행 전후)를 남긴다.
// 사용: node collect10.mjs <runId>; echo $? > runs/<runId>/collector-exit.txt
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const here = path.dirname(new URL(import.meta.url).pathname), root = path.resolve(here, '..');
const runId = process.argv[2], runDir = path.join(root, 'runs', runId);
fs.mkdirSync(runDir, { recursive: true });
const h = f => { const b = fs.readFileSync(f); return { bytes: b.length, sha256: crypto.createHash('sha256').update(b).digest('hex') }; };
const html = path.join(root, 'relation-reading-study.html');
const snap = () => ({ html: h(html), check: h(path.join(here, 'check10.mjs')), pagelib: h(path.join(here, 'pagelib.js')), collector: h(path.join(here, 'collect10.mjs')), check1440: h(path.join(here, 'check10-1440.mjs')) });
const sum = { runId, started: new Date().toISOString(), before: snap(), children: [] };
for (const vp of ['1280x720', '390x844', '1440x900']) {
  const out = path.join(runDir, vp), t0 = Date.now();
  const script = vp === '1440x900' ? 'check10-1440.mjs' : 'check10.mjs';
  const p = spawnSync(process.execPath, [path.join(here, script), html, out, vp], { encoding: 'utf8', timeout: 300000 });
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'child-stdout.txt'), (p.stdout || '') + (p.stderr ? '\n--- stderr ---\n' + p.stderr : ''));
  let raw = null; try { raw = JSON.parse(fs.readFileSync(path.join(out, 'raw.json'), 'utf8')); } catch { }
  sum.children.push({ viewport: vp, script, childExitCode: p.status, signal: p.signal, ms: Date.now() - t0, assertions: raw && raw.assertions, clickWheelPreconditions: raw && raw.clickPreconditions, failed: raw && raw.failed, wheels: raw && raw.wheels, missingScenes: raw && raw.missingScenes, consoleErrors: raw && raw.consoleErrors.length, receivedMatchesSource: raw && raw.receivedMatchesSource, pngs: raw && raw.pngs });
  console.log(vp, 'child exit', p.status, raw ? `assertions=${raw.assertions} failed=${raw.failed} missing=${JSON.stringify(raw.missingScenes)}` : 'no raw');
}
sum.after = snap(); sum.finished = new Date().toISOString();
sum.sourceUnchangedDuringRun = JSON.stringify(sum.before) === JSON.stringify(sum.after);
sum.allChildrenZero = sum.children.every(c => c.childExitCode === 0);
fs.writeFileSync(path.join(runDir, 'collector.json'), JSON.stringify(sum, null, 1));
process.exit(sum.allChildrenZero && sum.sourceUnchangedDuringRun ? 0 : 1);
