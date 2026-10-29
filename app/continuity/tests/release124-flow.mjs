// AF124 the limited existing-map release as packaged. Auxiliary Node Playwright flow (like reading123-flow.mjs), not part of CI:
//   node continuity/tests/release124-flow.mjs [out-dir]        (from app/)
// Builds exactly what deploy-cloudflare.mjs --dry-run --release=existing-map packages (assets + Worker closure, manifest written to
// out-dir), then serves those assets through the release Worker module itself over real HTTP, with the provider transport replaced
// by a stub that answers plan/scope/digest/ask only (labelled '[스텁]') and counts every call. No key, no model call.
// The default Worker (worker.mjs) serves the same assets on a second address as the control.
//   H. Home: the release note arrives with a late status in place (a typed draft, its selection and focus stay); its three ways in
//      are explicit actions; the earlier public site opens only as a link (new tab, no referrer). Only the status is requested.
//   E. A new project's empty map says what this version is for, never 'connect an AI server'; a pasted record is only kept.
//   I. A map backup chosen through the note comes in as a copy; its unread records and the return pane say the release limit,
//      with no way to start a map reading; plan3 analysis still goes through the release Worker to the (stub) provider.
//   R. The two request-comparison prompts (a map read without its request, later comparable; requests too many to compare at once)
//      show on the default Worker and are not offered by the release (its stored reading is still said as it is).
//   X. Hand-made map/jobs requests from the page are refused (MAP_WITHHELD) with no provider call; no map request was ever sent.
//   C. Control: the default Worker on the same assets still offers the first map reading (nothing is started).
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';
import assert from 'node:assert/strict';

const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url)), APP = fileURLToPath(new URL('../..', import.meta.url));
const OUT = process.argv[2] ?? join(APP, 'test-results/release124'); mkdirSync(OUT, { recursive: true });
const PUBLIC = 'https://agentflow-studio.tlsee0813.workers.dev/';
const LIMIT = '원자료로 첫 지도를 만들거나 새 기록으로 지도를 갱신하는 기능은 이 버전에서 제공하지 않아요.';

/* ---------- the packaged candidate ---------- */
const build = spawnSync(process.execPath, ['continuity/scripts/deploy-cloudflare.mjs', '--dry-run', '--release=existing-map', `--manifest=${join(OUT, 'manifest.json')}`], { cwd: APP, encoding: 'utf8' });
assert.equal(build.status, 0, build.stderr);
const manifest = JSON.parse(readFileSync(join(OUT, 'manifest.json'), 'utf8')), DIST = join(ROOT, 'static-dist');
assert.equal(manifest.policy, 'existing-map'); assert.equal(manifest.main, 'continuity/server/worker-existing-map.mjs');
const D = await import(`${ROOT}dist/public/shared/domain.js`), S = await import(`${ROOT}dist/public/shared/storage.js`);
const C = await import(`${ROOT}dist/public/shared/change-plan.js`), M = await import(`${ROOT}dist/public/shared/map-reading.js`);
const { studioView } = await import(`${ROOT}dist/public/shared/studio.js`), { emptyBundle, saveBundle } = await import(`${ROOT}dist/public/client/plan-store.js`);
const { frozenRequests } = await import(`${ROOT}dist/public/client/request-results.js`);
const K = await import('./condition116-case.mjs');

/* ---------- stub provider (in this process: the Worker's handler uses globalThis.fetch) ---------- */
const calls = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (url !== 'https://api.deepseek.com/chat/completions') return realFetch(url, init);
  const body = JSON.parse(init.body), ask = JSON.parse(body.messages[1].content.replace(/^[^\n]*\n/, '')); calls.push(ask.schemaVersion);
  assert.equal(init.headers.Authorization, 'Bearer stub-key');
  if (/^studio\.map\./.test(ask.schemaVersion)) throw new Error('a map ask reached the provider');
  const content = ask.schemaVersion === 'studio.plan.3' ? { summary: '[스텁] 변경안 자리예요. 모델의 분석이 아니에요.', impacts: [], preserve: [], unknowns: [],
    items: [{ id: 'c1', title: '[스텁] 변경 항목', description: '[스텁] 화면과 저장 경로 확인용 항목이에요.', partIds: [ask.parts[0].id], refs: [ask.evidence[0].id], dependsOn: [] }] } : null;
  if (!content) return new Response('{}', { status: 500 });
  return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }] }), { status: 200 });
};

/* ---------- the Workers over real HTTP, with their assets binding ---------- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const ASSETS = { fetch: async request => {
  const path = new URL(request.url).pathname, file = normalize(join(DIST, path === '/' ? 'index.html' : path));
  if (!file.startsWith(DIST) || !existsSync(file)) return new Response('Not found', { status: 404 });
  return new Response(readFileSync(file), { headers: { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' } });
} };
async function serve(module) {
  const worker = (await import(module)).default, env = { DEEPSEEK_API_KEY: 'stub-key', AI_MODE: 'deepseek', ASSETS };
  const server = createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c);
    const headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
    const r = await worker.fetch(new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) }), env);
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}
const release = await serve(`${ROOT}server/worker-existing-map.mjs`), control = await serve(`${ROOT}server/worker.mjs`);

const results = [];
const ok = (name, detail = '') => { results.push(name); console.log(`ok - ${name}${detail ? ` · ${detail}` : ''}`); };
async function context(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, acceptDownloads: false });
  const page = await ctx.newPage(), errors = [], sent = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('request', r => { if (r.url().includes('/api/')) sent.push(`${r.method()} ${new URL(r.url()).pathname}`); });
  return { ctx, page, errors, sent };
}
const settled = page => page.waitForFunction(() => document.getElementById('ai-pill')?.dataset.state !== 'checking').then(() => page.waitForTimeout(200));
const text = (page, sel) => page.locator(sel).innerText();

const browser = await chromium.launch();
try {
  /* H: home, late status */
  {
    const { ctx, page, errors, sent } = await context(browser);
    let open; const gate = new Promise(r => { open = r; });
    await page.route('**/api/studio/status', async route => { await gate; await route.continue(); });
    await page.goto(`${release.base}/`);
    await page.locator('#new-open').click();
    await page.locator('#new-name').fill('124 첫 편집 초안');
    await page.evaluate(() => { const i = document.getElementById('new-name'); i.setSelectionRange(4, 6, 'backward'); });
    assert.equal(await page.locator('#release-note').isHidden(), true, 'nothing said before the status');
    open(); await page.locator('#release-note').waitFor(); await page.waitForTimeout(200);
    const kept = await page.evaluate(() => { const i = document.getElementById('new-name'); return [i.value, i.selectionStart, i.selectionEnd, i.selectionDirection, document.activeElement === i]; });
    assert.deepEqual(kept, ['124 첫 편집 초안', 4, 6, 'backward', true], 'draft, selection and focus kept');
    const note = await text(page, '#release-note');
    for (const s of ['기존 지도 작업용 버전이에요', LIMIT, '자동으로 옮겨지지 않아요', '‘변경 구상’에서 변경안 파일도 따로', '자동으로 맞춰지지 않아요']) assert.ok(note.includes(s), s);
    assert.ok(!/schema|studio\.map|map7|m6-|m7-|실행기|jobs/i.test(note), 'no developer vocabulary');
    const link = page.locator('#release-note a.rn-public');
    assert.deepEqual([await link.getAttribute('href'), await link.getAttribute('target'), await link.getAttribute('rel')], [PUBLIC, '_blank', 'noopener noreferrer']);
    assert.deepEqual(await page.locator('#release-note button').allInnerTexts(), ['예제로 살펴보기', '지도 백업 가져오기']);
    await page.locator('#new-cancel').click();
    await page.screenshot({ path: join(OUT, 'h-home-note.png') });
    await page.locator('#release-note').getByRole('button', { name: '예제로 살펴보기' }).click(); await page.waitForTimeout(300);
    assert.ok(await page.evaluate(() => document.getElementById('project-list').contains(document.activeElement)), 'the examples are reached');
    await page.screenshot({ path: join(OUT, 'h-home-examples.png') });
    assert.deepEqual(sent, ['GET /api/studio/status']); assert.deepEqual(errors, []);
    ok('H home: note after a late status · draft/selection/focus kept · explicit ways in · only the status requested');
    await ctx.close();
  }
  /* E: a new project's empty map */
  {
    const { ctx, page, errors, sent } = await context(browser);
    await page.goto(`${release.base}/`); await settled(page);
    await page.locator('#new-open').click(); await page.locator('#new-name').fill('제한판 새 프로젝트'); await page.locator('#new-form button[type=submit]').click();
    await page.locator('#space-empty h2').waitFor();
    assert.equal(await text(page, '#space-empty h2'), '기존 지도 작업용 버전이에요');
    await page.locator('#space-empty').getByRole('button', { name: '기록 붙여넣기' }).click();
    await page.locator('#paste-text').fill('요구: 폴더 안의 문서를 한 번에 변환한다.\n작업 보고: 변환기는 문서마다 PDF 하나를 만든다.');
    await page.locator('#lens').getByRole('button', { name: '기록 저장' }).click(); await page.waitForTimeout(400);
    const pane = await page.locator('#lens').innerText();
    assert.ok(!/AI 서버가 연결된 주소/.test(pane) && !await page.locator('#lens').getByRole('button', { name: /지도 정리|지도 갱신/ }).count(), pane);
    if (await page.locator('#return-entry').getAttribute('aria-pressed') === 'true') await page.locator('#return-entry').click();
    await page.waitForTimeout(200);
    const box = await text(page, '#space-empty');
    assert.ok(box.includes(LIMIT) && /기록 1개는 이 프로젝트에 보관돼 있어요/.test(box), box);
    assert.ok(!/AI 서버가 연결된|지도로 정리할 때 보내요|기록으로 지도 정리/.test(box), box);
    await page.screenshot({ path: join(OUT, 'e-empty-map.png') });
    // Reloaded into this project with the status held: the card changes in place when it comes; the focus stays on the same action.
    let open; const gate = new Promise(r => { open = r; });
    await page.route('**/api/studio/status', async route => { await gate; await route.continue(); });
    await page.reload(); await page.locator('#space-empty .se-direct').waitFor();
    assert.equal(await text(page, '#space-empty h2'), '기록으로 첫 지도를 만들어요', 'before the status: the card as before');
    await page.locator('#space-empty .se-direct').focus(); const camera = await page.evaluate(() => document.getElementById('world').style.transform);
    open(); await settled(page);
    assert.equal(await text(page, '#space-empty h2'), '기존 지도 작업용 버전이에요');
    assert.deepEqual(await page.evaluate(() => [document.activeElement?.textContent, document.getElementById('space-empty').contains(document.activeElement), document.getElementById('world').style.transform]), ['부분 직접 추가', true, camera]);
    assert.ok(!sent.some(s => /map|jobs/.test(s)), sent.join()); assert.deepEqual(errors, []);
    ok('E empty map: release card · the record is kept only · late status keeps focus/camera · no map request', box.split('\n')[0]);
    await ctx.close();
  }
  /* I: a backup comes in through the note; plan3 through the release Worker */
  {
    const c = K.conditionProject({ D, M, C, S, studioView, emptyBundle });
    const extra = D.pasteRecord(c.project, '작업 보고: 썸네일 캐시를 추가했다고 보고합니다.', null).project;
    const file = join(OUT, 'backup.json'); writeFileSync(file, S.serializeBackup(JSON.parse(S.serializeProject(extra)), null));
    const { ctx, page, errors, sent } = await context(browser);
    await page.goto(`${release.base}/`); await settled(page);
    const chooser = page.waitForEvent('filechooser');
    await page.locator('#release-note').getByRole('button', { name: '지도 백업 가져오기' }).click();
    await (await chooser).setFiles(file);
    await page.locator('#world .map-title').waitFor(); await page.waitForTimeout(300);
    const title = await text(page, '#world .map-title');
    assert.ok(!/지도 갱신|지도로 정리/.test(title), title);
    assert.ok(/읽지 않은 기록 \d+개/.test(title) && title.includes(LIMIT), title);
    await page.locator('#return-entry').click(); await page.waitForTimeout(300);
    const pane = await page.locator('#lens').innerText();
    assert.ok(!/AI 서버가 연결된 주소/.test(pane), 'no wrong cure in the return pane');
    assert.equal(await page.locator('#lens').getByRole('button', { name: /지도 정리|지도 갱신/ }).count(), 0);
    assert.ok(/읽지 않은 기록 \d+개/.test(pane) && pane.includes(LIMIT), pane);
    await page.screenshot({ path: join(OUT, 'i-imported-return.png') });
    await page.locator('#return-entry').click();
    await page.locator('#plan-entry').click(); await page.locator('#plan-intent').waitFor();
    await page.locator('#plan-intent').fill('썸네일을 WebP로 저장하고 싶다.');
    await page.locator('#plan-ask').click();
    await page.waitForFunction(() => /\[스텁\]/.test(document.body.innerText)); await page.waitForTimeout(300);
    await page.screenshot({ path: join(OUT, 'i-plan3.png') });
    assert.ok(sent.includes('POST /api/studio/plan')); assert.ok(!sent.some(s => /map|jobs/.test(s)), sent.join());
    assert.deepEqual(errors, []);
    ok('I backup copy: no map reading offered · return pane says the release limit · plan3 analysed through the release Worker', `${calls.filter(x => x === 'studio.plan.3').length} plan3 call(s)`);
    await ctx.close();
  }
  /* R: the request-comparison prompts */
  {
    // A: its last map reading (map.1) was read without the frozen request it has. B: nine frozen requests, too many to compare at once.
    const a = K.conditionProject({ D, M, C, S, studioView, emptyBundle }), b = K.conditionProject({ D, M, C, S, studioView, emptyBundle });
    let pa = a.project; const ia = M.buildMapAsk(pa, studioView(pa), [], undefined, false);
    pa = JSON.parse(S.serializeProject(M.applyReading(pa, ia, M.validateMapReply({ summary: '[스텁] 요청 대조 없이 읽은 자리예요.', parts: [], relations: [], candidates: [], gaps: ['[스텁] 새 부분은 없어요.'] }, ia.ask),
      { id: 'R_124_m1', at: new Date().toISOString(), model: 'stub', prompt: 'm1-000000000000', hash: '1'.repeat(64) }).project));
    assert.equal(pa.readings.at(-1).version, 'map-reading.1'); assert.equal(frozenRequests(pa, [a.rq]).length, 1);
    const snaps = Array.from({ length: 9 }, () => C.requestSnapshot(b.bundle.plan)), many = { ...b.bundle, snapshots: snaps,
      labels: Object.fromEntries(snaps.map(x => [x.id, Object.values(b.bundle.labels)[0]])), origins: Object.fromEntries(snaps.map(x => [x.id, 'ai'])) };
    assert.equal(M.buildMapAsk(b.project, studioView(b.project), frozenRequests(b.project, snaps.map(x => x.scope)), undefined, false).problem, 'REQUEST_CONTEXT_TOO_LARGE');
    const mem = new Map(), kv = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: k => mem.delete(k) };
    assert.equal(saveBundle(kv, pa.id, a.bundle), null); assert.equal(saveBundle(kv, b.project.id, many), null);
    const at = new Date().toISOString(), entry = (entryId, project) => ({ entryId, state: 'active', lifecycle: 1, seq: 1, createdAt: at, trashedAt: null, origin: 'new', project });
    mem.set('agentflow.idea015.workspace', JSON.stringify({ version: 'agentflow.workspace.1', migratedFromLegacy: false, entries: [entry('E_rel124-aaaa-0001', pa), entry('E_rel124-bbbb-0002', b.project)] }));
    const seed = Object.fromEntries([...mem].map(([k, v]) => [manifest.storagePrefix + k, v]));
    const read = async (page, key) => {
      await page.evaluate(x => history.replaceState(null, '', x), `#/p/${key}`); await page.reload(); await settled(page);
      await page.locator('#world .map-title').waitFor(); await page.waitForTimeout(200);
      const title = await text(page, '#world .map-title'), titleCta = await page.locator('#world .map-title').getByRole('button', { name: /요청문을 골라/ }).count();
      await page.locator('#return-entry').click(); await page.locator('#lens .rr-map').waitFor(); await page.waitForTimeout(200);
      const pane = await text(page, '#lens .rr-map'), paneCta = await page.locator('#lens .rr-map').getByRole('button', { name: /요청문을 골라/ }).count();
      return { title, titleCta, pane, paneCta };
    };
    const seen = {};
    for (const [name, base] of [['default', control.base], ['release', release.base]]) {
      const { ctx, page, errors, sent } = await context(browser);
      await page.goto(`${base}/`); await page.evaluate(x => { localStorage.clear(); for (const [k, v] of Object.entries(x)) localStorage.setItem(k, v); }, seed);
      seen[name] = { A: await read(page, 'E_rel124-aaaa-0001'), B: await read(page, 'E_rel124-bbbb-0002') };
      if (name === 'release') await page.screenshot({ path: join(OUT, 'r-release-crowded.png') });
      assert.ok(!sent.some(x => /map|jobs/.test(x)), sent.join()); assert.deepEqual(errors, []);
      await ctx.close();
    }
    const dA = seen.default.A, dB = seen.default.B, rA = seen.release.A, rB = seen.release.B;
    // The conditions hold: the default Worker offers both.
    assert.ok(dA.titleCta === 1 && dA.title.includes('나중에 요청문을 골라 대조') && dA.pane.includes('원문은 나중에 요청문을 골라 대조할 수 있어요.'), JSON.stringify(dA));
    assert.ok(dB.titleCta === 1 && dB.paneCta === 1 && dB.pane.includes('비교할 요청문을 골라 주세요'), JSON.stringify(dB));
    // The release says neither, and says its limit where unread records wait.
    assert.ok(rA.titleCta === 0 && rA.paneCta === 0 && !/요청문을 골라/.test(rA.title + rA.pane) && rA.pane.includes('이 읽기는 요청 대조 없이 지도에 정리했어요.'), JSON.stringify(rA));
    assert.ok(rB.titleCta === 0 && rB.paneCta === 0 && !/요청문을 골라|비교할 요청문/.test(rB.title + rB.pane) && rB.title.includes(LIMIT) && rB.pane.includes(LIMIT), JSON.stringify(rB));
    ok('R request-comparison prompts: offered by the default Worker (both conditions hold), not by the release; its stored reading still said');
  }
  /* X: hand-made requests */
  {
    const { ctx, page } = await context(browser);
    await page.goto(`${release.base}/`); await settled(page);
    const before = calls.length;
    const out = await page.evaluate(async () => Promise.all([['/api/studio/map', '{"schemaVersion":"studio.map.6"}'], ['/api/studio/map', '{"schemaVersion":"studio.map.7"}'], ['/api/studio/map', '{"schemaVersion":"studio.map.1"}'], ['/api/studio/jobs', '{}'], ['/api/studio/jobs/MJ_x/cancel', '{}']]
      .map(([p, b]) => fetch(p, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-AgentFlow-Request': '1' }, body: b }).then(async r => [r.status, (await r.json()).error.code]))));
    const job = await page.evaluate(() => fetch('/api/studio/jobs/MJ_x').then(async r => [r.status, (await r.json()).error.code]));
    for (const r of [...out, job]) assert.deepEqual(r, [403, 'MAP_WITHHELD']);
    assert.equal(calls.length, before);
    const status = await page.evaluate(() => fetch('/api/studio/status').then(r => r.json()));
    assert.equal(status.release, 'existing-map'); assert.ok(status.digest && !status.map && !status.jobs);
    ok('X hand-made map/jobs requests refused with no provider call', JSON.stringify(status));
    await ctx.close();
  }
  /* C: the default Worker on the same assets */
  {
    const { ctx, page, errors, sent } = await context(browser);
    await page.goto(`${control.base}/`); await settled(page);
    assert.equal(await page.locator('#release-note').isHidden(), true);
    await page.locator('#new-open').click(); await page.locator('#new-name').fill('기본판 새 프로젝트'); await page.locator('#new-form button[type=submit]').click();
    await page.locator('#space-empty h2').waitFor();
    assert.equal(await text(page, '#space-empty h2'), '기록으로 첫 지도를 만들어요');
    const status = await page.evaluate(() => fetch('/api/studio/status').then(r => r.json()));
    assert.ok(status.map && !('release' in status));
    assert.ok(!sent.some(s => /map|jobs/.test(s))); assert.deepEqual(errors, []);
    ok('C default Worker: first map entry and map status as before (nothing started)');
    await ctx.close();
  }
} finally {
  await browser.close(); release.server.close(); control.server.close();
}
assert.ok(!calls.some(x => /^studio\.map\./.test(x)));
console.log(`release124 flow: ${results.length} passed · provider calls ${JSON.stringify(calls)} · manifest assets ${manifest.assets.sha256.slice(0, 12)} modules ${manifest.modules.sha256.slice(0, 12)} · ${OUT}`);
