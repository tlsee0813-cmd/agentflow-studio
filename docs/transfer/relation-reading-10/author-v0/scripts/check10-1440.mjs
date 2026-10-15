// cycle10 1440×900 초기 확인만 (조작 없음). 사용: node check10-1440.mjs <html> <outDir> 1440x900
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const [, , htmlPath, outDir, vpArg] = process.argv;
const [VW, VH] = vpArg.split('x').map(Number);
fs.mkdirSync(outDir, { recursive: true });
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const LIB = fs.readFileSync(new URL('./pagelib.js', import.meta.url), 'utf8');
const s0 = fs.readFileSync(htmlPath);
const R = { viewport: [VW, VH], sourceStart: { bytes: s0.length, sha256: sha(s0) }, scenes: { I: { id: 'I', assertions: [], complete: false } }, consoleErrors: [], pngs: [] };
const A = R.scenes.I.assertions, lines = [];
const check = (name, c, data) => { A.push({ name, pass: !!c, data }); const s = `${c ? 'PASS' : 'FAIL'} [I] ${name} ${c ? '' : JSON.stringify(data).slice(0, 400)}`; lines.push(s); console.log(s); };
const server = http.createServer((q, s) => { const b = fs.readFileSync(htmlPath); s.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); s.end(b); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const b = await chromium.launch(); R.browser = b.version();
let crash = null;
try {
  const p = await b.newPage({ viewport: { width: VW, height: VH } });
  p.on('pageerror', e => R.consoleErrors.push(e.message));
  const resp = await p.goto(`http://127.0.0.1:${server.address().port}/relation-reading-study.html`); const body = await resp.body();
  R.scenes.I.received = { bytes: body.length, sha256: sha(body) };
  await p.evaluate(LIB); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(250);
  const r = await p.evaluate(() => __t.raw()); R.scenes.I.raw = { initial: r, overlaps: await p.evaluate(() => __t.overlaps()) };
  check('초기 깊이·무선택', JSON.stringify(r.depth) === '{"G2":0,"G3":1,"G4":0}' && r.sel.length === 0, r.depth);
  check('카드 겹침 없음', R.scenes.I.raw.overlaps.length === 0, R.scenes.I.raw.overlaps);
  check('지도 스크롤 없음', r.map.sw <= r.map.cw && r.map.sh <= r.map.ch, r.map);
  for (const s of ['#n-G1 .gname', '#n-G2 .gname', '#n-G3 .gname', '#n-G4 .gname', '#n-G5 .gname', '#n-C31 .kname', '#n-C32 .kname', '#n-C32 .kchg']) {
    const t = await p.evaluate(x => __t.textVis(x), s); check(`초기 글자 ${s}`, t.pass && t.minFontPx >= 11, { ok: t.ok, chars: t.chars, fails: t.fails });
  }
  R.scenes.I.complete = true;
} catch (e) { crash = String(e && e.stack || e); lines.push('CRASH ' + crash); }
await b.close(); server.close();
const s1 = fs.readFileSync(htmlPath); R.sourceEnd = { bytes: s1.length, sha256: sha(s1) };
R.receivedMatchesSource = !!R.scenes.I.received && R.scenes.I.received.sha256 === R.sourceStart.sha256 && R.sourceStart.sha256 === R.sourceEnd.sha256;
R.assertions = A.length; R.failed = A.filter(a => !a.pass).length; R.clickPreconditions = 0; R.wheels = 0; R.missingScenes = R.scenes.I.complete ? [] : ['I'];
const exit = crash ? 2 : (R.failed || R.consoleErrors.length || !R.receivedMatchesSource || R.missingScenes.length) ? 1 : 0; R.exitCode = exit; R.crash = crash;
fs.writeFileSync(path.join(outDir, 'raw.json'), JSON.stringify(R, null, 1));
fs.writeFileSync(path.join(outDir, 'log.txt'), lines.join('\n') + `\nassertions=${R.assertions} failed=${R.failed} consoleErrors=${R.consoleErrors.length} receivedMatchesSource=${R.receivedMatchesSource} exit=${exit}\n`);
process.exit(exit);
