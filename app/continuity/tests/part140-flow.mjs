// AF140 the full reading of a part over the map. Auxiliary Node Playwright flow (like reading123-flow.mjs), not part of CI:
//   node continuity/tests/part140-flow.mjs [shots-dir]        (from app/, after the continuity build)
// Real local app (studio-smoke-server, no key: nothing is sent). The project is author-written in the shape of the 139 engine map,
// never a model's reading (labelled '[스텁]'): an engine part with 13 current claims over four readings, the last read its limitations, an eval group with
// Parser, Compiler and VM (VM with 2 claims), relations with their notes.
//   L. The lens keeps its width; '전체 읽기' opens the reading surface over the map: title, path, a clear way back, every claim to
//      the last limitation at a paragraph's width, no clamp, no sideways scroll; the camera and the stored layout do not move.
//   B. Behind it the map is shown, not used: wheel, click, Shift+Tab and '/' do nothing there.
//   Q. A claim's original and back: the same surface, scroll and button; the history fold's quote: the fold open again, same button.
//   F. A relation followed from the surface, then Back: the same surface, scroll and camera; Esc to the lens with the camera, Esc out.
//   R. A late status re-renders the surface: the focused quote keeps focus; an edit field keeps its text, caret and selection.
//   N. 1000×700 and 700×800: the surface fits the window, its way back in view, no sideways scroll; reload: stores byte for byte.
//   T. Two history readings with the same time, quote, place and index: back to the second one's own button.
//   S. A slow description correction of A ends while B's own is being written: B's form, text and caret stay over a late status.
//   S2. The same part's correction closed and opened again while its first save waits: the new form, words and caret stay.
//   A. The question box after an answer: empty (as studio_browser.py main_flow:144 expects); a failed answer keeps the question.
//   W. The change plan's wide comparison keeps its own lock over the map (studio_browser.py:520); the reading lifts only its own.
//   H. History across the plan (Root's 134 CUA sequence, on the example converter): Back lays no part sheet over the open plan; after
//      '문장 고치기' (Enter) and Forward the wide comparison still covers the map.
//   (ONLY=followup: T, S, S2, A, W, H; ONLY=saves: S, S2; ONLY=reopen: S2; ONLY=ask: A; ONLY=edits: A, R, S, S2; ONLY=locks: W, H.)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url)), APP = fileURLToPath(new URL('../..', import.meta.url));
const SHOTS = process.argv[2] ?? null; if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const D = await import(`${ROOT}dist/public/shared/domain.js`), S = await import(`${ROOT}dist/public/shared/storage.js`);
const M = await import(`${ROOT}dist/public/shared/map-reading.js`), { studioView } = await import(`${ROOT}dist/public/shared/studio.js`);
const W = 'agentflow.idea015.workspace', PLANS = 'agentflow.studio.plans.1', MAIN = 'E_part140-aaaa-0001';
const CAMERA = () => document.getElementById('world').style.transform;

/* ---------- the project (author-written: part140-case.mjs) ---------- */
const { FEATURES, LIMITS, build, twins } = await import('./part140-case.mjs');
const X = build({ D, M, S, studioView });
const entry = (entryId, project) => ({ entryId, state: 'active', lifecycle: 1, seq: 1, createdAt: new Date().toISOString(), trashedAt: null, origin: 'new', project });
const seedOf = project => ({ [W]: JSON.stringify({ version: 'agentflow.workspace.1', migratedFromLegacy: false, entries: [entry(MAIN, project)] }) });
const SEED = seedOf(X.project), TW = twins({ D, M, S, studioView });

/* ---------- server, page ---------- */
function start() {
  const proc = spawn(process.execPath, [`${ROOT}tests/studio-smoke-server.mjs`], { cwd: APP, env: { ...process.env, STUDIO_STUB: 'nokey', PORT: '0' }, stdio: ['ignore', 'pipe', 'inherit'] });
  return new Promise((res, rej) => { proc.stdout.once('data', d => { const m = /READY (http:\/\/\S+)/.exec(String(d)); m ? res({ proc, base: m[1] }) : rej(new Error(String(d))); }); proc.once('exit', c => rej(new Error(`server exit ${c}`))); });
}
const results = [];
const ok = (name, detail = '') => { results.push(name); console.log(`ok - ${name}${detail ? ` · ${detail}` : ''}`); };
async function context(browser, base, size = [1280, 720], hold = false, seed = SEED) {
  const ctx = await browser.newContext({ viewport: { width: size[0], height: size[1] } });
  const page = await ctx.newPage(), errors = [], sent = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('request', r => { if (r.method() !== 'GET') sent.push(`${r.method()} ${r.url()}`); });
  let release = () => {};
  if (hold) { const gate = new Promise(r => { release = r; }); await page.route('**/api/studio/status', async route => { await gate; await route.continue(); }); }
  await page.goto(`${base}/`);
  await page.evaluate(x => { localStorage.clear(); sessionStorage.clear(); for (const [k, v] of Object.entries(x)) localStorage.setItem(k, v); }, seed);
  await page.evaluate(h => history.replaceState(null, '', h), `#/p/${MAIN}`); await page.reload();
  await page.locator('#world .node').first().waitFor();
  return { ctx, page, errors, sent, release };
}
const stores = page => page.evaluate(([a, b]) => [localStorage.getItem(a), localStorage.getItem(b)], [W, PLANS]);
const sideways = (page, sel) => page.evaluate(s => { const d = document.scrollingElement, b = document.querySelector(s); return [d.scrollWidth - d.clientWidth, b ? b.scrollWidth - b.clientWidth : null]; }, sel);
const focusKey = page => page.evaluate(() => document.activeElement?.dataset.claimFocus ?? document.activeElement?.dataset.far ?? document.activeElement?.id ?? null);
const surface = page => page.locator('#panel.reading:not([hidden])');
/** A leaf is a node; a part with parts inside is a frame whose head is what selects it. */
async function selectPart(page, id) {
  const node = page.locator(`#world .node[data-part="${id}"]`);
  await ((await node.count()) ? node.first() : page.locator(`#world .frame-head[data-part="${id}"] .frame-name`)).click();
  await page.locator('#lens .lens-more').waitFor();
}
async function openSurface(page) { await page.locator('#lens .lens-more').click(); await surface(page).waitFor(); await page.waitForTimeout(200); }

/* ---------- L, B ---------- */
async function wide(browser, base) {
  const { ctx, page, errors, sent } = await context(browser, base);
  const before = await stores(page);
  await selectPart(page, X.engine); await page.waitForTimeout(250);
  const lensW = await page.locator('#lens').evaluate(e => e.getBoundingClientRect().width), camera0 = await page.evaluate(CAMERA), url0 = page.url();
  assert.equal(await page.locator('#lens .lens-claims .claim').count(), 13, 'the lens reads every current claim too');
  await openSurface(page);
  const s = await page.evaluate(() => { const p = document.getElementById('panel'), r = p.getBoundingClientRect(), role = p.querySelector('.und-role'), claims = [...p.querySelectorAll('.sec-understood .claims .claim')];
    return { w: r.width, left: r.left, title: p.querySelector('#panel-title').textContent, path: p.querySelector('.panel-path').textContent, back: !!p.querySelector('.sheet-back'),
      text: role.getBoundingClientRect().width, claims: claims.map(c => c.querySelector('.cl-text').textContent), clamp: claims.some(c => getComputedStyle(c.querySelector('.cl-text')).webkitLineClamp !== 'none' || c.querySelector('.cl-text').scrollHeight > c.querySelector('.cl-text').clientHeight + 1),
      bodyH: p.querySelector('.panel-body').scrollHeight, bodyView: p.querySelector('.panel-body').clientHeight }; });
  assert.ok(lensW < 400, `the lens keeps its width (${lensW})`);
  assert.ok(s.w > 700 && s.text >= 640 && s.text <= 720, JSON.stringify(s));
  assert.equal(s.title, 'micro-javascript'); assert.equal(s.path, 'micro-javascript · 140'); assert.ok(s.back);
  // Every current claim, the limitation (read last: newest first) included, in its whole words.
  assert.equal(s.claims.length, 13, 'every current claim, none cut');
  // The claim a cut to 12 left out: the first reading's first (partUnderstanding orders newest first, so it was the 13th).
  assert.ok(s.claims.includes(`[스텁] ${FEATURES[0]}을(를) 지원 대상으로 설명한다`), 'the claim a cut to 12 left out'); assert.ok(s.claims.some(t => t === `[스텁] ${LIMITS.slice(4)}`), s.claims.join(' | '));
  assert.equal(s.clamp, false); assert.deepEqual(await sideways(page, '#panel .panel-body'), [0, 0]);
  assert.equal(await page.evaluate(CAMERA), camera0, 'opening the surface does not move the map'); assert.equal(page.url(), url0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/l-engine.png` });
  ok('L the lens keeps its width; the full reading over the map: title, path, way back, all 13 claims (the oldest and the limitation whole), no clamp', `lens ${Math.round(lensW)}px → surface ${Math.round(s.w)}px · text ${Math.round(s.text)}px · ${s.bodyH}px in ${s.bodyView}px · camera unchanged`);
  // B: the map at its left is shown, not used.
  assert.equal(await page.evaluate(() => document.getElementById('viewport').inert), true);
  const strip = { x: Math.max(40, s.left / 2), y: 360 };
  await page.mouse.move(strip.x, strip.y); await page.mouse.wheel(0, -400); await page.mouse.click(strip.x, strip.y); await page.waitForTimeout(200);
  assert.equal(await page.evaluate(CAMERA), camera0, 'no wheel zoom'); assert.equal(page.url(), url0, 'no selection change'); assert.equal(await surface(page).count(), 1);
  await page.locator('#panel .panel-path a, #panel .sheet-back').first().focus(); for (let i = 0; i < 6; i++) await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(() => !!document.activeElement?.closest('#viewport')), false, 'Shift+Tab never lands on a part under it');
  await page.locator('#panel-title').focus(); await page.keyboard.press('/'); await page.waitForTimeout(150);
  assert.equal(await page.locator('.find:not([hidden])').count(), 0, "'/' does not open find over it");
  assert.deepEqual(await stores(page), before); assert.deepEqual(sent, []); assert.deepEqual(errors, []);
  ok('B behind the surface: wheel, click, Shift+Tab and / do nothing to the map; nothing stored');
  // Q: a claim's original (the last limitation) and back; the history fold's quote and back.
  // That claim's own quote button (the one a cut to 12 left out).
  const body = page.locator('#panel .panel-body'), cite = page.locator('#panel .sec-understood .claims .claim', { hasText: FEATURES[0] }).locator('.cl-cite');
  await cite.scrollIntoViewIfNeeded(); await body.evaluate(e => { e.scrollTop += 60; }); await cite.scrollIntoViewIfNeeded(); await cite.focus();
  const key = await cite.getAttribute('data-claim-focus'), at = await body.evaluate(e => e.scrollTop);
  assert.ok(at > 0);
  await cite.click(); await page.locator('#lens .rr-mark').waitFor();
  assert.equal(await page.locator('#lens .rr-mark').textContent(), `지원: ${FEATURES[0]}을(를) 지원 대상으로 설명한다.`, 'its exact original line');
  await page.locator('#lens .rr-back').click(); await surface(page).waitFor();
  assert.equal(await focusKey(page), key); assert.ok(Math.abs(await body.evaluate(e => e.scrollTop) - at) <= 1);
  assert.equal(await page.evaluate(CAMERA), camera0);
  const hist = page.locator('#panel .und-history'); await hist.locator(':scope > summary').click();
  const hc = hist.locator('.cl-cite').first(); await hc.scrollIntoViewIfNeeded(); await hc.focus(); const hk = await hc.getAttribute('data-claim-focus'), hat = await body.evaluate(e => e.scrollTop);
  await hc.click(); await page.locator('#lens .rr-mark').waitFor(); await page.keyboard.press('Escape'); await surface(page).waitFor();
  assert.equal(await page.locator('#panel .und-history').getAttribute('open'), ''); assert.equal(await focusKey(page), hk);
  assert.ok(Math.abs(await body.evaluate(e => e.scrollTop) - hat) <= 1);
  assert.deepEqual(await stores(page), before); assert.deepEqual(errors, []);
  ok('Q originals and back: the same surface, scroll and quote; the history fold open again with its quote focused');
  await ctx.close();
}

/* ---------- F: relation and back, Esc ---------- */
async function follow(browser, base) {
  const { ctx, page, errors, sent } = await context(browser, base);
  const before = await stores(page);
  await selectPart(page, X.vm); await page.waitForTimeout(250); const lensCam = await page.evaluate(CAMERA);
  await openSurface(page);
  assert.equal(await page.locator('#panel .sec-understood .claims .claim').count(), 2);
  const body = page.locator('#panel .panel-body'), link = page.locator(`#panel .links a[data-far="${X.evalId}"]`);
  await link.scrollIntoViewIfNeeded(); const at = await body.evaluate(e => e.scrollTop), cam = await page.evaluate(CAMERA), url0 = page.url();
  await link.click(); await page.waitForTimeout(400);
  assert.notEqual(page.url(), url0);
  await page.goBack(); await surface(page).waitFor(); await page.waitForTimeout(300);
  assert.equal(page.url(), url0); assert.equal(await page.evaluate(CAMERA), cam, 'the camera as it was');
  assert.ok(Math.abs(await body.evaluate(e => e.scrollTop) - at) <= 1, 'the same scroll');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/f-vm.png` });
  await page.keyboard.press('Escape'); await page.waitForTimeout(250);
  assert.equal(await surface(page).count(), 0); assert.equal(await page.locator('#lens:not([hidden]) .lens-more').count(), 1, 'back to the lens');
  assert.equal(await page.evaluate(CAMERA), lensCam); assert.equal(await page.evaluate(() => document.getElementById('viewport').inert), false, 'the map is used again');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200); assert.equal(await page.locator('#lens:not([hidden])').count(), 0);
  assert.deepEqual(await stores(page), before); assert.deepEqual(sent, []); assert.deepEqual(errors, []);
  ok('F VM: 2 claims; a relation followed and Back: same surface, scroll, camera; Esc to the lens (camera kept, map usable), Esc out');
  await ctx.close();
}

/* ---------- R: a late status re-renders the surface ---------- */
async function late(browser, base) {
  const { ctx, page, errors, release } = await context(browser, base, [1280, 720], true);
  await selectPart(page, X.engine); await openSurface(page);
  const cite = page.locator('#panel .sec-understood .claims .cl-cite').nth(5); await cite.scrollIntoViewIfNeeded(); await cite.focus();
  const key = await cite.getAttribute('data-claim-focus'), body = page.locator('#panel .panel-body'), at = await body.evaluate(e => e.scrollTop);
  await page.locator('#panel .panel-body').evaluate(e => { e.dataset.old = '1'; });
  release(); await page.waitForFunction(() => document.getElementById('ai-pill')?.dataset.state !== 'checking'); await page.waitForTimeout(250);
  assert.equal(await page.locator('#panel .panel-body[data-old]').count(), 0, 're-rendered');
  assert.equal(await focusKey(page), key); assert.ok(Math.abs(await body.evaluate(e => e.scrollTop) - at) <= 1);
  await ctx.close();
  // An edit field keeps its text, caret and selection over the same re-render.
  const b = await context(browser, base, [1280, 720], true);
  await selectPart(b.page, X.engine); await openSurface(b.page);
  await b.page.locator('#panel .more summary').click(); await b.page.getByRole('menuitem', { name: '이름·설명 고치기' }).click();
  const note = b.page.locator('#edit-note'); await note.fill('아직 저장하지 않은 설명 초안입니다.'); await note.evaluate(e => { e.setSelectionRange(3, 9, 'backward'); });
  b.release(); await b.page.waitForFunction(() => document.getElementById('ai-pill')?.dataset.state !== 'checking'); await b.page.waitForTimeout(250);
  const st = await b.page.evaluate(() => { const e = document.activeElement; return { id: e.id, v: e.value, s: e.selectionStart, t: e.selectionEnd, d: e.selectionDirection }; });
  assert.deepEqual(st, { id: 'edit-note', v: '아직 저장하지 않은 설명 초안입니다.', s: 3, t: 9, d: 'backward' });
  assert.deepEqual(errors, []); assert.deepEqual(b.errors, []);
  ok('R a late status re-renders the surface: the focused quote and scroll stay; an edit field keeps text, caret and selection');
  await b.ctx.close();
}

/* ---------- N: narrower windows; reload ---------- */
async function narrow(browser, base) {
  for (const size of [[1000, 700], [700, 800]]) {
    const { ctx, page, errors, sent } = await context(browser, base, size);
    const before = await stores(page);
    await selectPart(page, X.engine); await openSurface(page);
    const m = await page.evaluate(() => { const p = document.getElementById('panel').getBoundingClientRect(), b = document.querySelector('#panel .sheet-back').getBoundingClientRect(), x = document.querySelector('#panel .close').getBoundingClientRect();
      return { right: Math.round(p.right), width: Math.round(p.width), back: b.right <= innerWidth && b.width > 0, close: x.right <= innerWidth, text: Math.round(document.querySelector('#panel .und-role').getBoundingClientRect().width) }; });
    assert.ok(m.back && m.close && m.right <= size[0], JSON.stringify(m)); assert.deepEqual(await sideways(page, '#panel .panel-body'), [0, 0]);
    assert.equal(await page.locator('#panel .sec-understood .claims .claim').count(), 13);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/n-${size[0]}.png` });
    await page.locator('#panel .sheet-back').click(); await page.waitForTimeout(200); assert.equal(await surface(page).count(), 0);
    await page.reload(); await page.locator('#world .node').first().waitFor(); await page.waitForTimeout(200);
    assert.deepEqual(await stores(page), before, 'reading, closing and reloading store nothing');
    assert.deepEqual(sent, []); assert.deepEqual(errors, []);
    ok(`N ${size[0]}×${size[1]}: the surface fits, its ways back in view, all claims, no sideways scroll; reload: stores byte for byte`, `surface ${m.width}px · text ${m.text}px`);
    await ctx.close();
  }
}

/* ---------- T: two readings with the same time and the same quote: back to the second one's own button ---------- */
async function twinHistory(browser, base) {
  const { ctx, page, errors, sent } = await context(browser, base, [1280, 720], false, seedOf(TW.project));
  await selectPart(page, TW.part); await openSurface(page);
  const hist = page.locator('#panel .und-history'); await hist.locator(':scope > summary').click();
  const cites = hist.locator('.cl-cite'); assert.equal(await cites.count(), 2);
  const keys = await cites.evaluateAll(b => b.map(x => x.dataset.claimFocus)); assert.notEqual(keys[0], keys[1], 'two buttons, two identities');
  assert.deepEqual(await hist.locator('.uh-at').allTextContents().then(t => new Set(t).size), 1, 'the same time');
  await cites.nth(1).focus(); await cites.nth(1).click(); await page.locator('#lens .rr-mark').waitFor();
  assert.equal(await page.locator('#lens .rr-mark').textContent(), '검사에 실패하면 저장하지 않는다.');
  await page.keyboard.press('Escape'); await surface(page).waitFor();
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('#panel .und-history .cl-cite')].indexOf(document.activeElement)), 1, 'the second button, not the first');
  assert.equal(await page.locator('#panel .und-history').getAttribute('open'), '');
  assert.deepEqual(sent, []); assert.deepEqual(errors, []);
  ok('T two history readings with the same time, quote, place and index: back to the second one\'s own button (its reading id)');
  await ctx.close();
}

/* ---------- S: a slow description correction of A, B's own correction begun meanwhile ---------- */
async function slowSave(browser, base) {
  const { ctx, page, errors, sent, release } = await context(browser, base, [1280, 720], true);
  await selectPart(page, X.engine); await openSurface(page);
  await page.locator('#panel .sec-understood').getByRole('button', { name: '설명 바로잡기' }).click();
  await page.locator('#fix-role').fill('[스텁] A의 바로잡은 설명');
  // The save waits on the workspace lock (held here), as a slow storage would make it.
  await page.evaluate(() => { window.__hold = new Promise(r => { window.__open = r; }); navigator.locks.request('agentflow.idea015.workspace', () => window.__hold); });
  await page.locator('#panel .sec-understood').getByRole('button', { name: '저장' }).click(); await page.waitForTimeout(200);
  // B: the eval part, from the surface's own inside link; its own correction begun.
  await page.locator(`#panel .kids a`).first().click(); await page.locator('#lens .lens-more').waitFor(); await openSurface(page);
  assert.equal(await page.locator('#panel-title').textContent(), 'eval');
  await page.locator('#panel .sec-understood').getByRole('button', { name: '설명 바로잡기' }).click();
  const fix = page.locator('#fix-role'); await fix.fill('[스텁] B의 아직 저장하지 않은 설명'); await fix.evaluate(e => e.setSelectionRange(5, 12, 'backward'));
  // A's save ends, then a late status re-renders the surface.
  await page.evaluate(() => window.__open()); await page.waitForFunction(k => JSON.parse(localStorage.getItem(k)).entries[0].project.readings.some(r => r.version === 'map-correction.1'), W);
  release(); await page.waitForFunction(() => document.getElementById('ai-pill')?.dataset.state !== 'checking'); await page.waitForTimeout(250);
  const st = await page.evaluate(() => { const e = document.getElementById('fix-role'); return e ? { here: document.activeElement === e, v: e.value, s: e.selectionStart, t: e.selectionEnd, d: e.selectionDirection } : null; });
  assert.deepEqual(st, { here: true, v: '[스텁] B의 아직 저장하지 않은 설명', s: 5, t: 12, d: 'backward' }, 'B\'s correction stays open with its text and caret');
  const saved = await page.evaluate(k => JSON.parse(localStorage.getItem(k)).entries[0].project.readings.filter(r => r.version === 'map-correction.1').map(r => r.text), W);
  assert.deepEqual(saved, ['[스텁] A의 바로잡은 설명'], 'only A\'s correction was saved');
  assert.deepEqual(sent, []); assert.deepEqual(errors, []);
  ok('S A\'s slow correction ends while B\'s is being written: B\'s form, text and caret stay over a late status; only A saved');
  await ctx.close();
}

/* ---------- S2: A's slow save, its form closed and A's correction opened again with new words ---------- */
async function reopened(browser, base) {
  const { ctx, page, errors, sent, release } = await context(browser, base, [1280, 720], true);
  await selectPart(page, X.engine); await openSurface(page);
  const sec = page.locator('#panel .sec-understood');
  await sec.getByRole('button', { name: '설명 바로잡기' }).click(); await page.locator('#fix-role').fill('[스텁] A의 먼저 저장한 설명');
  await page.evaluate(() => { window.__hold = new Promise(r => { window.__open = r; }); navigator.locks.request('agentflow.idea015.workspace', () => window.__hold); });
  await sec.getByRole('button', { name: '저장' }).click(); await page.waitForTimeout(200);
  // While that save waits: the form is cancelled, then the same part's correction is opened again and new words written.
  await sec.getByRole('button', { name: '취소' }).click(); assert.equal(await page.locator('#fix-role').count(), 0);
  await sec.getByRole('button', { name: '설명 바로잡기' }).click();
  const fix = page.locator('#fix-role'); await fix.fill('[스텁] A의 다시 연 새 설명'); await fix.evaluate(e => e.setSelectionRange(4, 9, 'backward'));
  const state = () => page.evaluate(() => { const e = document.getElementById('fix-role'); return e ? { here: document.activeElement === e, v: e.value, s: e.selectionStart, t: e.selectionEnd, d: e.selectionDirection } : null; });
  const want = { here: true, v: '[스텁] A의 다시 연 새 설명', s: 4, t: 9, d: 'backward' };
  // The old save ends (its own re-render of A, select), then a late status re-renders again.
  await page.evaluate(() => window.__open()); await page.waitForFunction(k => JSON.parse(localStorage.getItem(k)).entries[0].project.readings.some(r => r.version === 'map-correction.1'), W);
  await page.waitForTimeout(250); assert.deepEqual(await state(), want, 'after the old save\'s re-render');
  release(); await page.waitForFunction(() => document.getElementById('ai-pill')?.dataset.state !== 'checking'); await page.waitForTimeout(250);
  assert.deepEqual(await state(), want, 'after the late status too');
  const saved = await page.evaluate(k => JSON.parse(localStorage.getItem(k)).entries[0].project.readings.filter(r => r.version === 'map-correction.1').map(r => r.text), W);
  assert.deepEqual(saved, ['[스텁] A의 먼저 저장한 설명'], 'only the first session was saved');
  assert.deepEqual(sent, []); assert.deepEqual(errors, []);
  ok('S2 the same part\'s correction opened again while its first save waits: the new form, words and caret stay over that save and a late status');
  await ctx.close();
}

/* ---------- W: the change plan's wide comparison keeps its own lock over the map; the full reading takes and lifts only its own ---------- */
async function locks(browser, base) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }), page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  const inert = () => page.evaluate(() => Object.fromEntries(['#lens', '#plan-strip', '#viewport', '#space > .controls'].map(s => [s, !!document.querySelector(s)?.inert])));
  const all = v => ({ '#lens': v, '#plan-strip': v, '#viewport': v, '#space > .controls': v });
  try {
    await page.goto(`${base}/#/p/ex-converter`); await page.locator('#world .node').first().waitFor();
    await page.locator('#plan-entry').click(); await page.locator('#lens .ps-wide').click(); await page.locator('#plan-panel.work').waitFor();
    assert.deepEqual(await inert(), all(true), 'the wide comparison covers the map (studio_browser.py:520)');
    // Its own re-renders and a resize (each runs syncMapArea) keep that lock.
    await page.locator('.pw-pick').nth(1).click(); await page.setViewportSize({ width: 1200, height: 720 }); await page.setViewportSize({ width: 1280, height: 720 }); await page.waitForTimeout(200);
    assert.deepEqual(await inert(), all(true), 'still covered after its re-render and a resize');
    await page.locator('#pw-back').click(); await page.waitForTimeout(200);
    assert.equal(await page.locator('#plan-panel.work:not([hidden])').count(), 0);
    assert.equal((await inert())['#viewport'], false, 'back to the change map: the plan lifts its own lock');
    await page.keyboard.press('Escape'); await page.waitForTimeout(150); if (await page.evaluate(() => !document.getElementById('plan-strip').hidden)) { await page.keyboard.press('Escape'); await page.waitForTimeout(150); }
    // The full reading: its own lock, lifted on close (and nothing left marked).
    await page.locator('#world .node').first().click(); await page.locator('#lens .lens-more').click(); await page.locator('#panel.reading').waitFor();
    assert.equal((await inert())['#viewport'], true);
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    assert.deepEqual(await page.evaluate(() => [document.getElementById('viewport').inert, document.getElementById('viewport').dataset.readingInert ?? null]), [false, null]);
    assert.deepEqual(errors, []);
    ok('W the wide comparison keeps its lock over the map through its re-render and a resize, and lifts it itself; the reading lifts only its own');
  } finally { await ctx.close(); }
}

/* ---------- H: history across the plan (Root's 134 CUA sequence on the example converter): sheet A → relation B → change plan
   (map comparison) → Back → '문장 고치기' by Enter (the comparison opens wide) → Forward. The comparison keeps covering the map. ---------- */
async function historyLocks(browser, base) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }), page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  const state = () => page.evaluate(() => { const vp = document.getElementById('viewport'), c = document.querySelector('#space > .controls'), pp = document.getElementById('plan-panel'), panel = document.getElementById('panel');
    return { work: !pp.hidden && pp.classList.contains('work'), part: !panel.hidden, vp: vp.inert, controls: c.inert, mark: vp.dataset.readingInert ?? null }; });
  try {
    await page.goto(`${base}/#/p/ex-converter`); await page.locator('#world .node').first().waitFor();
    // A: the first part whose full reading names a relation; its sheet, then the relation to B.
    const ids = await page.locator('#world .node[data-part]').evaluateAll(n => n.map(x => x.dataset.part));
    let found = false;
    for (const id of ids) {
      await page.locator(`#world .node[data-part="${id}"]`).click(); await page.locator('#lens .lens-more').click(); await page.locator('#panel.reading').waitFor();
      if (await page.locator('#panel .links a[data-far]').count()) { found = true; break; }
      await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.waitForTimeout(100);
    }
    assert.ok(found, 'a part with a relation');
    await page.locator('#panel .links a[data-far]').first().click(); await page.waitForTimeout(300);
    await page.locator('#plan-entry').click(); await page.locator('#plan-strip:not([hidden])').waitFor(); await page.waitForTimeout(200);
    assert.equal((await state()).work, false, 'the change plan reads on the map (comparison, not wide)');
    await page.goBack(); await page.waitForTimeout(400);
    const back = await state();
    assert.equal(back.part, false, 'Back while the plan is open: no part sheet laid over the plan');
    await page.locator('#plan-strip').getByRole('button', { name: '문장 고치기' }).focus(); await page.keyboard.press('Enter');
    await page.locator('#plan-panel.work').waitFor(); await page.waitForTimeout(200);
    await page.goForward(); await page.waitForTimeout(400);
    const end = await state();
    assert.deepEqual({ work: end.work, vp: end.vp, controls: end.controls }, { work: true, vp: true, controls: true }, `the wide comparison still covers the map: ${JSON.stringify(end)}`);
    // Its own close lifts its lock (the reading left none).
    await page.locator('#pw-back').click(); await page.waitForTimeout(300);
    const closed = await state(); assert.equal(closed.work, false); assert.deepEqual([closed.vp, closed.mark], [false, null]);
    assert.deepEqual(errors, []);
    ok('H history across the plan: Back lays no part sheet over it; after Enter on 문장 고치기 and Forward the wide comparison still covers the map; its close lifts it', JSON.stringify(back));
  } finally { await ctx.close(); }
}

/* ---------- A: the question box after an answer (the same steps as studio_browser.py main_flow to its line 144; stub answers) ---------- */
async function askDraft(browser) {
  const serve = stub => new Promise((res, rej) => { const proc = spawn(process.execPath, [`${ROOT}tests/studio-smoke-server.mjs`], { cwd: APP, env: { ...process.env, STUDIO_STUB: stub, PORT: '0' }, stdio: ['ignore', 'pipe', 'inherit'] });
    proc.stdout.once('data', d => { const m = /READY (http:\/\/\S+)/.exec(String(d)); m ? res({ proc, base: m[1] }) : rej(new Error(String(d))); }); proc.once('exit', c => rej(new Error(`server exit ${c}`))); });
  const Q = '휴무일은 어디서 정해?';
  for (const stub of ['ok', 'fail']) {
    const { proc, base } = await serve(stub), ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }), page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    try {
      await page.goto(`${base}/`); await page.waitForFunction(() => document.getElementById('ai-text')?.textContent.includes('AI 정리'));
      await page.locator('.program-head[href="#/p/ex-salon"]').click(); await page.locator('.node', { hasText: '시간 고르기' }).click();
      await page.locator('#lens-title', { hasText: '시간 고르기' }).waitFor(); await page.locator('#lens .lens-more').click(); await page.locator('#panel-title', { hasText: '시간 고르기' }).waitFor();
      if (stub === 'ok') { await page.getByRole('button', { name: '지금 상황 정리' }).first().click(); await page.locator('.answer').first().waitFor(); }
      // A draft survives switching parts, then is sent with Enter.
      await page.locator('.ask-open').click(); await page.locator('#ask-input').fill(Q);
      await page.locator('.kid, .panel-path a').first().click(); await page.locator('#lens-title', { hasText: '예약하기' }).waitFor();
      await page.goBack(); await page.locator('#lens-title', { hasText: '시간 고르기' }).waitFor(); await page.locator('#lens .lens-more').click(); await page.locator('#panel-title', { hasText: '시간 고르기' }).waitFor();
      assert.equal(await page.locator('#ask-input').inputValue(), Q, 'the draft survived switching parts');
      await page.locator('#ask-input').press('Enter');
      if (stub === 'ok') {
        await page.waitForFunction(() => document.querySelectorAll('.answer').length === 2);
        await page.waitForFunction(() => document.getElementById('ask-input')?.value === '', null, { timeout: 5000 }).catch(() => {});
        assert.equal(await page.locator('#ask-input').inputValue(), '', 'answered: the question box is empty (studio_browser.py:144)');
        ok('A answered: the question box is empty, as main_flow expects (stub answer)');
      } else {
        await page.locator('#panel .failed').waitFor();
        assert.equal(await page.locator('#ask-input').inputValue(), Q, 'not answered: the question stays to send again');
        ok('A not answered (the stub fails): the question stays in the box');
      }
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); proc.kill(); }
  }
}

const { proc, base } = await start();
const browser = await chromium.launch();
try {
  if (!process.env.ONLY) { await wide(browser, base); await follow(browser, base); await late(browser, base); await narrow(browser, base); }
  if (process.env.ONLY === 'locks') { await locks(browser, base); await historyLocks(browser, base); }
  else if (process.env.ONLY === 'ask') await askDraft(browser);
  else if (process.env.ONLY === 'edits') { await askDraft(browser); await late(browser, base); await slowSave(browser, base); await reopened(browser, base); }
  else if (process.env.ONLY === 'reopen') await reopened(browser, base);
  else if (process.env.ONLY === 'saves') { await slowSave(browser, base); await reopened(browser, base); }
  else { await twinHistory(browser, base); await slowSave(browser, base); await reopened(browser, base); await askDraft(browser); await locks(browser, base); await historyLocks(browser, base); }
  console.log(`# ${results.length} checks passed`);
} finally { await browser.close(); proc.kill(); }
