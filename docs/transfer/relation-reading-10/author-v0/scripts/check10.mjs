// cycle10 작성자 검사 child. 사용: node check10.mjs <html> <outDir> <W>x<H>
// 화면 이동은 실제 마우스 휠만 쓴다(DOM scrollIntoView/scrollTop 대입 0회). 클릭은 화면 안·대상 위 hit 확인 뒤 실제 마우스 클릭.
// PNG: 대표 장면(지정 4장)과 각 장면의 첫 실패 장면만 남긴다.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';

const [, , htmlPath, outDir, vpArg] = process.argv;
const [VW, VH] = vpArg.split('x').map(Number);
const NARROW = VW < 700;
fs.mkdirSync(outDir, { recursive: true });
const LIB = fs.readFileSync(new URL('./pagelib.js', import.meta.url), 'utf8');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const logLines = [];
const log = (...a) => { const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); logLines.push(s); console.log(s); };
const srcStart = fs.readFileSync(htmlPath);
const R = { viewport: [VW, VH], sourceStart: { bytes: srcStart.length, sha256: sha(srcStart) }, http: [], consoleErrors: [], scenes: {}, wheels: 0, domScrollCalls: 0, pngs: [], started: new Date().toISOString() };
const REQUIRED = ['S0-initial', 'S1-G3', 'S2-C21', 'S3-kinds', 'S4-C32-prep'];
let cur;
function begin(id) { cur = { id, assertions: [], raw: {}, complete: false, failShot: null }; R.scenes[id] = cur; log(`== ${id} @ ${VW}x${VH}`); }
let page;
async function failShot() { if (cur.failShot || !page) return; const f = `FAIL-${cur.id}.png`; try { await page.screenshot({ path: path.join(outDir, f) }); cur.failShot = f; R.pngs.push(f); } catch { } }
async function check(name, cond, data) {
  const a = { name, pass: !!cond, data }; cur.assertions.push(a);
  log(`${a.pass ? 'PASS' : 'FAIL'} [${cur.id}] ${name}`, a.pass ? '' : JSON.stringify(data).slice(0, 600));
  if (!a.pass) await failShot();
  return a.pass;
}
async function shot(name) { const f = `${name}.png`; await page.screenshot({ path: path.join(outDir, f) }); R.pngs.push(f); log(`  PNG ${f}`); }

const server = http.createServer((req, res) => {
  if (req.url.split('?')[0] === '/relation-reading-study.html') { const b = fs.readFileSync(htmlPath); R.http.push({ bytes: b.length, sha256: sha(b) }); res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); res.end(b); }
  else { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const URLX = `http://127.0.0.1:${server.address().port}/relation-reading-study.html`;
const browser = await chromium.launch(); R.browser = browser.version();
let ctx;
async function fresh() {
  if (ctx) await ctx.close();
  ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
  page = await ctx.newPage();
  page.on('pageerror', e => R.consoleErrors.push({ scene: cur && cur.id, t: e.message }));
  page.on('console', m => { if (m.type() === 'error') R.consoleErrors.push({ scene: cur && cur.id, t: m.text() }); });
  const resp = await page.goto(URLX); const body = await resp.body();
  cur.received = { status: resp.status(), bytes: body.length, sha256: sha(body) };
  await page.evaluate(LIB); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(250);
}
const RAW = () => page.evaluate(() => __t.raw());
const PT = sel => page.evaluate(s => __t.pointOf(s), sel);
const TV = sel => page.evaluate(s => __t.textVis(s), sel);
// 실제 휠. 390은 main(지도 아래쪽 점), 1280은 선택 설명 패널 위에서 굴린다.
async function wheelTo(sel) {
  for (let i = 0; i < 16; i++) {
    const p = await PT(sel); if (!p) return false;
    const r = await page.evaluate(s => __t.rectOf(s), sel);
    const fits = r && r.y >= 4 && r.y + r.h <= VH - 4;
    if (p.inView && p.hitInside && (fits || (r.h > VH - 8 && p.y > 40 && p.y < VH - 30))) return true;
    const at = NARROW ? { x: VW / 2, y: VH - 40 } : await page.evaluate(() => { const r = document.getElementById('panel').getBoundingClientRect(); return { x: (r.left + r.right) / 2, y: (Math.max(r.top, 0) + Math.min(r.bottom, innerHeight)) / 2 }; });
    const target = r ? r.y + r.h / 2 : p.y;
    const dy = Math.max(-260, Math.min(260, Math.round(target - VH / 2)));
    await page.mouse.move(at.x, at.y); await page.mouse.wheel(0, dy === 0 ? 40 : dy); R.wheels++; await page.waitForTimeout(220);
  }
  const p = await PT(sel); return !!p && p.inView && p.hitInside;
}
async function wheelMap(dx, dy) { const p = await PT('#mapScroll'); await page.mouse.move(p.x, Math.min(p.y, VH - 60)); await page.mouse.wheel(dx, dy); R.wheels++; await page.waitForTimeout(300); }
async function click(sel, label, scroll = true) {
  if (scroll && !(await wheelTo(sel))) { await check(`휠로 화면 안에 가져옴: ${label}`, false, await PT(sel)); return false; }
  const p = await PT(sel);
  if (!(await check(`클릭 지점 화면 안·대상 위: ${label}`, p && p.inView && p.hitInside, p))) return false;
  await page.mouse.click(p.x, p.y); await page.waitForTimeout(170); return true;
}
async function seen(sel, label, minFont = 11) {
  await wheelTo(sel);
  const t = await TV(sel);
  await check(`글자 관측(개별 글자·clip·hit) ${label}`, t.pass && t.minFontPx >= minFont, { chars: t.chars, ok: t.ok, minFontPx: t.minFontPx, fails: t.fails, text: (t.text || '').slice(0, 120) });
  return t;
}
const ns = t => (t || '').replace(/\s+/g, '');
const nums = d => (d.match(/-?\d+(\.\d+)?(e-?\d+)?/g) || []).map(Number);
const pathDiff = (a, b) => { const x = nums(a), y = nums(b); if (x.length !== y.length) return Infinity; return Math.max(0, ...x.map((v, i) => Math.abs(v - y[i]))); };
const boxDiff = (A, B) => { const out = []; for (const k of Object.keys(A)) { const a = A[k], b = B[k]; if (!a || !b) { if (a !== b) out.push({ id: k, a, b }); continue; } const m = Math.max(...['x', 'y', 'w', 'h'].map(q => Math.abs(a[q] - b[q]))); if (m > .6) out.push({ id: k, a, b, m }); } return out; };
const xref = id => page.evaluate(i => { const x = document.getElementById('xr-' + i); if (!x) return null; const q = s => (x.querySelector(s) || {}).innerText || null; return { flow: q('.xflow'), kind: q('.xkind'), where: [...x.querySelectorAll('.xwh li')].map(l => l.innerText), cond: q('.xcond'), meta: q('.xmeta'), mv: q('[data-mv]'), rect: __t.rectOf('#xr-' + i) }; }, id);
const listInfo = () => page.evaluate(() => {
  const L = document.querySelector('#panel .list:last-of-type') && [...document.querySelectorAll('#panel .xbtn')];
  return [...document.querySelectorAll('#panel .xbtn')].map(b => {
    let h = b.previousElementSibling; while (h && !h.classList.contains('xgrp')) h = h.previousElementSibling;
    const dsc = b.getAttribute('aria-describedby');
    return { id: b.dataset.xref, text: b.innerText.replace(/\s+/g, ' ').trim(), group: h ? h.querySelector('b').textContent : null, describedBy: dsc ? (document.getElementById(dsc) || {}).innerText || 'MISSING' : null, expanded: b.getAttribute('aria-expanded') };
  });
});
const KIND = { R1: '명시 새 요청 때만 사본 고정', R2: '요청 사본', R3: '요청 사본', R4: '내보내기 기록의 사본', R5: '일치하는 반환 식별자', R6: '정확히 연결된 대상 작업의 사본' };
const FLOW = { R1: ['구상과 목적', '새 요청의 배경 고정'], R2: ['새 요청의 배경 고정', 'AI 입력'], R3: ['새 요청의 배경 고정', '작업문과 미리보기'], R4: ['작업문과 미리보기', '저장·복구'], R5: ['저장·복구', '파일 반환 연결'], R6: ['새 요청의 배경 고정', '일반 보고 연결'] };
const COND = {
  R1: '명시적인 새 요청을 보낼 때만 그때의 목적과 그 요청의 대상 영역 하나를 사본으로 고정합니다. 지도에서 고르거나 둘러보는 것은 새 요청이 아닙니다.',
  R2: '명시 새 요청 때 고정한 그 요청의 배경 사본을 AI 입력의 전용 필드로 싣습니다. 출처·기준과 분리되고 실행 범위는 이번 요청이 정합니다.',
  R3: '명시 새 요청 때 고정한 그 요청의 배경 사본을 작업문·미리보기의 별도 블록으로 넣습니다. 지금 지도에 보이는 최신 구상을 가져오는 것이 아닙니다. 사본이 없거나 비면 블록을 넣지 않습니다.',
  R4: '작업문에 실제로 넣은 사본을 내보내기 기록에 남깁니다. 작업문 전문 저장이나 외부에서 받거나 수락했다는 증거가 아닙니다.',
  R5: '반환 식별자가 일치하는 내보내기 기록의 사본을 씁니다. 옛 기록에 사본이 없으면 빈 값 그대로이며 최신 구상으로 메우지 않습니다.',
  R6: '일반 보고는 정확히 연결된 대상 작업의 사본을 그대로 잇습니다. 대상이 없으면 빈 값 그대로입니다.'
};
async function checkRef(id, ctxName, whereExpect) {
  const x = await xref(id);
  await check(`${ctxName} ${id} 참고: 실제 양끝·방향 "${FLOW[id].join(' → ')}"`, x && ns(x.flow) === ns(`${FLOW[id][0]}→${FLOW[id][1]}`), x && x.flow);
  await check(`${ctxName} ${id} 참고: 종류 기대 문자열 "${KIND[id]}"`, x && x.kind === `전달: ${KIND[id]}`, x && x.kind);
  await check(`${ctxName} ${id} 참고: 조건 전문 일치`, x && x.cond === COND[id], x && x.cond);
  if (whereExpect) await check(`${ctxName} ${id} 참고: 소속·접힌 대표·지금 선택`, x && JSON.stringify(x.where.map(ns)) === JSON.stringify(whereExpect.map(ns)), x && x.where);
  await check(`${ctxName} ${id} 참고: 근거 줄에 관계 ID·원문(상세 근거)`, x && new RegExp(`관계 ${id}$`).test(x.meta) && /근거 FLOW091-C/.test(x.meta) && /지도 선택은 ‹.+› 그대로 · 참고는 준비문을 바꾸지 않음/.test(x.meta), x && x.meta);
  return x;
}
const E = '이번 확인은 배경 블록의 유무와 요청 당시 사본 유지까지만 다룬다.';
const prepVals = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#prep textarea')].map(t => [t.dataset.f, t.value])));

let crash = null;
try {
  // ---------- S0 초기·첫 선택 ----------
  begin('S0-initial'); await fresh();
  const r0 = await RAW(); cur.raw.initial = r0;
  await check('초기 깊이 G2=0 G3=1 G4=0·무선택', JSON.stringify(r0.depth) === '{"G2":0,"G3":1,"G4":0}' && r0.sel.length === 0, { depth: r0.depth, sel: r0.sel });
  await check('초기 지도 스크롤 없음', r0.map.sw <= r0.map.cw && r0.map.sh <= r0.map.ch, r0.map);
  for (const s of ['#n-G1 .gname', '#n-G2 .gname', '#n-G3 .gname', '#n-G4 .gname', '#n-G5 .gname', '#n-C31 .kname', '#n-C32 .kname', '#n-C32 .kchg']) {
    const t = await TV(s); await check(`초기 지도 글자 ${s}`, t.pass && t.minFontPx >= 11, { chars: t.chars, ok: t.ok, fails: t.fails });
  }
  if (NARROW) await shot('390-initial');
  await click('#n-C32 .kname', 'C32 카드', false);
  const r1 = await RAW(); cur.raw.afterSelect = r1;
  const bd = boxDiff(r0.nodes, r1.nodes); const pdif = r0.edges.map((e, i) => ({ k: e.k, max: r1.edges[i] && e.k === r1.edges[i].k ? pathDiff(e.d, r1.edges[i].d) : Infinity }));
  cur.raw.firstSelectDiff = { boxes: bd, paths: pdif };
  await check('첫 선택 전후 카드 bounds 동일(허용 0.6px)', bd.length === 0, bd);
  await check('첫 선택 전후 선 경로 동일(좌표 허용 0.5px, 원시 최대차 기록)', pdif.every(x => x.max <= .5) && r0.edges.length === r1.edges.length, pdif);
  await check('첫 선택: C32 선택·깊이 불변', JSON.stringify(r1.sel) === '["C32"]' && JSON.stringify(r1.depth) === JSON.stringify(r0.depth), { sel: r1.sel, depth: r1.depth });
  cur.complete = true;

  // ---------- S1 G3: 열기 전 구별 → 참고 바꿔 읽기 → 닫기·Escape·반복 버튼 → 명시 이동 ----------
  begin('S1-G3'); await fresh();
  await click('#n-G3 .gname', 'G3 묶음 이름', false);
  let L = await listInfo(); cur.raw.list = L;
  const g = Object.fromEntries(L.map(x => [x.id, x]));
  await check('G3 목록: R2는 ‘AI 입력’ 아래, R3는 ‘작업문과 미리보기’ 아래(열기 전 구별)', g.R2 && g.R2.group === 'AI 입력' && g.R3 && g.R3.group === '작업문과 미리보기', L);
  await check('G3 목록: 두 항목 모두 같은 보내는 곳·요청 사본 유지', g.R2 && g.R3 && ns(g.R2.text) === ns('받음 ← 새 요청의 배경 고정 요청 사본 · ‹요청 맥락› 안') && ns(g.R3.text) === ns(g.R2.text), [g.R2 && g.R2.text, g.R3 && g.R3.text]);
  await check('G3 목록: 버튼의 설명(aria-describedby)이 실제 받는 세부를 가리킴', g.R2 && /^AI 입력/.test(g.R2.describedBy) && g.R3 && /^작업문과 미리보기/.test(g.R3.describedBy), [g.R2 && g.R2.describedBy, g.R3 && g.R3.describedBy]);
  await check('G3 목록: R4는 작업문과 미리보기 아래 넘김 → 저장·복구', g.R4 && g.R4.group === '작업문과 미리보기' && ns(g.R4.text).startsWith(ns('넘김 → 저장·복구')), g.R4);
  await check('G3 목록: 기본 목록에 관계 ID 없음', L.every(x => !/\bR\d\b/.test(x.text)), L.map(x => x.text));
  for (const s of ['#xg-G3-C31', '#xg-G3-C32', '#panel .xbtn[data-xref="R2"]', '#panel .xbtn[data-xref="R3"]']) await seen(s, `G3 목록 ${s}`);
  if (NARROW) { await wheelTo('#xg-G3-C31'); await shot('390-g3-two-items'); }
  const rG3 = await RAW();
  await click('#panel .xbtn[data-xref="R2"]', 'G3 R2 참고 열기');
  await checkRef('R2', 'G3', ['보내는 쪽 ‹요청 맥락› 안 · 지도에선 접힌 ‹요청 맥락› 자리', '받는 쪽 ‹전달할 내용› 안']);
  let r = await RAW();
  await check('R2 참고 중 G3 선택·깊이 유지', JSON.stringify(r.sel) === '["G3"]' && JSON.stringify(r.depth) === '{"G2":0,"G3":1,"G4":0}', { sel: r.sel, depth: r.depth });
  await check('참고 열어도 지도 카드 bounds 동일', boxDiff(rG3.nodes, r.nodes).length === 0, boxDiff(rG3.nodes, r.nodes));
  // 바꿔 읽기
  await click('#panel .xbtn[data-xref="R3"]', 'R2 열린 채 R3 누름');
  const sw = await page.evaluate(() => ({ r2: !!document.getElementById('xr-R2'), r3: !!document.getElementById('xr-R3'), e2: document.querySelector('.xbtn[data-xref="R2"]').getAttribute('aria-expanded'), e3: document.querySelector('.xbtn[data-xref="R3"]').getAttribute('aria-expanded') }));
  await check('바꿔 읽기: R2 본문 제거·R3만 열림', !sw.r2 && sw.r3 && sw.e2 === 'false' && sw.e3 === 'true', sw);
  await checkRef('R3', 'G3', ['보내는 쪽 ‹요청 맥락› 안 · 지도에선 접힌 ‹요청 맥락› 자리', '받는 쪽 ‹전달할 내용› 안']);
  for (const s of ['#xr-R3 .xhd', '#xr-R3 .xflow', '#xr-R3 .xkind', '#xr-R3 .xwh', '#xr-R3 .xcond', '#xr-R3 [data-mv]']) await seen(s, `참고 ${s}`);
  const xr = await page.evaluate(() => ({ h: __t.rectOf('#xr-R3').h, cards: document.querySelectorAll('#xr-R3 .xends').length }));
  cur.raw.refHeight = xr;
  if (NARROW) { await wheelTo('#xr-R3'); await shot('390-compact-reference'); }
  // 닫기 버튼
  await click('#xr-R3 [data-act="xref-close"]', '참고 닫기 버튼');
  r = await RAW();
  let gone = await page.evaluate(() => ({ dom: !!document.querySelector('#panel .xpeek'), txt: /사본이 없거나 비면 블록을 넣지 않습니다/.test(document.getElementById('panel').innerText) }));
  await check('닫기 버튼: 본문 제거·글자 부재·초점 R3 항목·G3 선택 유지', !gone.dom && !gone.txt && /xbtn\[data-xref=R3\]/.test(r.active) && JSON.stringify(r.sel) === '["G3"]', { gone, active: r.active, sel: r.sel });
  // Escape
  await click('#panel .xbtn[data-xref="R3"]', 'R3 재열기');
  await page.keyboard.press('Escape'); await page.waitForTimeout(150); r = await RAW();
  gone = await page.evaluate(() => ({ dom: !!document.querySelector('#panel .xpeek') }));
  await check('Escape: 본문 제거·초점 R3 항목·선택 유지', !gone.dom && /xbtn\[data-xref=R3\]/.test(r.active) && JSON.stringify(r.sel) === '["G3"]', { gone, active: r.active, sel: r.sel });
  // 반복 버튼(같은 항목 다시 누름)
  await click('#panel .xbtn[data-xref="R2"]', 'R2 열기');
  await click('#panel .xbtn[data-xref="R2"]', 'R2 같은 버튼 다시 누름');
  r = await RAW(); gone = await page.evaluate(() => ({ dom: !!document.querySelector('#panel .xpeek'), e: document.querySelector('.xbtn[data-xref="R2"]').getAttribute('aria-expanded') }));
  await check('반복 버튼: 같은 항목 다시 누르면 닫힘·초점 그 항목', !gone.dom && gone.e === 'false' && /xbtn\[data-xref=R2\]/.test(r.active), { gone, active: r.active });
  // 명시 이동
  await click('#panel .xbtn[data-xref="R3"]', 'R3 열기(이동용)');
  const mvText = await page.evaluate(() => document.querySelector('#xr-R3 [data-mv]').innerText);
  await check('이동 버튼 이름', mvText === '지도에서 ‘새 요청의 배경 고정’ 선택', mvText);
  await click('#xr-R3 [data-mv]', '명시 이동');
  r = await RAW(); cur.raw.afterMove = r;
  await check('명시 이동: C21 선택·G2만 펼침·G3/G4 유지·초점 제목', JSON.stringify(r.sel) === '["C21"]' && JSON.stringify(r.depth) === '{"G2":1,"G3":1,"G4":0}' && r.panelH2 === '새 요청의 배경 고정' && /h2/.test(r.active), { sel: r.sel, depth: r.depth, h2: r.panelH2, active: r.active });
  cur.complete = true;

  // ---------- S2 C21 목록: 이미 서로 다른 수신부 → 묶음 머리 없음, 참고 바꿔 읽기 ----------
  begin('S2-C21');
  L = await listInfo(); cur.raw.list = L;
  await check('C21 목록: 묶음 머리 없이 평평한 4항목(받음/넘김·수신부 이름)', JSON.stringify(L.map(x => [x.id, ns(x.text), x.group])) === JSON.stringify([
    ['R1', ns('받음 ← 구상과 목적 명시 새 요청 때만 사본 고정 · 묶음'), null],
    ['R2', ns('넘김 → AI 입력 요청 사본 · ‹전달할 내용› 안'), null],
    ['R3', ns('넘김 → 작업문과 미리보기 요청 사본 · ‹전달할 내용› 안'), null],
    ['R6', ns('넘김 → 일반 보고 연결 정확히 연결된 대상 작업의 사본 · ‹결과 연결› 안'), null]]) && !(await page.$('#panel .xgrp')), L);
  for (const s of ['#panel .xbtn[data-xref="R2"]', '#panel .xbtn[data-xref="R3"]']) await seen(s, `C21 목록 ${s}`);
  await click('#panel .xbtn[data-xref="R2"]', 'C21 R2 참고');
  await checkRef('R2', 'C21', ['보내는 쪽 ‹요청 맥락› 안 · 지금 선택', '받는 쪽 ‹전달할 내용› 안']);
  await click('#panel .xbtn[data-xref="R3"]', 'C21 R3로 바꿔 읽기');
  await checkRef('R3', 'C21', ['보내는 쪽 ‹요청 맥락› 안 · 지금 선택', '받는 쪽 ‹전달할 내용› 안']);
  await page.keyboard.press('Escape'); await page.waitForTimeout(150); r = await RAW();
  await check('C21: Escape 닫힘·초점·선택 유지', !(await page.$('#panel .xpeek')) && /xbtn\[data-xref=R3\]/.test(r.active) && JSON.stringify(r.sel) === '["C21"]', { active: r.active, sel: r.sel });
  cur.complete = true;

  // ---------- S3 R1–R6 종류·끝·조건 기대 문자열 ----------
  begin('S3-kinds'); await fresh();
  const seenIds = new Set();
  for (const [node, ids, whereByRel] of [
    ['G2', ['R1', 'R2', 'R3', 'R6'], null], ['G4', ['R6', 'R5'], null], ['G3', ['R4'], null]]) {
    await click(`#n-${node} .gname`, `${node} 묶음 이름`);
    const Ls = await listInfo(); cur.raw['list' + node] = Ls; cur.raw['grpHeads' + node] = await page.evaluate(() => [...document.querySelectorAll('#panel .xgrp b')].map(e => e.textContent));
    for (const id of ids) {
      await click(`#panel .xbtn[data-xref="${id}"]`, `${node} ${id} 참고`);
      await checkRef(id, node, null); seenIds.add(id);
      await page.keyboard.press('Escape'); await page.waitForTimeout(120);
    }
  }
  await check('R1–R6 모두 참고로 대조', [...seenIds].sort().join() === 'R1,R2,R3,R4,R5,R6', [...seenIds]);
  cur.raw.listG4 && await check('G4 목록: 일반 보고 연결 ← 새 요청의 배경 고정 / 파일 반환 연결 ← 저장·복구 (R5≠R6 별도 항목)', JSON.stringify(cur.raw.listG4.map(x => [x.id, x.group])) === '[["R6","일반 보고 연결"],["R5","파일 반환 연결"]]', cur.raw.listG4);
  cur.raw.listG2 && await check('G2 목록: 실제 보내는 세부 ‘새 요청의 배경 고정’ 한 머리 아래 4항목(머리 반복 없음)', cur.raw.listG2.every(x => x.group === '새 요청의 배경 고정') && JSON.stringify(cur.raw.grpHeadsG2) === '["새 요청의 배경 고정"]', { list: cur.raw.listG2, heads: cur.raw.grpHeadsG2 });
  cur.complete = true;

  // ---------- S4 C32 E 편집 → 새 참고 왕복 → 재진입·격리 → 비초기 복귀 ----------
  begin('S4-C32-prep'); await fresh();
  await click('#n-G4 .gtog', 'G4 펼치기', false);
  await click('#zIn', '확대', false);
  await click('#n-C32 .kname', 'C32 카드', false);
  r = await RAW();
  await check('비초기: G4 펼침·115%·C32 선택', JSON.stringify(r.depth) === '{"G2":0,"G3":1,"G4":1}' && r.scale.label === '115%' && JSON.stringify(r.sel) === '["C32"]', { depth: r.depth, scale: r.scale, sel: r.sel });
  const ext = { x: r.map.sw - r.map.cw, y: r.map.sh - r.map.ch }; cur.raw.mapExtent = ext;
  await wheelMap(Math.min(60, Math.max(0, ext.x)), Math.min(40, Math.max(0, ext.y)));
  r = await RAW();
  await check('지도 실제 휠 이동(여지 있는 축)', (ext.x <= 0 || r.map.sl > 0) && (ext.y <= 0 || r.map.st > 0), { ext, map: r.map });
  if (!(await wheelTo('#panel [data-act="focus"]'))) await check('집중 버튼을 휠로 화면 안에', false, null);
  const entry = await RAW(); cur.raw.entry = entry;
  if (NARROW) await check('390 main 실제 휠 이동', entry.main.st > 0, entry.main); else cur.raw.noRoom = `1280 main sh=${entry.main.sh} ch=${entry.main.ch}`;
  await click('#panel [data-act="focus"]', 'C32 집중', false);
  await click('#fPrep', '준비 열기', false);
  const def = await prepVals(); cur.raw.defaults = def;
  await check('C32 준비 4필드', Object.keys(def).join() === 'target,keep,evidence,unknown' && def.target.startsWith('작업문과 미리보기'), Object.keys(def));
  await click('#pf-target', '대상 필드', false);
  await page.keyboard.press('Control+End'); await page.keyboard.press('Enter'); await page.keyboard.type(E);
  let v = await prepVals();
  await check('E 추가(대상), 나머지 기본값', v.target === def.target + '\n' + E && v.keep === def.keep && v.evidence === def.evidence && v.unknown === def.unknown, v.target.slice(-60));
  if (!NARROW) await shot('1280-c32-prep-edited');
  await click('#prepClose', '준비 닫기', false);
  await click('#fBack', '전체 지도로', false);
  const ret = await RAW(); cur.raw.returned = ret; // 복귀 직후, 어떤 보조 이동 전
  await check('복귀 직후: 깊이·배율(label·computed)·지도·main·패널 스크롤·선택 동일', JSON.stringify(ret.depth) === JSON.stringify(entry.depth) && ret.scale.label === entry.scale.label && ret.scale.computed === entry.scale.computed && ret.map.sl === entry.map.sl && ret.map.st === entry.map.st && ret.main.st === entry.main.st && ret.panelSt === entry.panelSt && JSON.stringify(ret.sel) === JSON.stringify(entry.sel), { entry: [entry.depth, entry.scale.label, entry.map.sl, entry.map.st, entry.main.st, entry.panelSt, entry.sel], ret: [ret.depth, ret.scale.label, ret.map.sl, ret.map.st, ret.main.st, ret.panelSt, ret.sel] });
  const rb = boxDiff(entry.nodes, ret.nodes), rp = entry.edges.map((e, i) => ({ k: e.k, max: ret.edges[i] ? pathDiff(e.d, ret.edges[i].d) : Infinity }));
  cur.raw.returnDiff = { boxes: rb, paths: rp };
  await check('복귀 직후: 화면 카드 bounds·선 경로 동일(허용차)·초점 호출 버튼', rb.length === 0 && rp.every(x => x.max <= .5) && /\[data-act=focus\]/.test(ret.active), { rb, rp, active: ret.active });
  // 새 참고 왕복: 버튼 닫기 / Escape 각각
  await click('#panel .xbtn[data-xref="R3"]', 'C32 R3 참고');
  await checkRef('R3', 'C32', ['보내는 쪽 ‹요청 맥락› 안 · 지도에선 접힌 ‹요청 맥락› 자리', '받는 쪽 ‹전달할 내용› 안 · 지금 선택']);
  await click('#xr-R3 [data-act="xref-close"]', '참고 닫기 버튼');
  await check('버튼 닫기 제거', !(await page.$('#panel .xpeek')), null);
  await click('#panel .xbtn[data-xref="R4"]', 'C32 R4 참고');
  await checkRef('R4', 'C32', ['보내는 쪽 ‹전달할 내용› 안 · 지금 선택', '받는 쪽 보기용 묶음']);
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  await check('Escape 제거', !(await page.$('#panel .xpeek')), null);
  await click('#panel [data-act="focus"]', 'C32 재진입');
  await click('#fPrep', '준비 재열기', false);
  v = await prepVals(); cur.raw.reopened = v;
  await check('재진입: E 보존·다른 3필드 기본값', v.target === def.target + '\n' + E && v.keep === def.keep && v.evidence === def.evidence && v.unknown === def.unknown, v.target.slice(-60));
  await page.keyboard.press('Escape'); await page.waitForTimeout(120);
  await click('#fBack', '전체 지도로(2)', false);
  // 다른 대상 격리: G3 → 세부 AI 입력 준비
  await click('#n-G3 .gname', 'G3 이름');
  await click('#panel [data-act="focus"]', 'G3 집중');
  await check('G3 집중: 준비 버튼 없음(묶음은 준비 대상 아님)', !(await page.$('#fPrep')), null);
  await click('#focusView [data-fgo="C31"]', 'AI 입력으로 전환');
  await click('#fPrep', 'C31 준비', false);
  const c31 = await prepVals(); const c31t = await page.evaluate(() => document.getElementById('prepTitle').textContent);
  cur.raw.c31 = { title: c31t, v: c31 };
  await check('C31 준비: 자기 기본값·E 없음', c31t === 'AI 입력' && c31.target.startsWith('AI 입력 —') && !Object.values(c31).some(x => x.includes(E)), { title: c31t, t: c31.target.slice(0, 30) });
  await page.keyboard.press('Escape'); await page.waitForTimeout(120);
  await click('#fBack', '전체 지도로(3)', false);
  await click('#n-C32 .kname', 'C32 카드(재)');
  await click('#panel [data-act="focus"]', 'C32 집중(재)');
  await click('#fPrep', 'C32 준비(재)', false);
  v = await prepVals();
  await check('다른 대상 다녀온 뒤 C32 E 보존', v.target === def.target + '\n' + E, v.target.slice(-60));
  await page.keyboard.press('Escape');
  cur.complete = true;
} catch (e) { crash = String(e && e.stack || e); log('CRASH', crash); if (cur) cur.crash = crash; try { await failShot(); } catch { } }
if (ctx) await ctx.close();
await browser.close(); server.close();
const srcEnd = fs.readFileSync(htmlPath);
R.sourceEnd = { bytes: srcEnd.length, sha256: sha(srcEnd) };
R.finished = new Date().toISOString(); R.crash = crash;
R.receivedMatchesSource = Object.values(R.scenes).filter(s => s.received).every(s => s.received.sha256 === R.sourceStart.sha256) && R.sourceStart.sha256 === R.sourceEnd.sha256;
const all = Object.values(R.scenes).flatMap(s => s.assertions);
R.assertions = all.length; R.failed = all.filter(a => !a.pass).length; R.clickPreconditions = all.filter(a => a.name.startsWith('클릭 지점') || a.name.startsWith('휠로')).length;
R.missingScenes = REQUIRED.filter(id => !(R.scenes[id] && R.scenes[id].complete));
const exit = crash ? 2 : (R.failed || R.consoleErrors.length || !R.receivedMatchesSource || R.missingScenes.length) ? 1 : 0;
R.exitCode = exit;
fs.writeFileSync(path.join(outDir, 'raw.json'), JSON.stringify(R, null, 1));
fs.writeFileSync(path.join(outDir, 'log.txt'), logLines.join('\n') + `\nassertions=${R.assertions} (클릭·휠 전제 ${R.clickPreconditions}) failed=${R.failed} wheels=${R.wheels} domScrollCalls=0 missingScenes=${JSON.stringify(R.missingScenes)} consoleErrors=${R.consoleErrors.length} receivedMatchesSource=${R.receivedMatchesSource} exit=${exit}\n`);
process.exit(exit);
