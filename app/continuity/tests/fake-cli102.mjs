// AF102 test-only stand-in for the installed CLI: a harmless local Node child. No network, no model, no key. It reads the wrapper
// from stdin, answers with a clearly synthetic map.6 FIRST wire built from the request (the 100 smoke stub's rule), and prints
// codex-style JSONL events. The test chooses its behaviour per invocation with <ctl>/mode (one line per invocation, or one for
// all) and counts invocations in <ctl>/invocations; <ctl>/pid-<n> holds each child's pid.
import { appendFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
const argv = process.argv.slice(2);
const arg = n => argv[argv.indexOf(n) + 1];
if (argv.includes('--version')) {
  // <ctl>/version-mode: ok (default) or grandchild (prints the version, leaves a process holding stdout, exits 0).
  const c = arg('--ctl'), vm = c && existsSync(`${c}/version-mode`) ? readFileSync(`${c}/version-mode`, 'utf8').trim() : 'ok';
  if (c) appendFileSync(`${c}/versions`, `${process.pid}\n`);
  process.stdout.write('fake-cli 102-test\n');
  if (vm === 'grandchild') { const g = spawn(process.execPath, ['-e', "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"], { stdio: ['ignore', 'inherit', 'ignore'] }); writeFileSync(`${c}/version-grandchild-pid`, String(g.pid)); g.unref(); }
  process.stdout.write('', () => process.exit(0));
} else main();
function main() {
const ctl = arg('--ctl'), final = arg('--final'), cwd = arg('--cwd');
const n = existsSync(`${ctl}/invocations`) ? readFileSync(`${ctl}/invocations`, 'utf8').split('\n').filter(Boolean).length + 1 : 1;
const modes = existsSync(`${ctl}/mode`) ? readFileSync(`${ctl}/mode`, 'utf8').split('\n').filter(Boolean) : ['ok'];
const mode = modes[Math.min(n, modes.length) - 1] ?? 'ok';
appendFileSync(`${ctl}/invocations`, `${JSON.stringify({ n, mode, model: arg('--model'), reasoning: arg('--reasoning'), cwdEmpty: readdirSync(cwd).length === 0, sameCwd: process.cwd() === cwd,
  keyInEnv: Object.keys(process.env).some(k => /^(DEEPSEEK_|STUDIO_)/.test(k)), pid: process.pid })}\n`);
writeFileSync(`${ctl}/pid-${n}`, String(process.pid));
process.stdout.on('error', () => {}); process.stderr.on('error', () => {});
// Bounded cleanup without any pid: a test writes <ctl>/stop-all; a waiting child ends itself and says so in <ctl>/exited-<n>.
// <ctl>/ready-<n> says the watch is set; <ctl>/beat-<n> is rewritten with the time every 50 ms while this child runs.
const stopWatch = () => {
  writeFileSync(`${ctl}/ready-${n}`, '');
  return setInterval(() => { if (existsSync(`${ctl}/stop-all`)) { writeFileSync(`${ctl}/exited-${n}`, ''); process.exit(0); } writeFileSync(`${ctl}/beat-${n}`, String(Date.now())); }, 50);
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = s => new Promise(r => process.stdout.write(s, r));
const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', async () => {
  // The wrapper ends with this line and the input JSON (no newline after it).
  const text = Buffer.concat(chunks).toString('utf8'), mark = '\nINPUT JSON (자료):\n', at = text.lastIndexOf(mark);
  writeFileSync(`${ctl}/stdin-${n}.sha`, (await import('node:crypto')).createHash('sha256').update(text).digest('hex'));
  const ask = JSON.parse(text.slice(at + mark.length).trim());
  const reply = JSON.stringify(stub(ask)), ev = o => `${JSON.stringify(o)}\n`;
  const head = ev({ type: 'thread.started', thread_id: `fake-${n}` }) + ev({ type: 'turn.started' }) + ev({ type: 'item.completed', item: { id: 'i0', type: 'reasoning', text: '[가짜] 생각' } });
  const tail = (t = reply) => ev({ type: 'item.completed', item: { id: 'i1', type: 'agent_message', text: t } }) + ev({ type: 'turn.completed', usage: { input_tokens: 0, output_tokens: 0 } });
  const done = async (t = reply, f = t) => { writeFileSync(final, f); await out(head + tail(t)); };
  const [kind, value] = mode.split(':');
  if (kind === 'ok') { await done(); process.exit(0); }
  // file: answers with <ctl>/reply-<n>.json as written by the test (a later map.6 wire built for that very ask), byte for byte.
  if (kind === 'file') { await done(readFileSync(`${ctl}/reply-${n}.json`, 'utf8')); process.exit(0); }
  if (kind === 'delay') { await out(head); await sleep(Number(value)); writeFileSync(final, reply); await out(tail()); process.exit(0); }
  if (kind === 'split') {
    // The JSONL bytes in pieces that cut multi-byte characters (and lines) apart.
    writeFileSync(final, reply); const all = Buffer.from(head + tail());
    for (let i = 0; i < all.length; i += 7) { await new Promise(r => process.stdout.write(all.subarray(i, i + 7), r)); if (i % 70 === 0) await sleep(1); }
    process.exit(0);
  }
  if (kind === 'invalid-utf8') { writeFileSync(final, reply); await new Promise(r => process.stdout.write(Buffer.concat([Buffer.from(head), Buffer.from([0x7b, 0xff, 0xfe, 0x7d, 0x0a])]), r)); process.exit(0); }
  if (kind === 'tool') { await out(head + ev({ type: 'item.completed', item: { id: 'i2', type: 'command_execution', command: 'ls' } })); await done(); process.exit(0); }
  if (kind === 'error-event') { await out(head + ev({ type: 'error', message: 'x' })); process.exit(0); }
  if (kind === 'unknown-event') { await out(head + ev({ type: 'thread.forked' })); await done(); process.exit(0); }
  if (kind === 'exit1') { await done(); process.exit(1); }
  if (kind === 'crash') { await out(head); process.kill(process.pid, 'SIGKILL'); await sleep(5000); }
  if (kind === 'mismatch') { await done(reply, `${reply} `); process.exit(0); }
  if (kind === 'no-final') { await out(head + tail()); process.exit(0); }
  if (kind === 'no-turn') { writeFileSync(final, reply); await out(head + ev({ type: 'item.completed', item: { id: 'i1', type: 'agent_message', text: reply } })); process.exit(0); }
  if (kind === 'bad-json') { await done('{"summary": 지도'); process.exit(0); }
  if (kind === 'bad-wire') { const w = JSON.parse(reply); w.parts[0].basis = ['N99.0']; await done(JSON.stringify(w)); process.exit(0); }
  if (kind === 'late') {
    // Asked to stop, it still finishes a complete answer a moment later and exits 0 (a reply that comes after the cancel).
    process.on('SIGTERM', async () => { await sleep(150); await done(); process.exit(0); }); await out(head); stopWatch();
  }
  if (kind === 'hang') { process.on('SIGTERM', () => {}); await out(head); stopWatch(); }
  if (kind === 'grandchild') {
    // Leaves a process in its group that holds stdout open and ignores SIGTERM; the CLI itself ends normally.
    const g = spawn(process.execPath, ['-e', "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"], { stdio: ['ignore', 'inherit', 'ignore'] }); writeFileSync(`${ctl}/grandchild-pid`, String(g.pid)); g.unref();
    await done(); process.exit(0);
  }
});
}
/** The 100 smoke stub's first-map rule: the 요구/작업 보고/구상 lines become parts, each claim keyed; labelled synthetic. */
function stub(input) {
  const rec = input.records[0], pieces = rec.spans.filter(x => /^(요구|작업 보고|구상):/.test(x.t.trim()));
  const kind = t => t.startsWith('요구') ? 'want' : t.startsWith('구상') ? 'idea' : 'reported';
  let keys = 0;
  const claim = x => ({ kind: kind(x.t.trim()), text: `[가짜 CLI] ${x.t.trim().slice(0, 40)}`, at: x.s, about: null, replaces: null, key: `s${++keys}` });
  return { summary: '[가짜 CLI] 기록의 줄을 부분으로 놓은 자리예요.', relations: [], candidates: [], gaps: [], matches: [], material: [],
    parts: pieces.slice(0, 3).map((x, i) => ({ ref: `new:p${i}`, name: `가짜 부분 ${i + 1}`, parent: null, role: `[가짜 CLI] ${i + 1}번째 줄에 근거한 자리`, roleAbout: null, roleReplaces: null, basis: [x.s], claims: [claim(x)] })) };
}
