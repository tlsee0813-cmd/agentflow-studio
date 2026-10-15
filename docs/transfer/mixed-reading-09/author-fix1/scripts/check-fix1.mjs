// cycle09 author-fix1 좁은 검사 (child). 사용: node check-fix1.mjs <html> <outDir> <W>x<H>
// 스크롤은 실제 마우스 휠만 쓴다(DOM scrollIntoView/scrollTop 대입 없음). 클릭은 화면 안·대상 위 hit 확인 뒤 실제 마우스 클릭.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';

const [, , htmlPath, outDir, vpArg] = process.argv;
const [VW, VH] = vpArg.split('x').map(Number);
fs.mkdirSync(outDir, { recursive: true });
const LIB = fs.readFileSync(new URL('./pagelib.js', import.meta.url), 'utf8');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const srcBuf = fs.readFileSync(htmlPath);
const logLines = [];
const log = (...a) => { const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); logLines.push(s); console.log(s); };
const R = { viewport: [VW, VH], source: { bytes: srcBuf.length, sha256: sha(srcBuf) }, http: [], consoleErrors: [], scenes: {}, wheels: 0, domScrollCalls: 0, started: new Date().toISOString() };
let cur;
const begin = id => { cur = { id, assertions: [], raw: {}, pngs: [] }; R.scenes[id] = cur; log(`== ${id} @ ${VW}x${VH}`); };
function check(name, cond, data) { const a = { name, pass: !!cond, data }; cur.assertions.push(a); log(`${a.pass ? 'PASS' : 'FAIL'} [${cur.id}] ${name}`, a.pass ? '' : JSON.stringify(data).slice(0, 500)); return a.pass; }
async function shot(page, n) { const f = `${cur.id}-${n}.png`; await page.screenshot({ path: path.join(outDir, f) }); cur.pngs.push(f); }

const server = http.createServer((req, res) => {
  if (req.url.split('?')[0] === '/mixed-reading-study.html') { const b = fs.readFileSync(htmlPath); R.http.push({ bytes: b.length, sha256: sha(b) }); res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); res.end(b); }
  else { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const URLX = `http://127.0.0.1:${server.address().port}/mixed-reading-study.html`;
const browser = await chromium.launch(); R.browser = browser.version();
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('pageerror', e => R.consoleErrors.push(e.message));
page.on('console', m => { if (m.type() === 'error') R.consoleErrors.push(m.text()); });
const resp = await page.goto(URLX); const body = await resp.body();
R.received = { status: resp.status(), bytes: body.length, sha256: sha(body) };
await page.evaluate(LIB); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(250);

const RAW = () => page.evaluate(() => __t.raw());
const PT = sel => page.evaluate(s => __t.pointOf(s), sel);
// 실제 휠: 스크롤 컨테이너(390=main, 1280=panel/focusView/prepScroll) 위 보이는 점에서 굴린다
async function wheelTo(sel, container) {
  for (let i = 0; i < 14; i++) {
    const p = await PT(sel);
    if (!p) return false;
    if (p.inView && p.hitInside && p.y > 40 && p.y < VH - 30) return true;
    const c = await page.evaluate(s => { const e = document.querySelector(s), r = e.getBoundingClientRect(); const t = Math.max(r.top, 0), b = Math.min(r.bottom, innerHeight); return { x: (r.left + r.right) / 2, y: (t + b) / 2 }; }, container);
    const dy = p.y > VH / 2 ? 140 : -140;
    await page.mouse.move(c.x, c.y); await page.mouse.wheel(0, dy); R.wheels++; await page.waitForTimeout(220);
  }
  const p = await PT(sel); return !!p && p.inView && p.hitInside;
}
const scroller = VW < 700 ? '#main' : '#panel';
async function click(sel, label, container) {
  if (container) { const ok = await wheelTo(sel, container); if (!ok) { check(`휠로 화면 안에 가져옴: ${label}`, false, await PT(sel)); return false; } }
  const p = await PT(sel);
  if (!check(`클릭 지점 화면 안·대상 위: ${label}`, p && p.inView && p.hitInside, p)) return false;
  await page.mouse.click(p.x, p.y); await page.waitForTimeout(170); return true;
}
const HEAD = n => `참고 · 읽기 전용 — 지도 선택은 ‹${n}› 그대로 · 참고는 준비문을 바꾸지 않음`;
const SENT = '이번 확인은 배경 블록의 유무와 요청 당시 사본 유지까지만 다룬다.';
const xrefState = () => page.evaluate(() => { const x = document.getElementById('xr-R3'); return x ? { head: x.querySelector('.pkh').innerText, ends: [...x.querySelectorAll('.xends > div:not(.arr)')].map(d => d.innerText), text: x.innerText } : null; });
const prepVals = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#prep textarea')].map(t => [t.dataset.f, t.value])));
const textVis = s => page.evaluate(x => __t.textVis(x), s);

let crash = null;
try {
  // ---- S1: G3 선택 → R3 참고
  begin('S1-G3');
  await click('#n-G3 .gname', 'G3 묶음 이름(지도)');
  let r = await RAW(); cur.raw.selected = r;
  check('G3 선택·깊이 기본', JSON.stringify(r.sel) === '["G3"]' && JSON.stringify(r.depth) === '{"G2":0,"G3":1,"G4":0}', { sel: r.sel, depth: r.depth });
  const g3btn = await page.evaluate(() => { const b = document.querySelector('#panel .xbtn[data-xref="R3"]'); return b && b.innerText; });
  check('G3 설명의 R3 항목 = 받음 ← 새 요청의 배경 고정', /받음 ←\s*새 요청의 배경 고정/.test(g3btn || ''), g3btn);
  await click('#panel .xbtn[data-xref="R3"]', 'G3: R3 참고 열기', scroller);
  r = await RAW(); const x1 = await xrefState(); cur.raw.xref = { raw: r, x: x1 };
  check('새 머리말(선택=전달할 내용)·준비 대상 문구 없음', x1 && x1.head === HEAD('전달할 내용') && !/준비 대상/.test(x1.text), x1 && x1.head);
  check('참고의 실제 끝: 보내는 쪽 새 요청의 배경 고정(접힌 요청 맥락 자리), 받는 쪽 작업문과 미리보기(전달할 내용 안)', x1 && /새 요청의 배경 고정/.test(x1.ends[0]) && /접힌 ‹요청 맥락› 자리/.test(x1.ends[0]) && /작업문과 미리보기/.test(x1.ends[1]) && /‹전달할 내용› 안/.test(x1.ends[1]) && !/지금 선택/.test(x1.ends[1]), x1 && x1.ends);
  check('참고 중 G3 선택·깊이 유지', JSON.stringify(r.sel) === '["G3"]' && JSON.stringify(r.depth) === '{"G2":0,"G3":1,"G4":0}', { sel: r.sel, depth: r.depth });
  const hv = await textVis('#xr-R3 .pkh'); cur.raw.headVis = hv;
  check('머리말 글자 관측(개별 글자)', hv.pass, { chars: hv.chars, ok: hv.ok, fails: hv.fails });
  await shot(page, 'xref-open');
  await click('#xr-R3 [data-act="xref-close"]', 'G3: 참고 닫기 버튼', scroller);
  r = await RAW();
  check('닫기: 참고 제거·초점 R3 항목·G3 선택 유지', !(await xrefState()) && /xbtn\[data-xref=R3\]/.test(r.active) && JSON.stringify(r.sel) === '["G3"]', { active: r.active, sel: r.sel });
  // 실제 준비 경로: G3 집중에는 준비 버튼이 없다
  await click('#panel [data-act="focus"]', 'G3 집중', scroller);
  const g3f = await page.evaluate(() => ({ h2: document.querySelector('.fbody h2')?.textContent, prepBtn: !!document.getElementById('fPrep'), fgo: [...document.querySelectorAll('[data-fgo]')].map(b => b.dataset.fgo) }));
  cur.raw.g3focus = g3f;
  check('G3 집중: 준비 버튼 없음, 세부(C31·C32)만 고르게 함', g3f.h2 === '전달할 내용' && !g3f.prepBtn && JSON.stringify(g3f.fgo) === '["C31","C32"]', g3f);
  await click('#fBack', '전체 지도로');

  // ---- S2: C32 선택 → R3 참고
  begin('S2-C32');
  await click('#n-C32 .kname', 'C32 카드(지도)', scroller);
  await click('#panel .xbtn[data-xref="R3"]', 'C32: R3 참고 열기', scroller);
  r = await RAW(); const x2 = await xrefState(); cur.raw.xref = { raw: r, x: x2 };
  check('새 머리말(선택=작업문과 미리보기)·준비 대상 문구 없음', x2 && x2.head === HEAD('작업문과 미리보기') && !/준비 대상/.test(x2.text), x2 && x2.head);
  check('실제 끝: 받는 쪽 작업문과 미리보기 · 지금 선택', x2 && /작업문과 미리보기/.test(x2.ends[1]) && /지금 선택/.test(x2.ends[1]) && /새 요청의 배경 고정/.test(x2.ends[0]), x2 && x2.ends);
  check('참고 중 C32 선택·깊이 유지', JSON.stringify(r.sel) === '["C32"]' && JSON.stringify(r.depth) === '{"G2":0,"G3":1,"G4":0}', { sel: r.sel, depth: r.depth });
  const hv2 = await textVis('#xr-R3 .pkh');
  check('머리말 글자 관측(개별 글자)', hv2.pass, { chars: hv2.chars, ok: hv2.ok, fails: hv2.fails });
  await shot(page, 'xref-open');
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  r = await RAW();
  check('Escape: 참고 제거·초점 R3 항목·C32 선택 유지', !(await xrefState()) && /xbtn\[data-xref=R3\]/.test(r.active) && JSON.stringify(r.sel) === '["C32"]', { active: r.active, sel: r.sel });

  // ---- S3: C32 준비 실질 문장 → 복귀 → xref 닫기 버튼 / Escape → 문장 보존, G3로 붙지 않음
  begin('S3-prep');
  await click('#panel [data-act="focus"]', 'C32 집중', scroller);
  await click('#fPrep', '준비 열기');
  const def = await prepVals(); cur.raw.defaults = def;
  await click('#pf-target', '대상과 범위 필드');
  await page.keyboard.press('Control+End'); await page.keyboard.press('Enter'); await page.keyboard.type(SENT);
  let v = await prepVals(); cur.raw.edited = v;
  check('문장 덧붙임(대상과 범위)·나머지 기본값', v.target === def.target + '\n' + SENT && v.keep === def.keep && v.evidence === def.evidence && v.unknown === def.unknown, { tail: v.target.slice(-50) });
  await shot(page, 'prep-edited');
  await click('#prepClose', '준비 닫기');
  await click('#fBack', '전체 지도로');
  r = await RAW(); cur.raw.returned = r;
  check('복귀: C32 선택·깊이 유지', JSON.stringify(r.sel) === '["C32"]' && JSON.stringify(r.depth) === '{"G2":0,"G3":1,"G4":0}', { sel: r.sel, depth: r.depth });
  // 새 xref(패널) — 기존 근거 peek(집중 화면)와 별개
  await click('#panel .xbtn[data-xref="R3"]', '복귀 후 R3 참고 열기', scroller);
  const sep = await page.evaluate(() => ({ xrefInPanel: !!document.querySelector('#panel #xr-R3.xpeek'), peekCount: document.querySelectorAll('.peek').length, focusHidden: document.getElementById('focusView').hidden }));
  cur.raw.separation = sep;
  check('xref는 선택 설명 안의 별도 요소, 근거 peek(.peek) 없음', sep.xrefInPanel && sep.peekCount === 0 && sep.focusHidden, sep);
  await shot(page, 'xref-after-prep');
  await click('#xr-R3 [data-act="xref-close"]', '참고 닫기 버튼', scroller);
  check('닫기 버튼으로 제거', !(await xrefState()), null);
  await click('#panel .xbtn[data-xref="R3"]', 'R3 참고 재열기', scroller);
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  check('Escape로 제거', !(await xrefState()), null);
  await shot(page, 'after-xref-closes');
  // 문장 보존 확인
  await click('#panel [data-act="focus"]', 'C32 재진입', scroller);
  await click('#fPrep', '준비 재열기');
  v = await prepVals(); cur.raw.reopened = v;
  check('xref 버튼닫기·Escape 뒤 C32 준비에 문장 그대로', v.target === def.target + '\n' + SENT, { tail: v.target.slice(-50) });
  await shot(page, 'prep-reopened');
  await page.keyboard.press('Escape'); await page.waitForTimeout(120);
  await click('#fBack', '전체 지도로(2)');
  // G3로 붙지 않음: G3 집중에 준비 없음 → 실제 세부 전환 C31 준비는 자기 기본값
  await click('#n-G3 .gname', 'G3 묶음 이름(지도)', scroller);
  await click('#panel .xbtn[data-xref="R3"]', 'G3: R3 참고 열기', scroller);
  await page.keyboard.press('Escape'); await page.waitForTimeout(120);
  await click('#panel [data-act="focus"]', 'G3 집중', scroller);
  const g3p = await page.evaluate(() => ({ prepBtn: !!document.getElementById('fPrep'), bodyHas: document.getElementById('focusView').innerText.includes('이번 확인은 배경 블록의 유무와') }));
  check('G3 집중: 준비 버튼 없음·문장 없음', !g3p.prepBtn && !g3p.bodyHas, g3p);
  await click('#focusView [data-fgo="C31"]', 'G3→세부 AI 입력 전환', '#focusView');
  await click('#fPrep', 'C31 준비');
  const c31 = await prepVals(); const c31t = await page.evaluate(() => document.getElementById('prepTitle').textContent);
  cur.raw.c31 = { title: c31t, v: c31 };
  check('C31 준비: 제목 AI 입력·문장 없음·대상 기본값', c31t === 'AI 입력' && !Object.values(c31).some(x => x.includes(SENT)) && c31.target.startsWith('AI 입력 —'), { title: c31t, target: c31.target.slice(0, 40) });
  await shot(page, 'c31-prep');
  await page.keyboard.press('Escape'); await page.waitForTimeout(120);
  await click('#fBack', '전체 지도로(3)');
  r = await RAW(); cur.raw.final = r;
  check('세부 전환 뒤 복귀: 진입 지도 선택 G3', JSON.stringify(r.sel) === '["G3"]' && r.view === 'map', { sel: r.sel, view: r.view });
  await click('#n-C32 .kname', 'C32 카드(지도)', scroller);
  await click('#panel [data-act="focus"]', 'C32 집중(3)', scroller);
  await click('#fPrep', 'C32 준비(3)');
  v = await prepVals();
  check('G3·C31 다녀온 뒤에도 C32 문장 그대로', v.target === def.target + '\n' + SENT, { tail: v.target.slice(-50) });
  await page.keyboard.press('Escape');
} catch (e) { crash = String(e && e.stack || e); log('CRASH', crash); if (cur) cur.crash = crash; }
await browser.close(); server.close();
R.finished = new Date().toISOString(); R.crash = crash;
R.receivedMatchesSource = R.received.sha256 === R.source.sha256 && R.received.bytes === R.source.bytes;
const all = Object.values(R.scenes).flatMap(s => s.assertions);
R.assertions = all.length; R.failed = all.filter(a => !a.pass).length;
R.clickPreconditions = all.filter(a => a.name.startsWith('클릭 지점')).length;
const exit = crash ? 2 : (R.failed || R.consoleErrors.length || !R.receivedMatchesSource) ? 1 : 0;
R.exitCode = exit;
fs.writeFileSync(path.join(outDir, 'raw.json'), JSON.stringify(R, null, 1));
fs.writeFileSync(path.join(outDir, 'log.txt'), logLines.join('\n') + `\nassertions=${R.assertions} (클릭전제 ${R.clickPreconditions}) failed=${R.failed} wheels=${R.wheels} domScrollCalls=0 consoleErrors=${R.consoleErrors.length} receivedMatchesSource=${R.receivedMatchesSource} exit=${exit}\n`);
process.exit(exit);
