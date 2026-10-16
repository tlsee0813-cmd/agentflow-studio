// fix1 회귀 검사 child: 초안 미리보기와 복사문 일치. 사용: node regress-preview.mjs <appRoot> <outDir> <W>x<H> [--png]
// 실제 마우스 클릭·키보드 입력만 쓴다(DOM 값 대입 없음). 사례 전환은 Playwright selectOption. DOM 스크롤 0회.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';

const [, , ROOT, OUT, VP, PNGF] = process.argv;
const [W, H] = VP.split('x').map(Number), PNG = PNGF === '--png';
fs.mkdirSync(OUT, { recursive: true });
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const FILES = ['index.html', 'engine.js', 'style.css', 'fixtures/flow091.json', 'fixtures/powertoys.json'];
const hashes = () => Object.fromEntries(FILES.map(f => { const b = fs.readFileSync(path.join(ROOT, f)); return [f, { bytes: b.length, sha256: sha(b) }]; }));
const R = { viewport: [W, H], appRoot: ROOT, before: hashes(), served: [], received: [], consoleErrors: [], scenarios: {}, pngs: [], firstFailure: null, started: new Date().toISOString() };
const lines = []; const log = (...a) => { const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); lines.push(s); console.log(s); };
let cur, page;
const begin = id => { cur = { id, assertions: [], raw: {}, complete: false }; R.scenarios[id] = cur; log('== ' + id); };
async function check(name, c, data) { const a = { name, pass: !!c, data }; cur.assertions.push(a); log(`${c ? 'PASS' : 'FAIL'} [${cur.id}] ${name}`, c ? '' : JSON.stringify(data).slice(0, 500)); if (!c && !R.firstFailure) R.firstFailure = { scenario: cur.id, name, data }; return a.pass; }

const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };
const server = http.createServer((q, s) => {
  const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, ''), p = path.join(ROOT, rel);
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { R.served.push({ path: rel, status: 404 }); s.writeHead(404); s.end(); return; }
  const b = fs.readFileSync(p); R.served.push({ path: rel, status: 200, bytes: b.length, sha256: sha(b) });
  s.writeHead(200, { 'content-type': T[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' }); s.end(b);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/index.html`;
const browser = await chromium.launch(); R.browser = browser.version();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(BASE).origin });
page = await ctx.newPage();
page.on('pageerror', e => R.consoleErrors.push({ type: 'pageerror', text: e.message }));
page.on('console', m => { if (m.type() === 'error') R.consoleErrors.push({ type: 'console', text: m.text() }); });
page.on('response', async r => { try { const b = await r.body(); R.received.push({ path: new URL(r.url()).pathname.slice(1), status: r.status(), bytes: b.length, sha256: sha(b) }); } catch { } });

const PT = s => page.evaluate(x => { const e = document.querySelector(x); if (!e) return null; const r = e.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, h = document.elementFromPoint(cx, cy); return { x: cx, y: cy, ok: r.width > 0 && cx >= 0 && cy >= 0 && cx <= innerWidth && cy <= innerHeight && !!h && (h === e || e.contains(h)) }; }, s);
async function click(sel, label) { const p = await PT(sel); if (!(await check(`클릭 지점 화면 안·대상 위: ${label}`, p && p.ok, p))) throw new Error('blocked ' + label); await page.mouse.click(p.x, p.y); await page.waitForTimeout(150); }
const D = () => page.evaluate(() => { const pv = document.getElementById('draftPreview'); return { value: document.getElementById('draftText').value, previewHidden: pv.hidden, previewVisibleText: pv.hidden ? null : pv.textContent, prevDisabled: document.getElementById('draftPreviewBtn').disabled, copyDisabled: document.getElementById('draftCopyBtn').disabled, status: document.getElementById('draftStatus').textContent, open: !document.getElementById('draft').hidden }; });
const clip = () => page.evaluate(async () => { try { return await navigator.clipboard.readText(); } catch (e) { return 'ERR ' + e.message; } });
async function selectAll() { await page.keyboard.press('Control+A'); }
async function copyNow() { await page.evaluate(() => navigator.clipboard.writeText('__RESET__')); await click('#draftCopyBtn', '복사'); await page.waitForTimeout(150); return clip(); }

const CASES = [{ key: 'flow', idx: 0, chip: 'C32' }, { key: 'pt', idx: 1, chip: 'SR' }];
const E = { flow: ['배경 블록 유무만 확인한다.', ' 그리고 요청 당시 사본 유지까지.', '빈칸 뒤 다시 쓴 요청.', ' 마지막 덧붙임.'], pt: ['검색 즉시 Enter만 다시 본다.', ' 녹화 쪽은 건드리지 않는다.', '빈칸 뒤 다시 쓴 요청.', ' 마지막 덧붙임.'] };
const final = {};
let crash = null;
try {
  await page.goto(BASE); await page.waitForSelector('#app[data-ready="1"]'); await page.waitForTimeout(250);
  for (const c of CASES) {
    begin(`${W}-${c.key}-preview-copy`);
    if (c.idx) { await page.selectOption('#caseSel', String(c.idx)); await page.waitForTimeout(250); }
    await click(`#caseHead .chgchip[data-goto="${c.chip}"]`, '변경 칩');
    await click('#panel [data-act="draft"]', '내 다음 요청 준비');
    await click('#draftText', '입력칸');
    const [e1, e2, e3, e4] = E[c.key];
    // 1) 첫 입력 → 미리보기
    await page.keyboard.type(e1); await click('#draftPreviewBtn', '미리보기');
    let d = await D(); cur.raw.s1 = d;
    await check('1) 미리보기 = 현재 입력(E1)', !d.previewHidden && d.previewVisibleText.endsWith(e1), d);
    // 2) nonempty → nonempty (미리보기 열린 채 편집) — v0 결함 지점
    await click('#draftText', '입력칸'); await page.keyboard.press('Control+End'); await page.keyboard.type(e2);
    d = await D(); cur.raw.s2 = d;
    if (PNG && W === 1280 && c.key === 'pt') { const f = `${W}-${c.key}-after-edit.png`; await page.screenshot({ path: path.join(OUT, f) }); R.pngs.push(f); }
    await check('2) 열린 채 비공백→비공백 편집: 보이는 미리보기가 최신 입력(E1+E2)을 보이거나 닫혀 있음', d.previewHidden || d.previewVisibleText.endsWith((e1 + e2).trim()), d);
    const c2 = await copyNow(); cur.raw.copy2 = c2; d = await D();
    await check('2) 복사문 = 그 순간 보이는 미리보기(보이는 경우)', d.previewHidden || c2 === d.previewVisibleText, { clip: c2, preview: d.previewVisibleText });
    await check('2) 복사문은 최신 입력으로 끝남', c2.endsWith((e1 + e2).trim()), c2);
    // 3) → empty
    await click('#draftText', '입력칸'); await selectAll(); await page.keyboard.press('Backspace');
    d = await D(); cur.raw.s3 = d;
    await check('3) 빈 입력: 미리보기 숨김·미리보기/복사 비활성', d.value === '' && d.previewHidden && d.prevDisabled && d.copyDisabled, d);
    // 4) → whitespace only
    await page.keyboard.type('   ');
    d = await D(); cur.raw.s4 = d;
    await check('4) 공백만: 미리보기 숨김·미리보기/복사 비활성', d.value === '   ' && d.previewHidden && d.prevDisabled && d.copyDisabled, d);
    // 5) 다시 입력 → 복사 → 미리보기
    await selectAll(); await page.keyboard.type(e3);
    d = await D(); cur.raw.s5a = d;
    await check('5) 다시 입력: 버튼 활성, 미리보기는 사용자가 다시 열 때까지 숨김', !d.prevDisabled && !d.copyDisabled && d.previewHidden, d);
    const c5 = await copyNow(); cur.raw.copy5 = c5;
    await check('5) 다시 입력 뒤 복사문은 E3로 끝남', c5.endsWith(e3), c5);
    await click('#draftPreviewBtn', '미리보기(다시)'); d = await D(); cur.raw.s5b = d;
    await check('5) 다시 연 미리보기 = 방금 복사문', !d.previewHidden && d.previewVisibleText === c5, { clip: c5, preview: d.previewVisibleText });
    // 6) 미리보기 열린 채 한 번 더 편집 → 복사
    await click('#draftText', '입력칸'); await page.keyboard.press('Control+End'); await page.keyboard.type(e4);
    d = await D(); const c6 = await copyNow(); const d6 = await D(); cur.raw.s6 = { d, c6, d6 };
    await check('6) 열린 미리보기와 복사문 일치(E3+E4)', d6.previewHidden || (d6.previewVisibleText === c6 && c6.endsWith((e3 + e4).trim())), { clip: c6, preview: d6.previewVisibleText });
    final[c.key] = d6.value;
    await click('#draftClose', '초안 닫기');
    cur.complete = true;
  }
  // 7) 필요한 범위의 회귀: 사례 전환 뒤 초안 보존·미리보기 닫힌 상태로 재열림
  begin(`${W}-switch-preserve`);
  for (const c of [CASES[0], CASES[1]]) {
    await page.selectOption('#caseSel', String(c.idx)); await page.waitForTimeout(250);
    await click(`#caseHead .chgchip[data-goto="${c.chip}"]`, `변경 칩 ${c.key}`);
    await click('#panel [data-act="draft"]', `초안 재열기 ${c.key}`);
    const d = await D();
    await check(`7) ${c.key}: 전환 왕복 뒤 초안 보존·다른 사례와 섞이지 않음·미리보기 닫힌 채 재열림`, d.value === final[c.key] && d.previewHidden && !d.copyDisabled, d);
    await click('#draftClose', '닫기');
  }
  cur.complete = true;
} catch (e) { crash = String(e && e.stack || e); log('CRASH ' + crash); if (cur) cur.crash = crash; }
await ctx.close(); await browser.close(); server.close();
R.after = hashes(); R.sourceUnchanged = JSON.stringify(R.before) === JSON.stringify(R.after);
R.receivedMatchesDisk = FILES.every(f => { const g = R.received.find(x => x.path === f); return g && g.status === 200 && g.sha256 === R.before[f].sha256; });
const all = Object.values(R.scenarios).flatMap(s => s.assertions);
R.assertions = all.length; R.failed = all.filter(a => !a.pass).length; R.clickPreconditions = all.filter(a => a.name.startsWith('클릭 지점')).length;
R.incomplete = Object.values(R.scenarios).filter(s => !s.complete).map(s => s.id); R.crash = crash; R.finished = new Date().toISOString();
const exit = crash ? 2 : (R.failed || R.consoleErrors.length || R.incomplete.length || !R.sourceUnchanged || !R.receivedMatchesDisk) ? 1 : 0;
R.exitCode = exit;
fs.writeFileSync(path.join(OUT, 'raw.json'), JSON.stringify(R, null, 1));
fs.writeFileSync(path.join(OUT, 'log.txt'), lines.join('\n') + `\nassertions=${R.assertions} (클릭 전제 ${R.clickPreconditions}) failed=${R.failed} incomplete=${JSON.stringify(R.incomplete)} consoleErrors=${R.consoleErrors.length} receivedMatchesDisk=${R.receivedMatchesDisk} sourceUnchanged=${R.sourceUnchanged} domScroll=0 exit=${exit}\n`);
process.exit(exit);
