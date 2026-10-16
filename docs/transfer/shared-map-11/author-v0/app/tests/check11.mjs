// cycle11 작성자 검사 child. 사용: node check11.mjs <appRoot> <outDir> <mode> [--png]
//  mode: pc-1280 | pc-1440 | smoke-390 | temp-inputs | static
// 실제 마우스 클릭(화면 안·대상 위 hit 확인 뒤)과 실제 휠을 쓴다. 사례 선택은 Playwright selectOption(실제 change 이벤트)으로 한다.
// DOM scrollIntoView/scrollTop 대입은 쓰지 않는다. 시나리오가 끝까지 가지 않으면 nonzero로 끝난다.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';

const [, , ROOT, OUT, MODE, PNGFLAG] = process.argv;
const PNG = PNGFLAG === '--png';
fs.mkdirSync(OUT, { recursive: true });
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const LIB = fs.readFileSync(path.join(ROOT, 'tests', 'pagelib.js'), 'utf8');
const FX = { flow: JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures/flow091.json'), 'utf8')), pt: JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures/powertoys.json'), 'utf8')) };
const logLines = []; const log = (...a) => { const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); logLines.push(s); console.log(s); };
const R = { mode: MODE, started: new Date().toISOString(), served: [], consoleErrors: [], scenarios: {}, wheels: 0, selectOptionCalls: 0, domScrollCalls: 0, pngs: [], firstFailure: null };
const srcHashes = () => Object.fromEntries(['index.html', 'engine.js', 'style.css', 'fixtures/flow091.json', 'fixtures/powertoys.json'].map(f => { const b = fs.readFileSync(path.join(ROOT, f)); return [f, { bytes: b.length, sha256: sha(b) }]; }));
R.sourceBefore = srcHashes();
let cur = null, page = null, VW = 0, VH = 0;
function begin(id) { cur = { id, assertions: [], raw: {}, complete: false }; R.scenarios[id] = cur; log(`== ${id}`); }
async function check(name, cond, data) {
  const a = { name, pass: !!cond, data }; cur.assertions.push(a);
  log(`${a.pass ? 'PASS' : 'FAIL'} [${cur.id}] ${name}`, a.pass ? '' : JSON.stringify(data).slice(0, 700));
  if (!a.pass && !R.firstFailure) { R.firstFailure = { scenario: cur.id, name, data }; try { const f = `FIRSTFAIL-${cur.id}.png`; await page.screenshot({ path: path.join(OUT, f) }); R.pngs.push(f); } catch { } }
  return a.pass;
}
async function shot(name) { if (!PNG) return; const f = `${name}.png`; await page.screenshot({ path: path.join(OUT, f) }); R.pngs.push(f); log('  PNG ' + f); }

// --- HTTP: 실제로 내보낸 파일의 bytes/SHA를 응답마다 기록
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };
const server = http.createServer((q, s) => {
  const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '');
  const p = path.join(ROOT, rel);
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { R.served.push({ path: rel, status: 404 }); s.writeHead(404); s.end(); return; }
  const b = fs.readFileSync(p); R.served.push({ path: rel, status: 200, bytes: b.length, sha256: sha(b) });
  s.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' }); s.end(b);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/index.html`;
const browser = await chromium.launch(); R.browser = browser.version();
let ctx = null;
async function open(vw, vh, query = '') {
  if (ctx) await ctx.close();
  VW = vw; VH = vh;
  ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1 });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(BASE).origin });
  page = await ctx.newPage();
  page.on('pageerror', e => R.consoleErrors.push({ scenario: cur && cur.id, type: 'pageerror', text: e.message }));
  page.on('console', m => { if (m.type() === 'error') R.consoleErrors.push({ scenario: cur && cur.id, type: 'console', text: m.text() }); });
  page.on('response', async resp => { try { const u = new URL(resp.url()); const b = await resp.body(); (cur.raw.received = cur.raw.received || []).push({ path: u.pathname.replace(/^\//, '') + u.search, status: resp.status(), bytes: b.length, sha256: sha(b) }); } catch { } });
  await page.goto(BASE + query);
  await page.waitForSelector('#app[data-ready="1"]', { timeout: 10000 });
  await page.evaluate(LIB); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(250);
}
const V = () => page.evaluate(() => __t.view());
const PT = s => page.evaluate(x => __t.pointOf(x), s);
const TV = s => page.evaluate(x => __t.textVis(x), s);
const txt = s => page.evaluate(x => { const e = document.querySelector(x); return e ? e.innerText : null; }, s);
const ns = t => (t || '').replace(/\s+/g, '');
// 실제 휠로 대상이 화면 안(그리고 가려지지 않음)에 오게 한다. 굴릴 컨테이너: 넓은 화면 패널/지도, 좁은 화면 main
async function wheelTo(sel, container) {
  for (let i = 0; i < 18; i++) {
    const p = await PT(sel); if (!p) return false;
    if (p.inView && p.hitInside && p.rect.y >= 0 && p.rect.y + Math.min(p.rect.h, VH - 60) <= VH) return true;
    const c = await page.evaluate(s => { const e = document.querySelector(s), r = e.getBoundingClientRect(); return { x: (Math.max(r.left, 0) + Math.min(r.right, innerWidth)) / 2, y: (Math.max(r.top, 0) + Math.min(r.bottom, innerHeight)) / 2 }; }, container);
    const dy = Math.max(-300, Math.min(300, Math.round(p.rect.y - VH * .4)));
    await page.mouse.move(c.x, c.y); await page.mouse.wheel(0, dy || 60); R.wheels++; await page.waitForTimeout(200);
  }
  const p = await PT(sel); return !!p && p.inView && p.hitInside;
}
const scrollBox = () => VW < 700 ? '#main' : '#panel';
async function click(sel, label, container) {
  if (container && !(await wheelTo(sel, container))) { await check(`휠로 화면 안에 가져옴: ${label}`, false, await PT(sel)); throw new Error('unreachable ' + label); }
  const p = await PT(sel);
  if (!(await check(`클릭 지점 화면 안·대상 위: ${label}`, p && p.inView && p.hitInside, p))) throw new Error('click-blocked ' + label);
  await page.mouse.click(p.x, p.y); await page.waitForTimeout(160);
}
async function seen(sel, label, container) {
  if (container) await wheelTo(sel, container);
  const t = await TV(sel);
  await check(`글자 관측(개별 글자·clip·hit) ${label}`, t.pass && t.minFontPx >= 11, { chars: t.chars, ok: t.ok, minFontPx: t.minFontPx, fails: t.fails, text: (t.text || '').slice(0, 100) });
}
const nums = d => (d.match(/-?\d+(\.\d+)?/g) || []).map(Number);
const pathDiff = (a, b) => { const x = nums(a), y = nums(b); return x.length !== y.length ? Infinity : Math.max(0, ...x.map((v, i) => Math.abs(v - y[i]))); };
const boxDiff = (A, B) => Object.keys({ ...A, ...B }).filter(k => { const a = A[k], b = B[k]; if (!a || !b) return a !== b; return ['x', 'y', 'w', 'h'].some(q => Math.abs(a[q] - b[q]) > .6); });
async function sameView(a, b, label, opts = {}) {
  const d = { depth: JSON.stringify(a.depth) === JSON.stringify(b.depth), scale: a.scale.label === b.scale.label && a.scale.computed === b.scale.computed,
    map: a.map.sl === b.map.sl && a.map.st === b.map.st, main: a.main.st === b.main.st, panel: opts.ignorePanel ? true : a.panelSt === b.panelSt,
    sel: JSON.stringify(a.sel) === JSON.stringify(b.sel), boxes: boxDiff(a.nodes, b.nodes), paths: a.edges.length === b.edges.length ? Math.max(0, ...a.edges.map((e, i) => e.k === b.edges[i].k ? pathDiff(e.d, b.edges[i].d) : Infinity)) : Infinity };
  await check(`${label}: 깊이·배율·지도/main${opts.ignorePanel ? '' : '·패널'} 스크롤·선택·카드·선 동일`, d.depth && d.scale && d.map && d.main && d.panel && d.sel && d.boxes.length === 0 && d.paths <= .5, { d, a: { depth: a.depth, scale: a.scale.label, map: [a.map.sl, a.map.st], main: a.main.st, panel: a.panelSt, sel: a.sel }, b: { depth: b.depth, scale: b.scale.label, map: [b.map.sl, b.map.st], main: b.main.st, panel: b.panelSt, sel: b.sel } });
  return d;
}
const changedOf = fx => fx.nodes.filter(n => n.change);
const relsTouching = (fx, id) => { const kids = fx.nodes.filter(n => n.parent === id).map(n => n.id); const f = [id, ...kids]; return fx.relations.filter(r => f.includes(r.from) || f.includes(r.to)); };
const nodeById = (fx, id) => fx.nodes.find(n => n.id === id);
const sNode = id => `#world [data-node="${id}"]`;
const sSel = id => `#world [data-sel="${id}"]`;

// 사례별 검사 대본(검사 쪽 지식이며 렌더러에는 없다)
const PROFILE = {
  flow: { idx: 0, fx: FX.flow, changed: 'C32', relNode: 'C32', rel: 'R3', moveTo: 'C21', other: 'C31', depthToggle: 'G4' },
  pt: { idx: 1, fx: FX.pt, changed: 'SR', relNode: 'RC', rel: 'X1', moveTo: 'HK', other: 'RC', depthToggle: null }
};
const E = { flow: '이번 확인은 배경 블록의 유무와 요청 당시 사본 유지까지만 다룬다.', pt: '검색 즉시 Enter 재현만 다시 확인하고 녹화 쪽은 건드리지 않는다.' };

async function caseFlow(key, W) {
  const P = PROFILE[key], fx = P.fx, sid = `${key}`;
  begin(`${W}-${key}-1-overview`);
  let v = await V(); cur.raw.initial = v;
  await check('사례 제목', v.title === fx.title, v.title);
  const meta = await page.evaluate(() => [...document.querySelectorAll('#caseHead .meta dd')].map(e => e.textContent));
  await check('범위·자료 성격·기준 시점(·묶음)이 입력 문자열 그대로', meta[0] === fx.scope && meta[1] === fx.nature && meta[2] === fx.basisTime && (!fx.groupingNote || meta[3] === fx.groupingNote), meta);
  const chips = await page.evaluate(() => [...document.querySelectorAll('#caseHead .chgchip')].map(b => [b.dataset.goto, b.querySelector('b').textContent, b.querySelector('span').textContent]));
  await check('‘이 기록에서 달라진 부분’ 칩 = 입력의 change 노드(이름·라벨) 전부와만', JSON.stringify(chips) === JSON.stringify(changedOf(fx).map(n => [n.id, n.name, n.change.label])), chips);
  const mapIds = Object.keys(v.nodes).sort(); await check('지도에 입력의 모든 노드(루트+자식)가 있음', JSON.stringify(mapIds) === JSON.stringify(fx.nodes.map(n => n.id).sort()), mapIds);
  const initDepth = Object.fromEntries(fx.nodes.filter(n => n.parent === null && fx.nodes.some(k => k.parent === n.id)).map(n => [n.id, fx.initialView.expanded.includes(n.id) ? 1 : 0]));
  await check('초기 깊이 = initialView.expanded', JSON.stringify(v.depth) === JSON.stringify(initDepth), { v: v.depth, e: initDepth });
  await check('초기 무선택·배율 100%', v.sel.length === 0 && v.scale.label === '100%', { sel: v.sel, s: v.scale.label });
  await check('100%에서 지도 창 안에 지도 전체(스크롤 없음)', v.map.sw <= v.map.cw && v.map.sh <= v.map.ch, v.map);
  const ov = await page.evaluate(() => __t.overlaps()); await check('카드 겹침 없음', ov.length === 0, ov);
  const shown = fx.nodes.filter(n => n.parent === null || fx.initialView.expanded.includes(n.parent));
  for (const n of shown) await seen(`${sNode(n.id)} ${n.parent === null ? '.gname' : '.kname'}`, `지도 이름 ${n.id}`);
  for (const n of changedOf(fx).filter(n => shown.includes(n))) await seen(`${sNode(n.id)} .kchg`, `변경 칩 ${n.id}`);
  const relIds = v.edges.flatMap(e => e.rels.split(' ')).sort();
  await check('선에 담긴 관계 ID = 입력 relations 전부', JSON.stringify(relIds) === JSON.stringify(fx.relations.map(r => r.id).sort()), relIds);
  if (W === 1280) await shot(`${W}-${key}-overview`);
  cur.complete = true;

  begin(`${W}-${key}-2-select-detail`);
  const v0 = await V();
  await click(`${sSel(P.changed)}`, `지도 카드 ${P.changed}`);
  const v1 = await V(); cur.raw.firstSelect = { before: v0, after: v1 };
  await check('첫 선택: 선택만 바뀜(카드 bounds·선 경로·깊이·배율 동일)', JSON.stringify(v1.sel) === JSON.stringify([P.changed]) && boxDiff(v0.nodes, v1.nodes).length === 0 && v0.edges.every((e, i) => pathDiff(e.d, v1.edges[i].d) <= .5) && JSON.stringify(v0.depth) === JSON.stringify(v1.depth), { sel: v1.sel, boxes: boxDiff(v0.nodes, v1.nodes) });
  const n = nodeById(fx, P.changed);
  const short = await page.evaluate(() => ({ role: document.querySelector('#panel .role')?.textContent, chg: document.querySelector('#panel .chgnote')?.childNodes[1]?.textContent, chk: document.querySelector('#panel .chgnote .chgk')?.textContent, first: [...document.querySelectorAll('#panel .act .btn')].map(b => b.textContent), detail: !!document.getElementById('detail'), text: document.getElementById('panel').innerText }));
  cur.raw.short = short;
  await check('짧은 설명 먼저: 역할 = 입력 role, 변경 한 문장 = change.summary', short.role === n.role && short.chg === n.change.summary && short.chk === `이 기록에서 달라진 부분 · ${n.change.label}`, short);
  const evs = [...new Set([...n.change.evidence, ...n.evidence])].map(id => fx.evidence.find(e => e.id === id));
  await check('기본 설명에는 원문·확인 한계·관계 전체 조건이 아직 없음', !short.detail && !evs.some(e => e.limits && short.text.includes(e.limits)) && !relsTouching(fx, P.changed).some(r => short.text.includes(r.condition)), null);
  await check('다음 행동: 근거 읽기(주) + 내 다음 요청 준비', JSON.stringify(short.first) === JSON.stringify(['근거·전체 조건 읽기', '내 다음 요청 준비']), short.first);
  for (const s of ['#panel .role', '#panel .chgnote', '#panel [data-act="detail"]']) await seen(s, `짧은 설명 ${s}`, scrollBox());
  await click('#panel [data-act="detail"]', '근거·전체 조건 읽기', scrollBox());
  const det = await page.evaluate(() => { const d = document.getElementById('detail'); if (!d) return null; return {
    ba: [...d.querySelectorAll('.ba > div')].map(x => x.childNodes[1]?.textContent), basis: d.querySelector('.muted')?.textContent,
    rc: [...d.querySelectorAll('.rc')].map(x => x.querySelectorAll('p')[1].textContent),
    ev: [...d.querySelectorAll('.evb')].map(x => ({ id: x.dataset.ev, type: x.querySelector('.evt').textContent, sum: x.querySelector('p').textContent, quote: x.querySelector('pre')?.textContent ?? null, quoteOpen: !!x.querySelector('details[open]'), lim: x.querySelector('.lim')?.childNodes[1]?.textContent.trim(), href: x.querySelector('.src a').getAttribute('href') })) }; });
  cur.raw.detail = det;
  await check('근거 상세: 전/후·비교 기준 = 입력', det && det.ba[0] === n.change.before && det.ba[1] === n.change.after && det.basis === `비교 기준 · ${n.change.basis}`, det && { ba: det.ba, basis: det.basis });
  await check('근거 상세: 관계 전체 조건 = 입력(해당 부분 관계 전부)', det && JSON.stringify(det.rc) === JSON.stringify(relsTouching(fx, P.changed).map(r => r.condition)), det && det.rc);
  await check('근거 상세: 근거 기록(종류·요약·정확 원문·확인 한계·고정 링크) = 입력', det && JSON.stringify(det.ev.map(e => [e.id, e.type, e.sum, e.quote, e.lim, e.href])) === JSON.stringify(evs.map(e => [e.id, e.type, e.summary, e.quote || null, e.limits, e.source.url])), det && det.ev.map(e => e.id));
  await check('정확 원문은 접힌 채(필요할 때 펼침)', det && det.ev.every(e => !e.quoteOpen), null);
  const firstQ = evs.findIndex(e => e.quote);
  if (firstQ >= 0) {
    await click(`#detail .evb:nth-of-type(${firstQ + 1}) .quote summary`, '정확 원문 펼치기', scrollBox());
    await check('정확 원문 펼침', await page.evaluate(i => !!document.querySelectorAll('#detail .evb')[i].querySelector('details[open]'), firstQ), null);
  }
  await seen('#detail .xhd', '근거 머리·닫기', scrollBox());
  if (PNG && W === 1440) { await wheelTo('#detail .ba', scrollBox()); await shot(`${W}-${key}-detail`); }
  await click('#detail [data-act="ref-close"]', '근거 닫기 버튼', scrollBox());
  v = await V(); let gone = await page.evaluate(lim => ({ dom: !!document.getElementById('detail'), txt: !!lim && document.getElementById('panel').innerText.includes(lim) }), evs[0].limits);
  await check('근거 닫기: DOM 제거·글자 부재·초점 호출 버튼·선택 유지', !gone.dom && !gone.txt && /\[data-act=detail\]/.test(v.active) && JSON.stringify(v.sel) === JSON.stringify([P.changed]), { gone, active: v.active, sel: v.sel });
  await click('#panel [data-act="detail"]', '근거 다시 열기', scrollBox());
  await page.keyboard.press('Escape'); await page.waitForTimeout(150); v = await V();
  await check('Escape: 근거 DOM 제거·초점 호출 버튼', !v.detailOpen && /\[data-act=detail\]/.test(v.active), { open: v.detailOpen, active: v.active });
  cur.complete = true;

  begin(`${W}-${key}-3-relation`);
  if (P.relNode !== P.changed) await click(sSel(P.relNode), `지도 카드 ${P.relNode}`, '#mapScroll');
  const r = fx.relations.find(x => x.id === P.rel);
  await click(`#panel .xbtn[data-xref="${P.rel}"]`, `관계 참고 ${P.rel}`, scrollBox());
  const x = await page.evaluate(() => { const d = document.getElementById('xref'); return d && { flow: d.querySelector('.xflow').innerText, kind: d.querySelector('.xkind').textContent, cond: d.querySelector('.xcond').textContent, where: [...d.querySelectorAll('.xwh li')].map(l => l.innerText), meta: d.querySelector('.xmeta').innerText }; });
  cur.raw.xref = x;
  await check('관계 참고: 실제 양끝·방향·종류·전체 조건 = 입력', x && ns(x.flow) === ns(`${nodeById(fx, r.from).name}→${nodeById(fx, r.to).name}`) && x.kind === `관계: ${r.kind}` && x.cond === r.condition, x);
  await check('관계 참고: 근거 링크가 입력 근거', x && r.evidence.every(id => x.meta.includes(fx.evidence.find(e => e.id === id).source.label)), x && x.meta);
  await seen('#xref .xcond', '관계 참고 조건', scrollBox());
  await click('#xref [data-act="ref-close"]', '참고 닫기', scrollBox());
  v = await V(); await check('참고 닫기: DOM 제거·초점 그 항목', !v.xrefOpen && new RegExp(`xbtn\\[data-xref=${P.rel}\\]`).test(v.active), { open: v.xrefOpen, active: v.active });
  await click(`#panel .xbtn[data-xref="${P.rel}"]`, `관계 참고 다시 ${P.rel}`, scrollBox());
  await click('#xref [data-mv]', '명시 이동(다른 대상)', scrollBox());
  v = await V();
  const mt = nodeById(fx, P.moveTo);
  await check(`명시 이동: ${P.moveTo} 선택(필요하면 부모만 펼침), 참고 닫힘`, JSON.stringify(v.sel) === JSON.stringify([P.moveTo]) && v.panelH2 === mt.name && !v.xrefOpen && (mt.parent === null || v.depth[mt.parent] === 1), { sel: v.sel, h2: v.panelH2, depth: v.depth });
  cur.complete = true;

  begin(`${W}-${key}-4-draft`);
  if (P.depthToggle) await click(`${sNode(P.depthToggle)} .gtog`, `깊이 바꾸기 ${P.depthToggle}`, '#mapScroll');
  // 확대: 지도가 움직일 여지가 생길 때까지(최대 2단계, 115%→130%) 실제 버튼을 누른다
  await click('#zIn', '확대');
  v = await V();
  if (v.map.sw <= v.map.cw && v.map.sh <= v.map.ch) { await click('#zIn', '확대(2단계)'); v = await V(); }
  const ext = { x: v.map.sw - v.map.cw, y: v.map.sh - v.map.ch }; cur.raw.mapExtent = ext; cur.raw.zoomLabel = v.scale.label;
  if (ext.x > 0 || ext.y > 0) { const c = await PT('#mapScroll'); await page.mouse.move(c.x, c.y); await page.mouse.wheel(Math.min(70, Math.max(0, ext.x)), Math.min(50, Math.max(0, ext.y))); R.wheels++; await page.waitForTimeout(300); }
  v = await V(); await check('비초기 보기: 확대(115% 또는 130%)·지도 실제 휠 이동(여지 있는 축만, 없으면 extent 기록)', ['115%', '130%'].includes(v.scale.label) && (ext.x <= 0 || v.map.sl > 0) && (ext.y <= 0 || v.map.st > 0), { scale: v.scale.label, map: v.map, ext });
  await click(`#caseHead .chgchip[data-goto="${P.changed}"]`, `머리의 변경 칩 ${P.changed}`);
  await wheelTo('#panel [data-act="draft"]', scrollBox());
  const before = await V(); cur.raw.beforeDraft = before;
  await click('#panel [data-act="draft"]', '내 다음 요청 준비');
  let d = await page.evaluate(() => ({ open: !document.getElementById('draft').hidden, title: document.getElementById('draftTitle').textContent, val: document.getElementById('draftText').value, prev: document.getElementById('draftPreviewBtn').disabled, copy: document.getElementById('draftCopyBtn').disabled, refOpen: document.getElementById('draftRef').open, active: __t.desc(document.activeElement), note: document.querySelector('.savenote').textContent }));
  cur.raw.draftOpen = d;
  await check('초안 창: 대상 이름·빈 한 칸·미리보기/복사 비활성·참고 기록 접힘·입력에 초점', d.open && d.title === nodeById(fx, P.changed).name && d.val === '' && d.prev && d.copy && !d.refOpen && /#draftText/.test(d.active), d);
  await check('초안 창: 메모리 보존·미송신 안내', /메모리에만/.test(d.note) && /보내지 않으며/.test(d.note), d.note);
  const nf = await page.evaluate(() => document.querySelectorAll('#draft textarea, #draft input').length);
  await check('입력칸은 자유문 한 칸뿐(4칸 자동 채움 없음)', nf === 1, nf);
  await click('#draftRef summary', '참고 기록 펼치기');
  const ref = await txt('#draftRefBody');
  await check('참고 기록(읽기 전용): 대상·역할·달라진 부분', ref && ref.includes(nodeById(fx, P.changed).role) && ref.includes(nodeById(fx, P.changed).change.summary), ref && ref.slice(0, 200));
  await click('#draftText', '초안 입력칸');
  await page.keyboard.type(E[key]);
  d = await page.evaluate(() => ({ prev: document.getElementById('draftPreviewBtn').disabled, copy: document.getElementById('draftCopyBtn').disabled }));
  await check('입력 뒤 미리보기·복사 활성', !d.prev && !d.copy, d);
  await click('#draftPreviewBtn', '초안 미리보기');
  const pv = await txt('#draftPreview');
  await check('미리보기 = 대상 표시 + 입력 문장(다른 내용 자동 생성 없음)', pv && pv.endsWith(E[key]) && pv.includes(nodeById(fx, P.changed).name) && pv.split('\n').filter(Boolean).length === 2, pv);
  await click('#draftCopyBtn', '복사');
  const clip = await page.evaluate(async () => { try { return await navigator.clipboard.readText(); } catch (e) { return 'ERR ' + e.message; } });
  const st = await txt('#draftStatus');
  await check('복사: 클립보드 = 미리보기, 상태 ‘보내지는 않았습니다’', clip === pv && /보내지는 않았습니다/.test(st), { clip: clip && clip.slice(0, 80), st });
  const ta = await page.evaluate(() => { const t = document.getElementById('draftText'), r = t.getBoundingClientRect(); const h = document.elementFromPoint(r.left + 20, r.top + 14); return { v: t.value, inView: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth, hit: h === t, fpx: parseFloat(getComputedStyle(t).fontSize) }; });
  await check('초안 입력칸: 화면 안·가려지지 않음·글자 크기(텍스트영역은 Range 관측 대상이 아님)', ta.v === E[key] && ta.inView && ta.hit && ta.fpx >= 13, ta);
  if (PNG && W === 1280 && key === 'pt') await shot(`${W}-${key}-draft`);
  await click('#draftClose', '초안 닫기');
  const after = await V(); cur.raw.afterDraft = after;
  await sameView(before, after, '초안 닫은 직후(보조 이동 전)');
  await check('초안 닫기: 초점 호출 버튼', /\[data-act=draft\]/.test(after.active) && !after.draftOpen, after.active);
  // 다른 대상 격리
  await click(sSel(P.other), `다른 대상 ${P.other}`, '#mapScroll');
  await click('#panel [data-act="draft"]', `다른 대상 초안 ${P.other}`, scrollBox());
  d = await page.evaluate(() => ({ title: document.getElementById('draftTitle').textContent, val: document.getElementById('draftText').value }));
  await check('다른 대상 초안은 비어 있음(격리)', d.title === nodeById(fx, P.other).name && d.val === '', d);
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  v = await V(); await check('Escape로 초안 닫힘·초점 호출 버튼', !v.draftOpen && /\[data-act=draft\]/.test(v.active), v.active);
  await click(`#caseHead .chgchip[data-goto="${P.changed}"]`, `변경 칩 ${P.changed}(재)`);
  await click('#panel [data-act="draft"]', '원래 대상 초안 재열기', scrollBox());
  d = await page.evaluate(() => document.getElementById('draftText').value);
  await check('원래 대상 초안 보존', d === E[key], d);
  await click('#draftClose', '초안 닫기(2)');
  // 사례 전환 직전 상태: 근거 상세를 연 채로 둔다
  await click('#panel [data-act="detail"]', '근거 열어 둔 채 전환 준비', scrollBox());
  cur.raw.leaveView = await V();
  cur.complete = true;
  return cur.raw.leaveView;
}

async function selectCase(idx, label) { await page.selectOption('#caseSel', String(idx)); R.selectOptionCalls++; await page.waitForTimeout(250); log(`  사례 전환 → ${label}`); }

let crash = null;
try {
  if (MODE === 'pc-1280' || MODE === 'pc-1440') {
    const W = MODE === 'pc-1280' ? 1280 : 1440, H = W === 1280 ? 720 : 900;
    begin(`${W}-0-load`); await open(W, H);
    const rec = cur.raw.received || [];
    const want = ['index.html', 'engine.js', 'style.css', 'fixtures/flow091.json', 'fixtures/powertoys.json'];
    await check('HTTP 수령 = 디스크 파일(bytes/SHA)', want.every(f => { const g = rec.find(x => x.path === f); return g && g.status === 200 && g.sha256 === R.sourceBefore[f].sha256 && g.bytes === R.sourceBefore[f].bytes; }), rec);
    cur.complete = true;
    const leaveFlow = await caseFlow('flow', W);
    begin(`${W}-5-switch`);
    await selectCase(1, 'PowerToys');
    let v = await V();
    await check('전환: 열린 근거가 닫히고(DOM 없음) 새 사례 제목·무선택', !v.detailOpen && !v.xrefOpen && !v.draftOpen && v.title === FX.pt.title && v.sel.length === 0, { detail: v.detailOpen, title: v.title, sel: v.sel });
    const leak = await page.evaluate(() => ['#caseHead', '#world', '#panel', '#legend'].map(s => document.querySelector(s).innerText).join('\n'));
    const flowOnly = ['작업문과 미리보기', '배경 블록', 'FLOW091-C', '요청 사본', FX.flow.title];
    await check('전환: 머리·지도·설명에 이전 사례 문구 없음', flowOnly.every(w => !leak.includes(w)), flowOnly.filter(w => leak.includes(w)));
    cur.complete = true;
    const leavePt = await caseFlow('pt', W);
    begin(`${W}-6-switch-back`);
    await selectCase(0, 'FLOW091');
    v = await V(); cur.raw.flowBack = v;
    await sameView({ ...leaveFlow }, v, '전환 왕복 뒤 FLOW091 보기 복원', { ignorePanel: true });
    await check('되돌아와도 근거 상세는 닫혀 있음(열린 상세는 전환 때 닫음)', !v.detailOpen, v.detailOpen);
    await click('#panel [data-act="draft"]', 'FLOW091 C32 초안', scrollBox());
    let d = await page.evaluate(() => document.getElementById('draftText').value);
    await check('FLOW091 초안 보존·PowerToys 초안과 섞이지 않음', d === E.flow, d);
    await click('#draftClose', '초안 닫기');
    await selectCase(1, 'PowerToys');
    v = await V(); await sameView({ ...leavePt }, v, '전환 왕복 뒤 PowerToys 보기 복원', { ignorePanel: true });
    await click('#panel [data-act="draft"]', 'PowerToys SR 초안', scrollBox());
    d = await page.evaluate(() => document.getElementById('draftText').value);
    await check('PowerToys 초안 보존', d === E.pt, d);
    await click('#draftClose', '초안 닫기');
    if (PNG && W === 1440) { await selectCase(0, 'FLOW091'); }
    cur.complete = true;
  } else if (MODE === 'smoke-390') {
    for (const [idx, key] of [[0, 'flow'], [1, 'pt']]) {
      begin(`390-${key}-smoke`); await open(390, 844);
      if (idx) await selectCase(idx, key);
      const fx = PROFILE[key].fx, P = PROFILE[key];
      const ov = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, mainSw: document.getElementById('main').scrollWidth, mainCw: document.getElementById('main').clientWidth }));
      await check('가로 넘침 없음(문서·main)', ov.sw <= ov.iw && ov.mainSw <= ov.mainCw, ov);
      await seen('#caseHead h1', '제목');
      await click(`#caseHead .chgchip[data-goto="${P.changed}"]`, '변경 칩', '#main');
      await click('#panel [data-act="detail"]', '근거 열기', '#main');
      const ov2 = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, mainSw: document.getElementById('main').scrollWidth, mainCw: document.getElementById('main').clientWidth }));
      await check('근거 연 상태 가로 넘침 없음', ov2.sw <= ov2.iw && ov2.mainSw <= ov2.mainCw, ov2);
      await click('#detail [data-act="ref-close"]', '근거 닫기', '#main');
      let v = await V(); await check('근거 닫힘(DOM 제거)·초점 호출 버튼', !v.detailOpen && /\[data-act=detail\]/.test(v.active), v.active);
      await click('#panel [data-act="draft"]', '초안 열기', '#main');
      const box = await page.evaluate(() => __t.rr(document.querySelector('.modalbox').getBoundingClientRect()));
      await check('초안 창이 화면 안', box.x >= 0 && box.y >= 0 && box.x + box.w <= 390.5 && box.y + box.h <= 844.5, box);
      await seen('#draftClose', '초안 닫기 버튼');
      await click('#draftClose', '초안 닫기');
      v = await V(); await check('초안 닫힘·초점 호출 버튼', !v.draftOpen && /\[data-act=draft\]/.test(v.active), v.active);
      if (PNG && key === 'pt') { await shot('390-pt-smoke'); }
      cur.complete = true;
    }
  } else if (MODE === 'temp-inputs') {
    begin('tmp-renamed-leak'); await open(1280, 720, '?fixtures=fixtures/flow091.json,tests/fixtures-tmp/renamed.json');
    const RN = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures-tmp/renamed.json'), 'utf8'));
    await click(sSel('C32'), 'FLOW091 C32');
    await click('#panel [data-act="draft"]', 'FLOW091 C32 초안', scrollBox());
    await click('#draftText', '입력'); await page.keyboard.type('E1 원래 사례'); await click('#draftClose', '닫기');
    await selectCase(1, '재명명 임시 입력');
    let v = await V();
    await check('재명명 입력: 같은 화면으로 열림·제목은 임시 입력', v.title === RN.title, v.title);
    await click(sSel('C32'), '재명명 입력의 C32(=PowerToys 키 검색·선택)');
    const p = await page.evaluate(() => ({ h2: document.querySelector('#panel h2').textContent, role: document.querySelector('#panel .role').textContent, chg: document.querySelector('#panel .chgnote')?.childNodes[1]?.textContent }));
    const sr = FX.pt.nodes.find(n => n.id === 'SR');
    await check('재명명 입력의 C32는 PowerToys 의미(이름·역할·변경)로만 표시', p.h2 === sr.name && p.role === sr.role && p.chg === sr.change.summary, p);
    const body = await page.evaluate(() => ['#caseHead', '#world', '#panel', '#legend'].map(s => document.querySelector(s).innerText).join('\n'));
    const flowOnly = ['작업문과 미리보기', '배경 블록', 'FLOW091-C', '요청 사본'];
    await check('재명명 입력 화면에 FLOW091 문구 없음(ID가 같아도 하드코딩 없음)', flowOnly.every(w => !body.includes(w)), flowOnly.filter(w => body.includes(w)));
    await click('#panel [data-act="draft"]', '재명명 C32 초안', scrollBox());
    let d = await page.evaluate(() => document.getElementById('draftText').value);
    await check('같은 ID라도 다른 사례 초안은 비어 있음', d === '', d);
    await click('#draftText', '입력'); await page.keyboard.type('E2 임시 입력'); await click('#draftClose', '닫기');
    await selectCase(0, 'FLOW091');
    await click('#panel [data-act="draft"]', 'FLOW091 C32 초안(재)', scrollBox());
    d = await page.evaluate(() => document.getElementById('draftText').value);
    await check('A→B(같은 ID)→A: 원래 사례 초안 그대로', d === 'E1 원래 사례', d);
    await click('#draftClose', '닫기');
    await selectCase(1, '재명명');
    await click('#panel [data-act="draft"]', '재명명 C32 초안(재)', scrollBox());
    d = await page.evaluate(() => document.getElementById('draftText').value);
    await check('B로 돌아오면 B 초안 그대로', d === 'E2 임시 입력', d);
    await click('#draftClose', '닫기');
    cur.complete = true;

    begin('tmp-no-changes'); await open(1280, 720, '?fixtures=tests/fixtures-tmp/nochange.json');
    let dom = await page.evaluate(() => ({ strip: !!document.querySelector('.chgstrip'), chips: document.querySelectorAll('.kchg,.chgchip,.chgnote').length, chgCls: document.querySelectorAll('#world .chg').length, legend: document.getElementById('legend').innerText, head: document.getElementById('caseHead').innerText, panel: document.getElementById('panel').innerText, panelBtns: document.querySelectorAll('#panel .act .btn').length }));
    await check('change 없음: 머리 띠·칩·강조·범례 항목·빈 행 없음', !dom.strip && dom.chips === 0 && dom.chgCls === 0 && !/달라진/.test(dom.legend + dom.head + dom.panel) && dom.panelBtns === 0, dom);
    await click(sSel('C32'), 'C32 선택');
    dom = await page.evaluate(() => ({ panel: document.getElementById('panel').innerText, chg: document.querySelectorAll('#panel .chgnote').length }));
    await check('change 없음: 선택 설명에 변경 행·‘미확인’ 같은 대체 문구 없음', dom.chg === 0 && !/달라진|미확인|미변경|승인 필요/.test(dom.panel), dom.panel.slice(0, 200));
    await click('#panel [data-act="detail"]', '근거 열기', scrollBox());
    dom = await page.evaluate(() => ({ t: document.getElementById('detail').innerText, ba: document.querySelectorAll('#detail .ba').length }));
    await check('change 없음: 상세에 전/후 행 없음, 역할·관계·근거는 그대로', dom.ba === 0 && !/달라진/.test(dom.t) && /역할/.test(dom.t) && /근거 기록/.test(dom.t), dom.t.slice(0, 200));
    cur.complete = true;

    begin('tmp-schema-errors'); await open(1280, 720, '?fixtures=tests/fixtures-tmp/err-dup.json,tests/fixtures-tmp/err-endpoint.json,tests/fixtures-tmp/err-cycle.json,tests/fixtures-tmp/err-depth.json');
    const expect = [/중복 node ID: SR/, /끝점 to NOPE가 없습니다/, /순환/, /지원하지 않는 깊이/];
    for (let i = 0; i < 4; i++) {
      if (i) await selectCase(i, 'err' + i);
      const e = await page.evaluate(() => ({ shown: !document.getElementById('inputErrors').hidden, text: document.getElementById('inputErrors').innerText, grp: document.querySelectorAll('#world .grp').length, opt: document.getElementById('caseSel').selectedOptions[0].textContent }));
      await check(`입력 오류 ${i}: 오류 표시·지도 미표시·선택기에 ‘입력 오류’`, e.shown && expect[i].test(e.text) && e.grp === 0 && /입력 오류/.test(e.opt), e);
    }
    cur.complete = true;
  } else if (MODE === 'static') {
    begin('static-no-case-branch');
    const code = fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
    const tokens = new Set();
    for (const fx of [FX.flow, FX.pt]) { tokens.add(fx.caseId); for (const n of fx.nodes) { tokens.add(n.id); tokens.add(n.name); } for (const r of fx.relations) { tokens.add(r.id); tokens.add(r.kind); } for (const e of fx.evidence) tokens.add(e.id); for (const n of fx.nodes) if (n.change) tokens.add(n.change.label); }
    for (const w of ['FLOW091', 'PowerToys', 'ManagedCommon', 'flow091', 'powertoys', '배경 사본', '작업문', '녹화', '검색']) tokens.add(w);
    const hits = [...tokens].filter(t => /[가-힣]/.test(t) ? code.includes(t) : new RegExp(`(^|[^A-Za-z0-9_])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Za-z0-9_]|$)`).test(code));
    cur.raw.tokens = [...tokens];
    await check('engine.js·style.css에 사례 ID·노드/관계/근거 ID·이름·사업 문구 없음', hits.length === 0, hits);
    cur.complete = true;
  }
} catch (e) { crash = String(e && e.stack || e); log('CRASH', crash); if (cur) cur.crash = crash; }
if (ctx) await ctx.close(); await browser.close(); server.close();
R.sourceAfter = srcHashes(); R.sourceUnchanged = JSON.stringify(R.sourceBefore) === JSON.stringify(R.sourceAfter);
R.finished = new Date().toISOString(); R.crash = crash;
const all = Object.values(R.scenarios).flatMap(s => s.assertions);
R.assertions = all.length; R.failed = all.filter(a => !a.pass).length; R.clickPreconditions = all.filter(a => /^클릭 지점|^휠로/.test(a.name)).length;
R.incompleteScenarios = Object.values(R.scenarios).filter(s => !s.complete).map(s => s.id);
const exit = crash ? 2 : (R.failed || R.consoleErrors.length || R.incompleteScenarios.length || !R.sourceUnchanged) ? 1 : 0;
R.exitCode = exit;
fs.writeFileSync(path.join(OUT, 'raw.json'), JSON.stringify(R, null, 1));
fs.writeFileSync(path.join(OUT, 'log.txt'), logLines.join('\n') + `\nscenarios=${Object.keys(R.scenarios).length} incomplete=${JSON.stringify(R.incompleteScenarios)} assertions=${R.assertions} (클릭·휠 전제 ${R.clickPreconditions}) failed=${R.failed} wheels=${R.wheels} selectOption=${R.selectOptionCalls} domScroll=0 consoleErrors=${R.consoleErrors.length} sourceUnchanged=${R.sourceUnchanged} exit=${exit}\n`);
process.exit(exit);
