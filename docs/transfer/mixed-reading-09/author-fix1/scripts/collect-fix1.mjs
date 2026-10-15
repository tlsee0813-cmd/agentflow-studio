// 외부 수집자(fix1): 뷰포트별 child를 별도 프로세스로 실행하고 실제 exit code를 남긴다.
// 사용: node collect-fix1.mjs <runId>; echo $? > runs/<runId>/collector-exit.txt
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const here = path.dirname(new URL(import.meta.url).pathname), root = path.resolve(here, '..');
const runId = process.argv[2], runDir = path.join(root, 'runs', runId);
fs.mkdirSync(runDir, { recursive: true });
const html = path.join(root, 'mixed-reading-study.html'), src = fs.readFileSync(html);
const sum = { runId, started: new Date().toISOString(), source: { bytes: src.length, sha256: crypto.createHash('sha256').update(src).digest('hex') }, children: [] };
for (const vp of ['1280x720', '390x844']) {
  const out = path.join(runDir, vp), t0 = Date.now();
  const p = spawnSync(process.execPath, [path.join(here, 'check-fix1.mjs'), html, out, vp], { encoding: 'utf8', timeout: 240000 });
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'child-stdout.txt'), (p.stdout || '') + (p.stderr ? '\n--- stderr ---\n' + p.stderr : ''));
  let raw = null; try { raw = JSON.parse(fs.readFileSync(path.join(out, 'raw.json'), 'utf8')); } catch { }
  sum.children.push({ viewport: vp, childExitCode: p.status, signal: p.signal, ms: Date.now() - t0, assertions: raw && raw.assertions, clickPreconditions: raw && raw.clickPreconditions, failed: raw && raw.failed, wheels: raw && raw.wheels, consoleErrors: raw && raw.consoleErrors.length, receivedMatchesSource: raw && raw.receivedMatchesSource, received: raw && raw.received });
  console.log(vp, 'child exit', p.status, raw ? `assertions=${raw.assertions} failed=${raw.failed}` : 'no raw');
}
sum.finished = new Date().toISOString(); sum.allChildrenZero = sum.children.every(c => c.childExitCode === 0);
fs.writeFileSync(path.join(runDir, 'collector.json'), JSON.stringify(sum, null, 1));
process.exit(sum.allChildrenZero ? 0 : 1);
