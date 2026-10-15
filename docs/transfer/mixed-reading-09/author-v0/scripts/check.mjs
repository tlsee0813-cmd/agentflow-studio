// cycle09 작성자 브라우저 검사 (child). 사용: node check.mjs <html> <outDir> <W>x<H> <flows: A,B,C | I>
// 실제 마우스 클릭/휠/키 입력만 쓴다. 항목 수 = 실제 assertion 호출 수.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';

const [, , htmlPath, outDir, vpArg, flowArg] = process.argv;
const [VW, VH] = vpArg.split('x').map(Number);
const FLOWS = flowArg.split(',');
fs.mkdirSync(outDir, { recursive: true });
const LIB = fs.readFileSync(new URL('./pagelib.js', import.meta.url), 'utf8');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const srcBuf = fs.readFileSync(htmlPath);
const logLines = [];
const log = (...a) => { const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); logLines.push(s); console.log(s); };
const result = { viewport: [VW, VH], flows: {}, source: { path: path.basename(htmlPath), bytes: srcBuf.length, sha256: sha(srcBuf) }, http: [], consoleErrors: [], started: new Date().toISOString() };
let cur = null; // 현재 흐름 기록
function check(name, cond, data) {
  const a = { name, pass: !!cond, data };
  cur.assertions.push(a);
  log(`${a.pass ? 'PASS' : 'FAIL'} [${cur.id}] ${name}`, a.pass ? '' : JSON.stringify(data).slice(0, 600));
  return a.pass;
}
const step = (name, data) => { cur.steps.push({ name, t: Date.now(), data }); log(`  · ${name}`); };
const same = (a, b, tol = .6) => {
  if (a === null || b === null) return a === b;
  return ['x', 'y', 'w', 'h'].every(k => Math.abs(a[k] - b[k]) <= tol);
};
const nums = d => (d.match(/-?\d+(\.\d+)?(e-?\d+)?/g) || []).map(Number);
const samePath = (a, b, tol = .5) => { const x = nums(a), y = nums(b); return x.length === y.length && x.every((v, i) => Math.abs(v - y[i]) <= tol); };
function diffNodes(A, B, tol) { const d = []; for (const k of Object.keys(A)) if (!same(A[k], B[k], tol)) d.push({ id: k, before: A[k], after: B[k] }); return d; }

// --- HTTP: 이 실행에서 실제로 내보낸 바이트와 브라우저가 받은 바이트를 각각 기록
const server = http.createServer((req, res) => {
  if (req.url.split('?')[0] === '/mixed-reading-study.html') {
    const b = fs.readFileSync(htmlPath);
    result.http.push({ served: req.url, bytes: b.length, sha256: sha(b) });
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); res.end(b);
  } else { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const URLX = `http://127.0.0.1:${server.address().port}/mixed-reading-study.html`;

const browser = await chromium.launch();
result.browser = browser.version();

async function fresh() {
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', e => result.consoleErrors.push({ flow: cur && cur.id, type: 'pageerror', text: e.message }));
  page.on('console', m => { if (m.type() === 'error') result.consoleErrors.push({ flow: cur && cur.id, type: 'console', text: m.text() }); });
  const resp = await page.goto(URLX);
  const body = await resp.body();
  cur.received = { status: resp.status(), bytes: body.length, sha256: sha(body) };
  await page.evaluate(LIB);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  return { ctx, page };
}
async function shot(page, name) { const f = `${cur.id}-${name}.png`; await page.screenshot({ path: path.join(outDir, f) }); cur.pngs.push(f); }
const T = (page, sel) => page.evaluate(s => __t.textVis(s), sel);
const RAW = page => page.evaluate(() => __t.raw());
async function click(page, sel, label) {
  const p = await page.evaluate(s => __t.pointOf(s), sel);
  if (!p) { check(`클릭 대상 존재: ${label}`, false, { sel }); return false; }
  if (!check(`클릭 지점이 화면 안·대상 위: ${label}`, p.inView && p.hitInside, p)) return false;
  await page.mouse.click(p.x, p.y); await page.waitForTimeout(160);
  return true;
}
async function wheel(page, sel, dx, dy) {
  const p = await page.evaluate(s => __t.pointOf(s, .5, .5), sel);
  await page.mouse.move(p.x, p.y); await page.mouse.wheel(dx, dy); await page.waitForTimeout(350);
}
async function textChecks(page, label, sels, minFont = 11) {
  const out = [];
  for (const s of sels) {
    const r = await T(page, s); out.push(r);
    check(`글자 관측 ${label} ${s}`, r.pass && r.minFontPx >= minFont, { chars: r.chars, ok: r.ok, minFontPx: r.minFontPx, fails: r.fails, text: (r.text || '').slice(0, 80) });
  }
  return out;
}
function begin(id) { cur = { id, assertions: [], steps: [], pngs: [], raw: {} }; result.flows[id] = cur; log(`== flow ${id} @ ${VW}x${VH}`); }

const MAP_TEXT = ['#n-G1 .gname', '#n-G1 .gshort', '#n-G2 .gname', '#n-G2 .gshort', '#n-G2 .gfold', '#n-G3 .gname', '#n-G3 .gshort',
  '#n-C31 .kname', '#n-C31 .kshort', '#n-C32 .kname', '#n-C32 .kchg', '#n-C32 .kshort', '#n-G4 .gname', '#n-G4 .gshort', '#n-G4 .gfold', '#n-G5 .gname', '#n-G5 .gshort'];

// ---------------- A: 초기·첫 선택 ----------------
async function flowA() {
  begin('A');
  const { ctx, page } = await fresh();
  const r0 = await RAW(page); cur.raw.initial = r0;
  check('초기 깊이 G2=0 G3=1 G4=0', r0.depth.G2 === 0 && r0.depth.G3 === 1 && r0.depth.G4 === 0, r0.depth);
  check('초기 무선택', r0.sel.length === 0 && r0.isSel.length === 0, { sel: r0.sel, isSel: r0.isSel });
  check('초기 지도 스크롤 없음(전체 지도가 지도 창 안)', r0.map.sw <= r0.map.cw && r0.map.sh <= r0.map.ch, r0.map);
  cur.raw.overlaps = await page.evaluate(() => __t.overlaps());
  check('묶음 카드끼리 겹침 없음', cur.raw.overlaps.length === 0, cur.raw.overlaps);
  cur.raw.text = await textChecks(page, '초기', MAP_TEXT);
  const names = await page.evaluate(() => [...document.querySelectorAll('#n-G1 .gname,#n-G2 .gname,#n-G3 .gname,#n-G4 .gname,#n-G5 .gname')].map(e => e.textContent));
  check('다섯 묶음 이름', JSON.stringify(names) === JSON.stringify(['구상과 목적', '요청 맥락', '전달할 내용', '결과 연결', '저장·복구']), names);
  const chg = await page.evaluate(() => ({ kchg: [...document.querySelectorAll('.kchg')].map(e => e.closest('[data-sel]').dataset.sel), chgKids: [...document.querySelectorAll('.kid.chg')].map(e => e.dataset.sel) }));
  check('변경 표시는 작업문과 미리보기 한 곳(전달할 내용 안)', JSON.stringify(chg) === JSON.stringify({ kchg: ['C32'], chgKids: ['C32'] }), chg);
  check('C32가 전달할 내용 카드 안에 공간적으로 포함', (() => { const g = r0.nodes.G3, c = r0.nodes.C32; return g && c && c.x >= g.x && c.y >= g.y && c.x + c.w <= g.x + g.w && c.y + c.h <= g.y + g.h; })(), { G3: r0.nodes.G3, C32: r0.nodes.C32 });
  const relIds = r0.edges.flatMap(e => e.rels.split(' '));
  check('선에 담긴 원래 관계 ID 배열(중복 제거 전)이 R1–R6 각 1회', JSON.stringify([...relIds].sort()) === JSON.stringify(['R1', 'R2', 'R3', 'R4', 'R5', 'R6']), relIds);
  await shot(page, 'initial');
  step('C32 지도 카드 실제 클릭');
  await click(page, '#n-C32 .kname', 'C32 카드');
  const r1 = await RAW(page); cur.raw.afterSelect = r1;
  check('C32 선택(aria-pressed·is-sel)', JSON.stringify(r1.sel) === '["C32"]' && JSON.stringify(r1.isSel) === '["n-C32"]', { sel: r1.sel, isSel: r1.isSel });
  const nd = diffNodes(r0.nodes, r1.nodes, .6);
  check('선택 전후 노드 bounds 동일', nd.length === 0, nd);
  const pd = r0.edges.map((e, i) => ({ k: e.k, same: r1.edges[i] && samePath(e.d, r1.edges[i].d) && e.k === r1.edges[i].k })).filter(x => !x.same);
  check('선택 전후 선 경로 동일', pd.length === 0 && r0.edges.length === r1.edges.length, pd);
  check('선택 전후 깊이·배율 동일', JSON.stringify(r0.depth) === JSON.stringify(r1.depth) && r0.scale.data === r1.scale.data, { d0: r0.depth, d1: r1.depth, s0: r0.scale, s1: r1.scale });
  check('선택 후 C32 관련 선 강조(R3·R4)', r1.edges.filter(e => e.cls.includes('on')).map(e => e.rels).sort().join('|') === 'R3|R4', r1.edges.map(e => [e.rels, e.cls]));
  check('선택 설명 제목', r1.panelH2 === '작업문과 미리보기', r1.panelH2);
  await shot(page, 'selected');
  // 선택 설명은 390에서 지도 아래에 있으므로 명시적으로 스크롤해 읽는다(이 단계 이후 값은 bounds 비교에 쓰지 않음)
  await page.evaluate(() => document.querySelector('#panel .pk').scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(150);
  const ptext = await page.evaluate(() => document.getElementById('panel').innerText);
  cur.raw.panelText = ptext;
  check('선택 설명 기본 정보에 내부 식별자(C32/R3/F1 등) 없음', !/\b[CRFG]\d{1,2}\b/.test(ptext), ptext);
  check('선택 설명: 받음 새 요청의 배경 고정 / 넘김 저장·복구', /받음 ←\s*새 요청의 배경 고정/.test(ptext) && /넘김 →\s*저장·복구/.test(ptext), ptext);
  const panelSel = ['#panel .pk', '#panel h2', '#panel > p', '#panel .chgnote', '#panel .xbtn[data-xref="R3"]', '#panel .xbtn[data-xref="R4"]'];
  if (VW < 700) panelSel.push('#panel [data-act="focus"]');
  else panelSel.push('#panel [data-act="focus"]');
  cur.raw.panelTextVis = await textChecks(page, '선택설명', panelSel);
  await shot(page, 'panel');
  await ctx.close();
}

// ---------------- B: 관계 분기·참고 ----------------
async function flowB() {
  begin('B');
  const { ctx, page } = await fresh();
  // 기존 직접 선 클릭의 typed relation 선택(단건 선)
  const sp = await page.evaluate(() => __t.edgePoint('C32>G5', .5));
  check('단건 선(C32→저장·복구) 중앙 hit가 그 선', sp && sp.hitInEdge, sp);
  await page.mouse.click(sp.x, sp.y); await page.waitForTimeout(160);
  let r0 = await RAW(page);
  check('단건 선 클릭→관계 선택(typed rel), 깊이 불변', r0.panelH2 === '내보내기 기록의 사본' && /원문 계약의 전달 관계/.test(r0.panelPk || '') && r0.sel.length === 0 && JSON.stringify(r0.depth) === '{"G2":0,"G3":1,"G4":0}', { h2: r0.panelH2, pk: r0.panelPk, sel: r0.sel, depth: r0.depth });
  step('G3 접기 실제 클릭');
  await click(page, '#n-G3 .gtog', 'G3 접기');
  let r = await RAW(page); cur.raw.g3folded = r;
  check('G3만 접힘(G2/G4 유지)', r.depth.G2 === 0 && r.depth.G3 === 0 && r.depth.G4 === 0, r.depth);
  const fold = await page.evaluate(() => ({ agg: document.querySelector('#n-G3 .gfold .agg')?.innerText, sub: document.querySelector('#n-G3 .gfold .sub')?.innerText }));
  check('접힌 G3 집계는 작업문과 미리보기만·묶음 전체 변경 아님', fold.agg === '안에 바뀐 부분 · 작업문과 미리보기' && /묶음 전체 변경 아님/.test(fold.sub || ''), fold);
  await textChecks(page, 'G3접힘', ['#n-G3 .gfold .agg', '#n-G3 .gfold .sub', '#n-G3 .gname']);
  cur.raw.edgesFolded = r.edges.map(e => ({ rels: e.rels.split(' '), rep: [e.repFrom, e.repTo], actual: e.title.split('\n') }));
  const allIds = r.edges.flatMap(e => e.rels.split(' '));
  check('접힘 상태 원래 관계 ID 배열(중복 제거 전) R1–R6 각 1회', JSON.stringify([...allIds].sort()) === JSON.stringify(['R1', 'R2', 'R3', 'R4', 'R5', 'R6']), allIds);
  const b = r.edges.find(e => e.rels === 'R2 R3');
  check('G2·G3 접힘에서 R2·R3이 한 묶음선(대표 G2→G3)', !!b && b.repFrom === 'G2' && b.repTo === 'G3', r.edges.map(e => [e.k, e.rels]));
  check('묶음선 제목에 두 실제 끝(새 요청의 배경 고정→AI 입력 / →작업문과 미리보기)', !!b && /R2 새 요청의 배경 고정 → AI 입력/.test(b.title) && /R3 새 요청의 배경 고정 → 작업문과 미리보기/.test(b.title), b && b.title);
  await shot(page, 'g3-folded');
  const ep = await page.evaluate(() => __t.edgePoint('G2>G3', .5));
  cur.raw.bundlePoint = ep;
  check('묶음선 중앙점의 실제 hit가 그 묶음선(선 또는 관계 수 표시)', ep && ep.hitInEdge, ep);
  await page.mouse.click(ep.x, ep.y); await page.waitForTimeout(160);
  r = await RAW(page);
  check('묶음선 클릭→bundle 선택 설명', r.panelH2 === '이 선에 담긴 실제 관계', r.panelH2);
  const rows = await page.evaluate(() => [...document.querySelectorAll('#panel [data-relrow]')].map(e => ({ id: e.dataset.relrow, text: e.innerText })));
  cur.raw.bundleRows = rows;
  check('묶음 설명에 R2·R3 각각과 실제 끝', rows.length === 2 && /AI 입력/.test(rows[0].text) && /작업문과 미리보기/.test(rows[1].text) && rows.every(x => /새 요청의 배경 고정/.test(x.text)), rows);
  check('묶음 선택은 깊이를 바꾸지 않음', JSON.stringify(r.depth) === '{"G2":0,"G3":0,"G4":0}', r.depth);
  await page.evaluate(() => document.querySelector('#panel [data-rel="R3"]').scrollIntoView({ block: 'center' }));
  await click(page, '#panel [data-rel="R3"]', 'R3만 보기');
  r = await RAW(page);
  const ends = await page.evaluate(() => [...document.querySelectorAll('#panel .ends [data-goto]')].map(e => ({ goto: e.dataset.goto, text: e.innerText })));
  cur.raw.r3ends = ends;
  check('R3 단건: 실제 양끝 C21·C32', r.panelH2 === '요청 사본' && ends.length === 2 && ends[0].goto === 'C21' && ends[1].goto === 'C32', { h2: r.panelH2, ends });
  check('R3 단건: 시작 끝은 접힌 요청 맥락 안으로 표기', /요청 맥락› 안 · 지금 접혀 있음/.test(ends[0] && ends[0].text), ends);
  await shot(page, 'r3-single');
  await page.evaluate(() => document.querySelector('#panel .ends [data-goto="C32"]').scrollIntoView({ block: 'center' }));
  await click(page, '#panel .ends [data-goto="C32"]', 'R3 실제 끝 C32');
  r = await RAW(page); cur.raw.afterEnd = r;
  check('실제 끝 선택: G3만 펼침·G2/G4 유지', JSON.stringify(r.depth) === '{"G2":0,"G3":1,"G4":0}', r.depth);
  check('실제 끝 선택: C32 선택(대표 G3 아님)', JSON.stringify(r.sel) === '["C32"]' && JSON.stringify(r.isSel) === '["n-C32"]', { sel: r.sel, isSel: r.isSel });
  const map6 = r.edges.flatMap(e => e.rels.split(' ').map(id => ({ id, rep: [e.repFrom, e.repTo], actual: (e.title.split('\n').find(t => t.startsWith(id + ' ')) || '') })));
  cur.raw.relationMap = map6.sort((a, b) => a.id.localeCompare(b.id));
  check('R3 대표 끝이 실제 C32로 바뀜(G2 접힘이므로 시작 대표 G2)', !!map6.find(x => x.id === 'R3' && x.rep[0] === 'G2' && x.rep[1] === 'C32'), map6);
  // 참고 열기
  await page.evaluate(() => document.querySelector('#panel .xbtn[data-xref="R3"]').scrollIntoView({ block: 'center' }));
  const beforeRef = await RAW(page);
  await click(page, '#panel .xbtn[data-xref="R3"]', 'R3 참고 열기');
  r = await RAW(page);
  const xp = await page.evaluate(() => { const e = document.getElementById('xr-R3'); return e ? { text: e.innerText, rect: __t.rectOf('#xr-R3') } : null; });
  cur.raw.xrefOpen = { raw: r, xp };
  check('참고 열림 내용: 실제 C21 이름·소속·접힘·종류·요청시점 조건', !!xp && /새 요청의 배경 고정/.test(xp.text) && /요청 맥락› 안/.test(xp.text) && /접힌 ‹요청 맥락› 자리/.test(xp.text) && /요청 사본/.test(xp.text) && /명시 새 요청 때 고정한 그 요청의 배경 사본/.test(xp.text) && /최신 구상을 가져오는 것이 아닙니다/.test(xp.text), xp && xp.text);
  check('참고 열어도 C32 선택·G2 접힘·깊이 유지', JSON.stringify(r.sel) === '["C32"]' && JSON.stringify(r.depth) === '{"G2":0,"G3":1,"G4":0}' && r.panelH2 === '작업문과 미리보기', { sel: r.sel, depth: r.depth, h2: r.panelH2 });
  check('참고 열어도 지도 노드 bounds 동일', diffNodes(beforeRef.nodes, r.nodes, .6).length === 0, diffNodes(beforeRef.nodes, r.nodes, .6));
  await page.evaluate(() => document.getElementById('xr-R3').scrollIntoView({ block: 'nearest' }));
  await page.waitForTimeout(120);
  await textChecks(page, '참고', ['#xr-R3 .pkh', '#xr-R3 .xends', '#xr-R3 > p:not(.muted)', '#xr-R3 [data-act="xref-close"]', '#xr-R3 [data-mv]']);
  await shot(page, 'xref-open');
  // 닫기 버튼
  const xrect = await page.evaluate(() => __t.rectOf('#xr-R3'));
  await click(page, '#xr-R3 [data-act="xref-close"]', '참고 닫기 버튼');
  r = await RAW(page);
  const gone1 = await page.evaluate(rc => ({ inDom: !!document.getElementById('xr-R3'), panelHas: /명시 새 요청 때 고정한 그 요청의 배경 사본/.test(document.getElementById('panel').innerText), atOld: rc ? __t.desc(document.elementFromPoint(rc.x + rc.w / 2, Math.min(innerHeight - 1, rc.y + rc.h / 2))) : null, expanded: document.querySelector('.xbtn[data-xref="R3"]').getAttribute('aria-expanded') }), xrect);
  cur.raw.closeButton = { raw: r, gone1 };
  check('닫기 버튼: 본문 DOM 제거·패널 글자 부재·aria-expanded=false', !gone1.inDom && !gone1.panelHas && gone1.expanded === 'false' && !/xpeek/.test(gone1.atOld || ''), gone1);
  check('닫기 버튼: 초점이 호출 버튼(R3 참고)으로', /xbtn\[data-xref=R3\]/.test(r.active || ''), r.active);
  check('닫기 버튼 뒤 C32 선택·깊이 유지', JSON.stringify(r.sel) === '["C32"]' && JSON.stringify(r.depth) === '{"G2":0,"G3":1,"G4":0}', { sel: r.sel, depth: r.depth });
  // Escape
  await click(page, '#panel .xbtn[data-xref="R3"]', 'R3 참고 재열기');
  check('재열기 성공', await page.evaluate(() => !!document.getElementById('xr-R3')), null);
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  r = await RAW(page);
  const gone2 = await page.evaluate(() => ({ inDom: !!document.getElementById('xr-R3'), panelHas: /명시 새 요청 때 고정한 그 요청의 배경 사본/.test(document.getElementById('panel').innerText) }));
  check('Escape: 본문 제거·글자 부재', !gone2.inDom && !gone2.panelHas, gone2);
  check('Escape: 초점이 호출 버튼으로', /xbtn\[data-xref=R3\]/.test(r.active || ''), r.active);
  check('Escape 뒤 C32 선택·깊이 유지', JSON.stringify(r.sel) === '["C32"]' && JSON.stringify(r.depth) === '{"G2":0,"G3":1,"G4":0}', { sel: r.sel, depth: r.depth });
  // 준비 대상 보존: 참고 후 집중·준비 대상이 C32
  await page.evaluate(() => document.querySelector('#panel [data-act="focus"]').scrollIntoView({ block: 'center' }));
  await click(page, '#panel [data-act="focus"]', '집중 진입');
  await click(page, '#fPrep', '준비 열기');
  const pt = await page.evaluate(() => ({ title: document.getElementById('prepTitle').textContent, target: document.getElementById('pf-target').value.slice(0, 40), fv: document.querySelector('.fbody h2')?.textContent }));
  check('참고 후 준비 대상은 작업문과 미리보기(C21로 이동 안 함)', pt.title === '작업문과 미리보기' && pt.fv === '작업문과 미리보기' && pt.target.startsWith('작업문과 미리보기'), pt);
  await page.keyboard.press('Escape'); await page.waitForTimeout(120);
  await click(page, '#fBack', '전체 지도로');
  // 명시 이동 경로(참고 유지 성공과 구분)
  await page.evaluate(() => document.querySelector('#panel .xbtn[data-xref="R3"]').scrollIntoView({ block: 'center' }));
  await click(page, '#panel .xbtn[data-xref="R3"]', 'R3 참고 열기(이동용)');
  await page.evaluate(() => document.querySelector('#xr-R3 [data-mv]').scrollIntoView({ block: 'center' }));
  const mvText = await page.evaluate(() => document.querySelector('#xr-R3 [data-mv]').innerText);
  check('이동 버튼은 이름을 밝힘', mvText === '지도에서 ‘새 요청의 배경 고정’ 선택', mvText);
  await click(page, '#xr-R3 [data-mv]', '명시 이동 버튼');
  r = await RAW(page); cur.raw.afterMove = r;
  check('명시 이동: C21 선택·G2만 펼침(G3/G4 유지)', JSON.stringify(r.sel) === '["C21"]' && JSON.stringify(r.depth) === '{"G2":1,"G3":1,"G4":0}' && r.panelH2 === '새 요청의 배경 고정', { sel: r.sel, depth: r.depth, h2: r.panelH2 });
  await page.evaluate(() => document.getElementById('n-C21').scrollIntoView({ block: 'nearest', inline: 'nearest' }));
  await shot(page, 'moved-c21');
  await ctx.close();
}

// ---------------- C: 비초기 복귀·편집 ----------------
const EMARK = ' [E09 작성자 편집 표식]';
async function flowC() {
  begin('C');
  const { ctx, page } = await fresh();
  step('G4 펼치기(비기본 깊이) + 확대 1단계');
  await click(page, '#n-G4 .gtog', 'G4 펼치기');
  await click(page, '#zIn', '확대');
  await click(page, '#n-C32 .kname', 'C32 카드');
  let r = await RAW(page);
  check('비기본 상태: G4 펼침·배율 115%', JSON.stringify(r.depth) === '{"G2":0,"G3":1,"G4":1}' && r.scale.label === '115%' && r.scale.data === '1.15', { depth: r.depth, scale: r.scale });
  // 지도 스크롤: 실제 휠
  const ext = { x: r.map.sw - r.map.cw, y: r.map.sh - r.map.ch };
  cur.raw.mapExtent = ext;
  await wheel(page, '#mapScroll', Math.min(60, Math.max(0, ext.x)), Math.min(40, Math.max(0, ext.y)));
  r = await RAW(page);
  cur.raw.mapScrollAfterWheel = r.map;
  check('지도 스크롤: 이동 여지가 있는 축은 실제로 움직임', (ext.x <= 0 || r.map.sl > 0) && (ext.y <= 0 || r.map.st > 0), { ext, sl: r.map.sl, st: r.map.st });
  cur.raw.noRoom = { mapX: ext.x <= 0 ? `extent ${ext.x}` : null, mapY: ext.y <= 0 ? `extent ${ext.y}` : null };
  // main 스크롤(390): 선택 설명의 집중 버튼이 화면 안에 오도록 휠
  const mainExt = r.main.sh - r.main.ch;
  if (mainExt > 0) {
    for (let i = 0; i < 6; i++) {
      const p = await page.evaluate(() => __t.pointOf('#panel [data-act="focus"]'));
      if (p.inView && p.y < VH - 40) break;
      await wheel(page, '#panel h2', 0, 120);
    }
  } else cur.raw.noRoom.main = `main scrollHeight=${r.main.sh} clientHeight=${r.main.ch}`;
  const entry = await RAW(page); cur.raw.entry = entry;
  if (mainExt > 0) check('main 실제 휠 이동', entry.main.st > 0, entry.main);
  check('C32 선택 유지(진입 직전)', JSON.stringify(entry.sel) === '["C32"]', entry.sel);
  await shot(page, 'entry');
  const fp = await page.evaluate(() => __t.pointOf('#panel [data-act="focus"]'));
  check('집중 버튼이 이미 화면 안(자동 스크롤 없이 누름)', fp.inView && fp.hitInside, fp);
  await page.mouse.click(fp.x, fp.y); await page.waitForTimeout(200);
  r = await RAW(page);
  check('집중 진입', r.view === 'focus', r.view);
  await textChecks(page, '집중-소속', ['.fbar .fpath', '#fBack', '#fPrep']);
  await shot(page, 'focus');
  // 근거 참고: 실제 휠 위치에서 열기·닫기
  await wheel(page, '#focusView', 0, 320);
  const fvTop0 = await page.evaluate(() => document.getElementById('focusView').scrollTop);
  cur.raw.fvTopBeforeEv = fvTop0;
  check('집중 화면 실제 휠 이동', fvTop0 > 0, fvTop0);
  const evSel = await page.evaluate(() => __t.visibleEv());
  check('화면 안 근거 버튼 존재', !!evSel, evSel);
  const evRect0 = await page.evaluate(s => __t.rectOf(s), evSel);
  await click(page, evSel, '근거 열기');
  const pk = await page.evaluate(s => { const k = document.querySelector(s).dataset.key; return { key: k, open: !!document.getElementById('pk-' + k) }; }, evSel);
  check('근거 참고 열림', pk.open, pk);
  await textChecks(page, '근거', [`#pk-${pk.key} .pkh`, `#pk-${pk.key} > p`]);
  await click(page, `#pk-${pk.key} [data-act="peek-close"]`, '근거 닫기');
  const afterEv = await page.evaluate(([s, k]) => ({ open: !!document.getElementById('pk-' + k), fvTop: document.getElementById('focusView').scrollTop, active: __t.desc(document.activeElement), rect: __t.rectOf(s) }), [evSel, pk.key]);
  cur.raw.evClose = { evRect0, afterEv };
  check('근거 닫기: 제거·읽기 위치·버튼 초점 복귀', !afterEv.open && Math.abs(afterEv.fvTop - fvTop0) <= 1 && /\.ev\[/.test(afterEv.active) && Math.abs(afterEv.rect.y - evRect0.y) <= 1, { fvTop0, afterEv, evRect0 });
  // 준비 E 편집
  await page.evaluate(() => { const f = document.getElementById('fPrep'); return f.getBoundingClientRect().top; });
  await click(page, '#fPrep', '준비 열기');
  const def = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#prep textarea')].map(t => [t.dataset.f, t.value])));
  cur.raw.prepDefaultsC32 = def;
  check('C32 준비 4필드·기본값', Object.keys(def).join(',') === 'target,keep,evidence,unknown' && def.target.startsWith('작업문과 미리보기'), Object.keys(def));
  await click(page, '#pf-target', '대상 필드');
  await page.keyboard.press('Control+End'); await page.keyboard.type(EMARK);
  const edited = await page.evaluate(() => ({ v: document.getElementById('pf-target').value, mark: !document.querySelector('[data-ed="target"]').hidden }));
  check('E 입력·직접 고침 표시', edited.v.endsWith(EMARK) && edited.mark, edited);
  await shot(page, 'prep-edited');
  await click(page, '#prepClose', '준비 닫기');
  const fvTopAfterPrep = await page.evaluate(() => ({ fvTop: document.getElementById('focusView').scrollTop, active: __t.desc(document.activeElement) }));
  check('준비 닫기: 집중 읽기 위치·준비 버튼 초점', Math.abs(fvTopAfterPrep.fvTop - fvTop0) <= 1 && /#fPrep/.test(fvTopAfterPrep.active), fvTopAfterPrep);
  // 복귀
  await click(page, '#fBack', '전체 지도로');
  const ret = await RAW(page); cur.raw.returned = ret;
  check('복귀: 지도 보기', ret.view === 'map', ret.view);
  check('복귀: 깊이 동일', JSON.stringify(ret.depth) === JSON.stringify(entry.depth), { entry: entry.depth, ret: ret.depth });
  check('복귀: 배율(data·label·computed) 동일', ret.scale.data === entry.scale.data && ret.scale.label === entry.scale.label && ret.scale.computed === entry.scale.computed, { entry: entry.scale, ret: ret.scale });
  check('복귀: 지도 스크롤 동일', ret.map.sl === entry.map.sl && ret.map.st === entry.map.st, { entry: entry.map, ret: ret.map });
  check('복귀: main 스크롤 동일', ret.main.st === entry.main.st, { entry: entry.main, ret: ret.main });
  check('복귀: 패널 읽기 위치 동일', ret.panelSt === entry.panelSt, { entry: entry.panelSt, ret: ret.panelSt });
  check('복귀: 선택 동일(C32)', JSON.stringify(ret.sel) === JSON.stringify(entry.sel) && JSON.stringify(ret.isSel) === JSON.stringify(entry.isSel), { entry: [entry.sel, entry.isSel], ret: [ret.sel, ret.isSel] });
  const nd = diffNodes(entry.nodes, ret.nodes, .6);
  check('복귀: 화면상 노드 bounds 동일(대표 여러 개)', nd.length === 0, nd);
  const ed = entry.edges.map((e, i) => (ret.edges[i] && samePath(e.d, ret.edges[i].d) && e.rels === ret.edges[i].rels) ? null : { k: e.k, entry: e.d, ret: ret.edges[i] && ret.edges[i].d }).filter(Boolean);
  check('복귀: 선 경로 동일', ed.length === 0 && entry.edges.length === ret.edges.length, ed);
  check('복귀: 초점이 호출 버튼(자세히 읽고…)으로', /\[data-act=focus\]/.test(ret.active || ''), ret.active);
  await shot(page, 'returned');
  // 재진입: E 보존
  const fp2 = await page.evaluate(() => __t.pointOf('#panel [data-act="focus"]'));
  check('재진입 버튼 화면 안', fp2.inView && fp2.hitInside, fp2);
  await page.mouse.click(fp2.x, fp2.y); await page.waitForTimeout(200);
  await click(page, '#fPrep', '준비 재열기');
  let v = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#prep textarea')].map(t => [t.dataset.f, t.value])));
  check('재진입: E 보존(대상), 나머지 기본값', v.target === def.target + EMARK && v.keep === def.keep && v.evidence === def.evidence && v.unknown === def.unknown, { target: v.target.slice(-40) });
  await page.keyboard.press('Escape'); await page.waitForTimeout(120);
  // E 편집 후 근거 참고 열닫기(Escape) → E 남는지
  let evSel2 = await page.evaluate(() => __t.visibleEv());
  for (let i = 0; !evSel2 && i < 8; i++) { await wheel(page, '#focusView', 0, 160); evSel2 = await page.evaluate(() => __t.visibleEv()); }
  cur.raw.fvTopReentryEv = await page.evaluate(() => document.getElementById('focusView').scrollTop);
  check('재진입 후 화면 안 근거 버튼', !!evSel2, evSel2);
  await click(page, evSel2, '근거 열기(재진입 후)');
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  const pk2 = await page.evaluate(() => document.querySelectorAll('#focusView .peek').length);
  check('Escape로 근거 닫힘', pk2 === 0, pk2);
  await click(page, '#fPrep', '준비 3번째 열기');
  v = await page.evaluate(() => document.getElementById('pf-target').value);
  check('근거 열닫기 뒤에도 E 보존', v === def.target + EMARK, v.slice(-40));
  await shot(page, 'reentry-prep');
  await page.keyboard.press('Escape'); await page.waitForTimeout(120);
  await click(page, '#fBack', '전체 지도로(2)');
  if (VW >= 700) {
    step('1280: C21 준비 격리');
    await click(page, '#n-G2 .gtog', 'G2 펼치기');
    await click(page, '#n-C21 .kname', 'C21 카드');
    await click(page, '#panel [data-act="focus"]', 'C21 집중');
    await click(page, '#fPrep', 'C21 준비');
    const c21 = await page.evaluate(() => ({ title: document.getElementById('prepTitle').textContent, v: Object.fromEntries([...document.querySelectorAll('#prep textarea')].map(t => [t.dataset.f, t.value])), marks: [...document.querySelectorAll('[data-ed]')].filter(s => !s.hidden).length }));
    cur.raw.c21prep = c21;
    check('C21 준비: 자기 기본값, E 없음, 직접 고침 표시 없음', c21.title === '새 요청의 배경 고정' && c21.v.target.startsWith('새 요청의 배경 고정') && !Object.values(c21.v).some(x => x.includes('E09')) && c21.marks === 0, c21);
    await page.keyboard.press('Escape'); await page.waitForTimeout(100);
    await click(page, '#fBack', '전체 지도로(3)');
    await click(page, '#n-C32 .kname', 'C32 카드(재)');
    await click(page, '#panel [data-act="focus"]', 'C32 집중(재)');
    await click(page, '#fPrep', 'C32 준비(재)');
    v = await page.evaluate(() => document.getElementById('pf-target').value);
    check('C21 다녀온 뒤 C32 E 보존', v === def.target + EMARK, v.slice(-40));
    await page.keyboard.press('Escape');
  }
  await ctx.close();
}

// ---------------- I: 1440 초기 조망 보조 ----------------
async function flowI() {
  begin('I');
  const { ctx, page } = await fresh();
  const r0 = await RAW(page); cur.raw.initial = r0;
  check('초기 깊이', JSON.stringify(r0.depth) === '{"G2":0,"G3":1,"G4":0}', r0.depth);
  cur.raw.overlaps = await page.evaluate(() => __t.overlaps());
  check('묶음 카드 겹침 없음', cur.raw.overlaps.length === 0, cur.raw.overlaps);
  check('지도 스크롤 없음', r0.map.sw <= r0.map.cw && r0.map.sh <= r0.map.ch, r0.map);
  cur.raw.text = await textChecks(page, '1440초기', MAP_TEXT);
  await shot(page, 'initial');
  await ctx.close();
}

let crashed = null;
try {
  for (const f of FLOWS) {
    if (f === 'A') await flowA(); else if (f === 'B') await flowB(); else if (f === 'C') await flowC(); else if (f === 'I') await flowI();
  }
} catch (e) { crashed = String(e && e.stack || e); log('CRASH', crashed); if (cur) cur.crash = crashed; }
await browser.close(); server.close();
result.finished = new Date().toISOString();
result.crash = crashed;
const all = Object.values(result.flows).flatMap(f => f.assertions);
for (const f of Object.values(result.flows)) {
  f.received && (f.receivedMatchesSource = f.received.sha256 === result.source.sha256 && f.received.bytes === result.source.bytes);
  f.count = f.assertions.length; f.failed = f.assertions.filter(a => !a.pass).length;
}
result.assertions = all.length; result.failed = all.filter(a => !a.pass).length;
const httpOk = Object.values(result.flows).every(f => f.receivedMatchesSource);
result.httpMatchesSource = httpOk;
const exit = crashed ? 2 : (result.failed || result.consoleErrors.length || !httpOk) ? 1 : 0;
result.exitCode = exit;
fs.writeFileSync(path.join(outDir, 'raw.json'), JSON.stringify(result, null, 1));
fs.writeFileSync(path.join(outDir, 'log.txt'), logLines.join('\n') + `\nassertions=${result.assertions} failed=${result.failed} consoleErrors=${result.consoleErrors.length} httpMatchesSource=${httpOk} exit=${exit}\n`);
process.exit(exit);
