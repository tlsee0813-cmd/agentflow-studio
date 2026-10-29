// AF123 first map entry after a late status, and the lens reading order. Auxiliary Node Playwright flow (like map97-flow.mjs):
//   node continuity/tests/reading123-flow.mjs [shots-dir]        (from app/, after the continuity build)
// Real local app and studio handler of studio-smoke-server (stubbed provider, no key). The server's status is held in the browser
// and answered with the shapes the real server sends (a key-less server, map-only jobs with a ready executor, a busy job store,
// an access code, no answer); nothing here is a model's reading and no AI call is made.
//   S. A project opened (and reloaded) before the status arrives: its empty map's entry offers '기록으로 지도 정리' only when the
//      status says a reading can start (the same mapRun.can/input/blocked as the return pane); nothing starts, applies or moves.
//      Arriving while another project is open, that project's paste draft, selection, focus and camera stay as they were.
//   L. The record76 Zephyr reel board excerpt (public text), read by a written reply shaped like 122's Power/Display: the lens
//      reads the description, then every current claim (the always-on limitation last, in full), then the relations with their
//      direction and stored notes; a claim's quote and a followed relation come back to the same button, scroll and camera.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url)), APP = fileURLToPath(new URL('../..', import.meta.url));
const SHOTS = process.argv[2] ?? null; if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const D = await import(`${ROOT}dist/public/shared/domain.js`), S = await import(`${ROOT}dist/public/shared/storage.js`);
const M = await import(`${ROOT}dist/public/shared/map-reading.js`), { studioView } = await import(`${ROOT}dist/public/shared/studio.js`);
const ZEPHYR = JSON.parse(readFileSync(new URL('./fixtures/record76/zephyr-reel-board.json', import.meta.url), 'utf8'));
const W = 'agentflow.idea015.workspace', A = 'E_read123-aaaa-0001', B = 'E_read123-bbbb-0002', Z = 'E_read123-zzzz-0003';
const CAMERA = () => document.getElementById('world').style.transform;

/* ---------- projects ---------- */
const fresh = (name, text) => D.pasteRecord(D.rename(D.createProject(), name), text, null).project;
// Stored before the paste box refused such text (parseProject still reads it): the reading's input is not sendable.
const leaky = () => JSON.parse(S.serializeProject(fresh('키가 있는 기록', '요구: 연결 키는 PLACEHOLDER 이다.')).replace('PLACEHOLDER', 'sk-abcdefghijklmnopqrstuvwx'));
const piece = (inp, words) => { const hit = inp.ask.records.flatMap(r => r.spans).find(x => x.t.includes(words)); assert.ok(hit, words); return hit.s; };
const span = (inp, a, b) => { const x = piece(inp, a), y = piece(inp, b); return x === y ? x : `${x}-${y.split('.')[1]}`; };
const LONG_NOTE = '[스텁] 공급 전압의 방향: 승압 변환기 TPS610981이 만든 전압이 전자잉크 화면으로 간다. 원문은 Active 모드에서 주변장치 전압이 켜지고 Low Power 모드에서는 nRF52840 전압만 켜진다고 적지만, 같은 절의 주석은 두 전압이 항상 켜져 있다고 말한다. 이 관계 설명은 세 줄을 넘는다.';
/** A first map of the Zephyr excerpt, by a written reply (labelled '[스텁]') in the shape of 122's: Power supply with three claims
 * whose last is the always-on limitation, and relations to the parts it supplies; the display's control from the SoC. */
function zephyr() {
  const p = fresh('zephyr-reel-board · 읽기 순서', ZEPHYR.doc), inp = M.buildMapAsk(p, studioView(p), [], undefined, M.MAP6_SCHEMA);
  const c = (key, text, at) => ({ kind: 'describes', text, at, about: null, replaces: null, key });
  const part = (ref, name, role, basis, claims = []) => ({ ref, name, parent: null, role, roleAbout: null, roleReplaces: null, basis: [basis], claims });
  const reply = { summary: '[스텁] reel board의 전원·화면·센서를 원문 순서로 정리한 자리예요.', candidates: [], gaps: [], matches: [], material: [],
    parts: [
      part('new:power', 'Power supply', '[스텁] 보드의 전원 공급원과 승압 변환기 모드를 정한다.', piece(inp, 'The board is optimized for low power'), [
        c('s1', '[스텁] 배터리와 마이크로 USB 전원을 지원하며 On/Off 스위치로 사용할 전원을 선택한다', span(inp, 'The board is optimized for low power', 'The On/Off switch')),
        c('s2', '[스텁] 변환기의 모드 정의상 Active는 SoC와 주변장치 전압을 켜고 Low Power는 SoC 전압만 켜며, MODE 핀 P1.00으로 모드를 제어한다', span(inp, 'reel board uses a TPS610981', 'The mode is controlled')),
        c('s3', '[스텁] 실제 동작에 관한 문서 주석은 두 전압이 항상 켜져 있어 Low Power 모드로 소비 전력을 줄일 수 없다고 명시하고 board.c를 참조한다', piece(inp, 'Actually there is no possibility'))]),
      part('new:soc', 'nRF52840', '[스텁] 보드의 SoC.', piece(inp, 'is a evaluation board based on the Nordic')),
      part('new:sensors', 'sensors', '[스텁] 환경 센서들.', piece(inp, 'ADPS9960 is a Digital Proximity')),
      part('new:display', 'Display', '[스텁] 전자잉크 화면.', piece(inp, 'GDEH0213B1 is the display'), [
        c('s4', '[스텁] B1(HINK-E0213, SSD1673)은 reel_board로, B72(HINK-E0213A22, SSD1675A)는 reel_board@2로 빌드한다', span(inp, '| Good Display | HINK-E0213 ', '| GDEH0213B72'))])],
    relations: [
      { from: 'new:power', to: 'new:soc', kind: 'flow', note: '[스텁] 승압 변환기가 nRF52840에 공급할 전압을 만든다.', at: piece(inp, 'reel board uses a TPS610981') },
      { from: 'new:power', to: 'new:sensors', kind: 'flow', note: '[스텁] 승압 변환기가 센서에 공급할 전압을 만든다.', at: piece(inp, 'reel board uses a TPS610981') },
      { from: 'new:power', to: 'new:display', kind: 'flow', note: LONG_NOTE, at: piece(inp, 'reel board uses a TPS610981') },
      { from: 'new:soc', to: 'new:display', kind: 'flow', note: '[스텁] nRF52840이 SPI와 GPIO 3개로 화면을 제어한다.', at: piece(inp, 'Display is controlled by the nRF52840') }] };
  const { project, created } = M.applyReading(p, inp, M.validateMapReply(reply, inp.ask), { id: 'R_read123_1', at: new Date().toISOString(), model: 'stub', prompt: 'm6-000000000000', hash: 'f'.repeat(64) });
  return { project: JSON.parse(S.serializeProject(project)), power: created[0], display: created[3], claims: reply.parts[0].claims.map(x => x.text) };
}
const entry = (entryId, project) => ({ entryId, state: 'active', lifecycle: 1, seq: 1, createdAt: new Date().toISOString(), trashedAt: null, origin: 'new', project });
const SEED = ([w, entries]) => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem(w, JSON.stringify({ version: 'agentflow.workspace.1', migratedFromLegacy: false, entries })); };
/** A reload straight into this place (the page read the workspace before it was seeded, so the address is set without a visit). */
const reloadAt = async (page, hash) => { await page.evaluate(x => history.replaceState(null, '', x), hash); await page.reload(); };

/* ---------- server and held status ---------- */
function start() {
  const proc = spawn(process.execPath, [`${ROOT}tests/studio-smoke-server.mjs`], { cwd: APP, env: { ...process.env, STUDIO_STUB: 'ok', PORT: '0' }, stdio: ['ignore', 'pipe', 'inherit'] });
  return new Promise((res, rej) => { proc.stdout.once('data', d => { const m = /READY (http:\/\/\S+)/.exec(String(d)); m ? res({ proc, base: m[1] }) : rej(new Error(String(d))); }); proc.once('exit', c => rej(new Error(`server exit ${c}`))); });
}
const deferred = () => { let open; const promise = new Promise(r => { open = r; }); return { promise, open }; };
/** Status bodies as the real server writes them (studio.mjs status; owned-cli112 for map-only jobs with an executor). */
function bodies(real) {
  const prompt = real.map.prompt, executor = state => ({ id: 'codex-cli-preview.102', model: 'fake-model-102', scope: 'first', state, problem: state === 'ready' ? null : 'EXECUTOR_UNAVAILABLE', policy: 'x' });
  return {
    keyless: { ai: 'off', model: null, access: 'open' },
    mapOnly: { ai: 'off', model: null, access: 'open', map: { model: 'fake-model-102', prompt, via: 'jobs' }, jobs: { version: 'map-job.1', durable: true, executor: executor('ready') } },
    executorDown: { ai: 'off', model: null, access: 'open', jobs: { version: 'map-job.1', durable: true, executor: executor('unavailable') } },
    storeBusy: { ...real, jobs: { version: 'map-job.1', durable: false, problem: 'STORE_BUSY' } },
    code: { ...real, access: 'code' },
    ready: real,
    unreachable: null
  };
}

const results = [];
const ok = (name, detail = '') => { results.push(name); console.log(`ok - ${name}${detail ? ` · ${detail}` : ''}`); };

async function context(browser, base, size = [1280, 720]) {
  const ctx = await browser.newContext({ viewport: { width: size[0], height: size[1] } });
  const page = await ctx.newPage(), errors = [], sent = [];
  page.on('pageerror', e => errors.push(String(e)));
  // Anything a reading would send or reserve (a map ask, a job submit, a digest): none of it may start by itself here.
  page.on('request', r => { if (/\/api\/studio\/(map|jobs|digest|ask)/.test(r.url()) || (r.method() === 'POST' && r.url().includes('/api/studio/'))) sent.push(`${r.method()} ${r.url()}`); });
  return { ctx, page, errors, sent };
}
/** The status request waits until released, then is answered with the body (or fails like a server that is not there). */
async function holdStatus(page, body) {
  const gate = deferred();
  await page.route('**/api/studio/status', async route => { await gate.promise; if (body) await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }); else await route.abort('connectionrefused'); });
  return gate;
}
const entryState = page => page.evaluate(() => {
  const box = document.getElementById('space-empty'), b = [...box.querySelectorAll('button')];
  return { hidden: box.hidden, run: !!box.querySelector('.se-run'), primary: b.filter(x => x.classList.contains('primary')).map(x => x.textContent), notes: [...box.querySelectorAll('p.fine')].map(x => x.textContent), focus: document.activeElement?.textContent ?? null, inBox: box.contains(document.activeElement) };
});
const settled = page => page.waitForFunction(() => document.getElementById('ai-pill')?.dataset.state !== 'checking').then(() => page.waitForTimeout(250));

/* ---------- S: a late status on a project's first map ---------- */
async function lateStatus(browser, base, name, body, want) {
  const { ctx, page, errors, sent } = await context(browser, base);
  await page.goto(`${base}/`);
  const project = name === 'unsuitable record' ? leaky() : fresh('첫 지도', '요구: 폴더 안의 문서를 한 번에 변환한다.\n작업 보고: 변환기는 문서마다 PDF 하나를 만든다.');
  await page.evaluate(SEED, [W, [entry(A, project)]]);
  const gate = await holdStatus(page, body);
  // Straight into the project by a reload: its empty map is drawn before the server has said anything.
  await reloadAt(page, `#/p/${A}`);
  await page.locator('#space-empty .se-direct').waitFor();
  const before = await entryState(page);
  assert.equal(before.run, false, `${name}: no way to start before the status`);
  assert.deepEqual(before.primary, ['기록 붙여넣기'], `${name}: pasting is the first way in before the status`);
  await page.locator('#space-empty .se-direct').focus();
  const url0 = page.url(), camera0 = await page.evaluate(CAMERA);
  gate.open(); await settled(page);
  const after = await entryState(page);
  assert.equal(after.run, want.run, `${name}: '기록으로 지도 정리' ${want.run ? 'offered' : 'not offered'} after the status`);
  if (want.run) assert.deepEqual(after.primary, ['기록으로 지도 정리'], `${name}: the reading is the primary way in`);
  if (want.note) assert.ok(after.notes.some(n => want.note.test(n)), `${name}: note ${after.notes}`);
  assert.equal(after.inBox && after.focus, '부분 직접 추가', `${name}: the focus stays on the same action`);
  assert.equal(page.url(), url0); assert.equal(await page.evaluate(CAMERA), camera0);
  // The return pane reads the same mapRun.can/input/blocked: it offers the reading exactly when the entry does.
  await page.locator('#return-entry').click();
  const pane = page.locator('#lens .rr-map');
  await page.waitForTimeout(200);
  const paneRun = await pane.getByRole('button', { name: '기록으로 지도 정리' }).count();
  assert.equal(paneRun, want.run ? 1 : 0, `${name}: the return pane agrees`);
  if (SHOTS) { await page.locator('#return-entry').click(); await page.waitForTimeout(150); await page.screenshot({ path: `${SHOTS}/s-${name}.png` }); }
  await page.waitForTimeout(400);
  assert.deepEqual(sent, [], `${name}: nothing was sent or reserved`);
  assert.deepEqual(errors, []);
  ok(`S ${name}: before none · after ${want.run ? 'offered' : 'not offered'} · pane agrees · focus kept · nothing sent`, after.notes.join(' | '));
  await ctx.close();
}

/** The status arrives while another project is open with an unsaved paste draft, its focus and a moved camera. */
async function lateElsewhere(browser, base, real, z) {
  const { ctx, page, errors, sent } = await context(browser, base);
  await page.goto(`${base}/`);
  await page.evaluate(SEED, [W, [entry(A, fresh('첫 지도', '요구: 폴더 안의 문서를 한 번에 변환한다.')), entry(Z, z.project)]]);
  const gate = await holdStatus(page, real.mapOnly);
  await reloadAt(page, `#/p/${A}`);
  await page.locator('#space-empty .se-direct').waitFor();
  assert.equal(await page.locator('#space-empty .se-run').count(), 0);
  // To the other project: a part selected, the camera zoomed, then its paste box with a draft (selection kept backwards).
  await page.evaluate(k => { location.hash = `#/p/${k}`; }, Z);
  await page.locator('#world .node', { hasText: 'Power supply' }).click();
  await page.locator('#lens-title').filter({ hasText: 'Power supply' }).waitFor();
  await page.mouse.move(300, 400); await page.mouse.wheel(0, -240); await page.waitForTimeout(300);
  await page.locator('#lens .more > summary').click();
  await page.locator('#lens .more-menu').getByRole('menuitem', { name: '기록 붙여넣기' }).click();
  const draft = Array.from({ length: 30 }, (_, i) => `${i + 1} 미저장 초안 줄: Power supply의 절전 불가 주석을 다시 읽는 중입니다.`).join('\n');
  await page.locator('#paste-text').fill(draft);
  await page.evaluate(() => { const t = document.getElementById('paste-text'); t.focus(); t.setSelectionRange(40, 120, 'backward'); t.scrollTop = 200; window.__t123 = t; });
  const snap = () => page.evaluate(() => { const t = document.getElementById('paste-text');
    return { url: location.href, camera: document.getElementById('world').style.transform, same: t === window.__t123, value: t.value.length, sel: [t.selectionStart, t.selectionEnd, t.selectionDirection], scroll: t.scrollTop, focus: document.activeElement === t, nodes: document.querySelectorAll('#world .node').length, empty: document.getElementById('space-empty').hidden }; });
  const before = await snap();
  gate.open(); await settled(page);
  const after = await snap();
  // The return pane is drawn again for the status (a new box): text, caret, the selection's direction, scroll and focus stay.
  const { same, ...kept } = before;
  assert.deepEqual({ ...after, same: undefined }, { ...kept, same: undefined }, 'the project open now stays as it was');
  // Back to the first project: its entry reads the status that arrived meanwhile.
  await page.evaluate(k => { location.hash = `#/p/${k}`; }, A);
  await page.locator('#space-empty .se-run').waitFor();
  await page.waitForTimeout(300);
  assert.deepEqual(sent, []); assert.deepEqual(errors, []);
  ok('S elsewhere: the open project\'s URL, camera, map, draft (text, backward selection, scroll, focus) kept; the first project then offers the reading', `box rebuilt ${!after.same}, sel ${JSON.stringify(after.sel)}, scroll ${after.scroll}`);
  await ctx.close();
}

/* ---------- L: the lens reads description → all current claims → relations ---------- */
async function lens(browser, base, z, size) {
  const { ctx, page, errors, sent } = await context(browser, base, size);
  await page.goto(`${base}/`);
  await page.evaluate(SEED, [W, [entry(Z, z.project)]]);
  await reloadAt(page, `#/p/${Z}/${z.power}`);
  await page.locator('#lens-title').filter({ hasText: 'Power supply' }).waitFor(); await settled(page);
  const order = await page.evaluate(() => [...document.querySelectorAll('#lens .lens-body > *')].map(e => e.className));
  assert.deepEqual(order.slice(0, 2), ['lens-desc', 'lens-claims'], `order ${order}`);
  assert.ok(order.slice(2).length && order.slice(2).every(c => c === 'lens-ports'), `relations follow the claims: ${order}`);
  const claims = await page.locator('#lens .lens-claims .claim .cl-text').allTextContents();
  assert.deepEqual(claims, z.claims, 'every current claim, in its order, in its own words');
  assert.equal(await page.locator('#lens .lens-claims h3 small').textContent(), String(z.claims.length));
  assert.equal(await page.locator('#lens .lens-claims .claim:visible').count(), z.claims.length, 'none folded away');
  assert.equal(await page.locator('#lens .lens-claims .claims-more').count(), 0);
  const geo = await page.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect(); const last = [...document.querySelectorAll('#lens .lens-claims .claim')].at(-1).getBoundingClientRect();
    return { claimsTop: r('#lens .lens-claims').top, lastClaimBottom: last.bottom, portsTop: r('#lens .lens-ports').top, bodyBottom: r('#lens .lens-body').bottom }; });
  assert.ok(geo.lastClaimBottom <= geo.portsTop, 'the always-on limitation reads before the first relation');
  // Relations: verb group, direction, real other end and the stored note, each still there.
  const rows = await page.evaluate(() => [...document.querySelectorAll('#lens .lens-ports')].map(s => ({ head: s.querySelector('h3').textContent, rows: [...s.querySelectorAll('.port')].map(p => ({ dir: p.querySelector('.port-dir')?.textContent, far: p.querySelector('strong')?.textContent, note: p.querySelector('.port-note')?.textContent })) })));
  const all = rows.flatMap(g => g.rows);
  assert.deepEqual(all.map(x => x.far).sort(), ['Display', 'nRF52840', 'sensors']);
  assert.ok(all.every(x => x.dir && x.note), JSON.stringify(rows));
  assert.equal(all.find(x => x.far === 'Display').note, LONG_NOTE);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/l-power-${size.join('x')}.png` });
  // The long note reads whole on request, in place.
  const more = page.locator('#lens .lens-ports li', { hasText: 'Display' }).locator('.note-more');
  assert.equal(await more.count(), 1, 'the long note has its whole-text control');
  await more.click(); assert.equal(await more.getAttribute('aria-expanded'), 'true');
  const body = page.locator('#lens .lens-body');

  // A claim's quote and back: same URL, citation button (focused), scroll and camera; the unfolded note stays unfolded.
  const cite = page.locator('#lens .lens-claims .cl-cite').last();
  await cite.scrollIntoViewIfNeeded(); await cite.focus();
  const scroll0 = await body.evaluate(e => e.scrollTop), url0 = page.url(), camera0 = await page.evaluate(CAMERA), key0 = await cite.getAttribute('data-claim-focus');
  const quote = (await cite.getAttribute('title')).replace(/^원문에서 보기 · “|”$/g, '');
  await cite.click();
  await page.locator('#lens .rr-mark').first().waitFor();
  assert.ok((await page.locator('#lens .rr-mark').allTextContents()).join('').includes(quote.trim().slice(0, 30)), 'the exact passage is marked');
  await page.locator('#lens .rr-back').click();
  await page.locator('#lens .lens-claims').waitFor();
  assert.equal(page.url(), url0);
  const back = page.locator('#lens .lens-claims .cl-cite').last();
  assert.equal(await back.getAttribute('data-claim-focus'), key0);
  assert.ok(await back.evaluate(e => e === document.activeElement), 'the same citation has the focus');
  assert.ok(Math.abs(await body.evaluate(e => e.scrollTop) - scroll0) <= 1, 'the same scroll');
  await page.waitForTimeout(250); assert.equal(await page.evaluate(CAMERA), camera0, 'the same camera');
  assert.equal(await page.locator('#lens .lens-ports li', { hasText: 'Display' }).locator('.note-more').getAttribute('aria-expanded'), 'true');

  // Following the supply relation to Display and back: the same part, scroll, relation button and unfolded note.
  const port = page.locator('#lens .lens-ports .port[data-far]').filter({ hasText: 'Display' });
  await port.scrollIntoViewIfNeeded(); await port.focus();
  const scroll1 = await body.evaluate(e => e.scrollTop), url1 = page.url(), camera1 = await page.evaluate(CAMERA);
  await port.click();
  await page.locator('#lens-title').filter({ hasText: 'Display' }).waitFor();
  assert.equal(await page.locator('#lens .lens-body > *').first().getAttribute('class'), 'lens-desc');
  await page.locator('#lens .visit-line').click();
  await page.locator('#lens-title').filter({ hasText: 'Power supply' }).waitFor(); await page.waitForTimeout(300);
  assert.equal(page.url(), url1);
  assert.ok(Math.abs(await body.evaluate(e => e.scrollTop) - scroll1) <= 1, 'the same scroll after the visit');
  assert.ok(await page.evaluate(() => document.activeElement?.matches('#lens .port[data-far]') && document.activeElement.textContent.includes('Display')), 'back on the relation it was followed by');
  assert.equal(await page.evaluate(CAMERA), camera1, 'the same camera after the visit');
  assert.equal(await page.locator('#lens .lens-ports li', { hasText: 'Display' }).locator('.note-more').getAttribute('aria-expanded'), 'true');
  await page.waitForTimeout(200);
  assert.deepEqual(sent, []); assert.deepEqual(errors, []);
  ok(`L ${size.join('x')}: desc → ${z.claims.length} claims (limitation last) → relations; quote and visit return`, `claims y${geo.claimsTop.toFixed(1)}–${geo.lastClaimBottom.toFixed(1)}, relations y${geo.portsTop.toFixed(1)}, body bottom y${geo.bodyBottom.toFixed(1)}`);
  await ctx.close();
}

const { proc, base } = await start();
const browser = await chromium.launch();
try {
  const probe = await browser.newPage(); await probe.goto(`${base}/`);
  const real = await probe.evaluate(() => fetch('/api/studio/status').then(r => r.json())); await probe.close();
  assert.equal(real.ai, 'deepseek'); assert.ok(real.map?.prompt, 'the smoke server has a map recipe');
  const b = bodies(real), z = zephyr();
  await lateStatus(browser, base, 'map-only ready', b.mapOnly, { run: true, note: /AI에 보내요/ });
  await lateStatus(browser, base, 'key ready', b.ready, { run: true, note: /AI에 보내요/ });
  await lateStatus(browser, base, 'keyless server', b.keyless, { run: false, note: /AI 서버가 연결된 주소/ });
  await lateStatus(browser, base, 'executor not ready', b.executorDown, { run: false, note: /AI 서버가 연결된 주소/ });
  await lateStatus(browser, base, 'job store busy', b.storeBusy, { run: false, note: /다른 Studio 실행기/ });
  await lateStatus(browser, base, 'no answer', b.unreachable, { run: false, note: /AI 서버가 연결된 주소/ });
  await lateStatus(browser, base, 'unsuitable record', b.mapOnly, { run: false, note: /보낼 수 없는 기록/ });
  // Access code: the status alone does not decide it (mapRun.can reads no code; the server asks for it when the reading is sent),
  // so the entry offers exactly what the return pane offers. Recorded as it is, not as a new rule.
  await lateStatus(browser, base, 'access code required', b.code, { run: true, note: /AI에 보내요/ });
  await lateElsewhere(browser, base, b, z);
  await lens(browser, base, z, [1280, 720]);
  await lens(browser, base, z, [1440, 900]);
  console.log(`# ${results.length} checks passed`);
} finally { await browser.close(); proc.kill(); }
