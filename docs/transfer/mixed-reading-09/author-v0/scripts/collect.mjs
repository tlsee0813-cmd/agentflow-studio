// 외부 수집자: 검사 child를 뷰포트별 별도 프로세스로 실행하고 실제 exit code를 남긴다.
// 사용: node collect.mjs <runId>   (수집자 자신의 exit code는 호출한 셸이 runs/<runId>/collector-exit.txt에 기록)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, '..');
const runId = process.argv[2];
const runDir = path.join(root, 'runs', runId);
fs.mkdirSync(runDir, { recursive: true });
const html = path.join(root, 'mixed-reading-study.html');
const src = fs.readFileSync(html);
const sum = { runId, started: new Date().toISOString(), source: { bytes: src.length, sha256: crypto.createHash('sha256').update(src).digest('hex') }, node: process.version, children: [] };
for (const [vp, flows] of [['1280x720', 'A,B,C'], ['390x844', 'A,B,C'], ['1440x900', 'I']]) {
  const out = path.join(runDir, vp);
  const t0 = Date.now();
  const p = spawnSync(process.execPath, [path.join(here, 'check.mjs'), html, out, vp, flows], { encoding: 'utf8', timeout: 240000 });
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'child-stdout.txt'), (p.stdout || '') + (p.stderr ? '\n--- stderr ---\n' + p.stderr : ''));
  let raw = null; try { raw = JSON.parse(fs.readFileSync(path.join(out, 'raw.json'), 'utf8')); } catch { }
  sum.children.push({ viewport: vp, flows, childExitCode: p.status, signal: p.signal, error: p.error ? String(p.error) : null, ms: Date.now() - t0,
    assertions: raw && raw.assertions, failed: raw && raw.failed, consoleErrors: raw && raw.consoleErrors.length, httpMatchesSource: raw && raw.httpMatchesSource,
    perFlow: raw && Object.fromEntries(Object.entries(raw.flows).map(([k, f]) => [k, { count: f.count, failed: f.failed, received: f.received }])) });
  console.log(vp, 'child exit', p.status, raw ? `assertions=${raw.assertions} failed=${raw.failed}` : 'no raw');
}
sum.finished = new Date().toISOString();
sum.allChildrenZero = sum.children.every(c => c.childExitCode === 0);
fs.writeFileSync(path.join(runDir, 'collector.json'), JSON.stringify(sum, null, 1));
process.exit(sum.allChildrenZero ? 0 : 1);
