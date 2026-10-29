// AF114 normal-UI check at 1280x800 in Chromium, model-free. The real local app with the AF102 preview launcher (studio handler,
// AF100 job store, CLI executor opted in for later map.6 readings) runs the harmless fake CLI of the app tests: each job answers
// with a reply file this script writes for that very ask (source114-case.mjs replyFor), byte for byte. No network, no model, no key.
// The project.13 copy was written by the pre-114 build (make-fixture13.mjs); its plan bundle (the frozen request) is put in this
// browser's plan storage as that copy's sidecar. Six paths (DESIGN 114): import+file+save+export/reload, duplicates, both asks,
// job+explicit apply+quote roundtrip, legacy/rollback and failed attempts, async ownership. Every /api request is recorded.
//   node docs/cycles/2026-10-30-source-entry-114/check-ui-114.mjs <evidence-dir> [<pre-114 app/continuity/dist/public>]
//   (from the repo root, after the continuity and app builds)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const APP = fileURLToPath(new URL('../../../app/', import.meta.url)), DIST = `${APP}continuity/dist/public/`;
const { chromium } = createRequire(`${APP}package.json`)('playwright');
const OUT = resolve(process.argv[2] ?? 'evidence-114'), PRE = process.argv[3] ? resolve(process.argv[3]) : null; mkdirSync(OUT, { recursive: true });
const D = await import(`${DIST}shared/domain.js`), M = await import(`${DIST}shared/map-reading.js`), V = await import(`${DIST}shared/validation.js`), RR = await import(`${DIST}shared/request-return.js`);
const { studioView } = await import(`${DIST}shared/studio.js`), { frozenRequests } = await import(`${DIST}client/request-results.js`);
const CASE = await import(pathToFileURL(`${APP}continuity/tests/source114-case.mjs`).href);
const FIX = `${APP}continuity/tests/fixtures/source114/`, BACKUP13 = readFileSync(`${FIX}project13-backup.json`, 'utf8'), BUNDLE = JSON.parse(readFileSync(`${FIX}plans13-bundle.json`, 'utf8'));
const FAKE = `${APP}continuity/tests/fake-cli102.mjs`, W = 'agentflow.idea015.workspace', PLANS = 'agentflow.studio.plans.1';
const sha = t => createHash('sha256').update(t).digest('hex');
const root = mkdtempSync(join(tmpdir(), 'af114-ui-')), ctl = join(root, 'ctl'); mkdirSync(ctl);
writeFileSync(join(ctl, 'mode'), 'file\nfile-delay:5000\nok');
writeFileSync(join(root, 'policy.json'), JSON.stringify({ executor: 'codex-cli-preview.102', exe: process.execPath, binarySha256: sha(readFileSync(process.execPath)),
  version: 'fake-cli 102-test', versionArgs: [FAKE, '--version', '--ctl', ctl], args: [FAKE, '--ctl', ctl, '--final', '{final}', '--cwd', '{cwd}', '--model', '{model}', '--reasoning', '{reasoning}'],
  model: 'fake-model-102', reasoning: 'high', selectionMs: 60000, verdictMs: 61000, scope: 'map6-later' }));
const invocations = () => existsSync(join(ctl, 'invocations')) ? readFileSync(join(ctl, 'invocations'), 'utf8').split('\n').filter(Boolean).length : 0;
const evidence = { at: new Date().toISOString(), viewport: '1280x800', fixture: { backup13Sha256: sha(BACKUP13), writer: 'pre-114 build (make-fixture13.mjs)' }, paths: {} };

const proc = spawn(process.execPath, [fileURLToPath(new URL('../2026-10-29-owned-cli-preview-102/preview/serve-preview.mjs', import.meta.url)), '--policy', join(root, 'policy.json'), '--state', join(root, 'state')],
  { cwd: APP, env: { ...process.env, PORT: '0', STUDIO_JOBS_DIR: join(root, 'jobs'), DEEPSEEK_API_KEY: '' }, stdio: ['ignore', 'pipe', 'inherit'] });
const base = await new Promise((res, rej) => { let out = ''; proc.stdout.on('data', d => { out += d; const m = /READY (http:\/\/\S+) jobs=durable executor=ready/.exec(out); if (m) res(m[1]); }); proc.once('exit', c => rej(new Error(`launcher exit ${c}`))); });
const browser = await chromium.launch(process.env.STUDIO_CHROMIUM ? { executablePath: process.env.STUDIO_CHROMIUM } : {});
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true }), page = await context.newPage(), errors = [], api = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('request', r => { const u = new URL(r.url()); if (u.pathname.startsWith('/api/')) api.push(`${r.method()} ${u.pathname}`); });
  const posts = () => api.filter(x => x.startsWith('POST')).length;
  const shot = n => page.screenshot({ path: `${OUT}/ui114-${n}.png` });
  const entries = () => page.evaluate(w => JSON.parse(localStorage.getItem(w)).entries, W);
  const entry = async k => (await entries()).find(e => e.entryId === k);
  const rawEntry = k => page.evaluate(([w, k]) => JSON.stringify(JSON.parse(localStorage.getItem(w)).entries.find(e => e.entryId === k)), [W, k]);
  const keyOf = () => decodeURIComponent(/#\/p\/([^/]+)/.exec(page.url())[1]);
  const go = k => page.evaluate(k => { location.hash = k ? `#/p/${k}` : ''; }, k);
  const ready = async () => { await page.waitForFunction(() => !!document.getElementById('ai-text')?.textContent); await page.waitForTimeout(150); };
  const lens = page.locator('#lens'), form = lens.locator('.rr-file-box');
  const fileOf = (name, text) => ({ name, mimeType: 'text/plain', buffer: Buffer.from(text, 'utf8') });
  const choose = async (kind, file) => { await form.locator(`#file-kind-${kind}`).check(); await form.locator('#file-pick').setInputFiles(file); };
  const saveAndWait = async (k, seq) => { await lens.getByRole('button', { name: '자료 저장' }).click(); await page.waitForFunction(([w, k, s]) => JSON.parse(localStorage.getItem(w)).entries.find(e => e.entryId === k).seq > s, [W, k, seq]); };
  const importFile = async (name, raw) => { await go(null); await ready(); await page.locator('#import-file').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(raw, 'utf8') }); };

  /* ---------- 1. import the project.13 copy, add a provided code file and a check file, save (0 AI), export and reload ---------- */
  await page.goto(`${base}/`); await ready();
  await importFile('project13-backup.json', BACKUP13); await page.waitForURL(/#\/p\/E_/); const A = keyOf();
  const fixture = V.parseBackup(BACKUP13).project, raw13 = JSON.parse(BACKUP13);
  await page.evaluate(([k, id, b]) => localStorage.setItem(k, JSON.stringify({ version: 'studio.plans.4', projects: { [id]: b } })), [PLANS, fixture.id, BUNDLE]);
  await page.reload(); await ready();
  const imported = (await entry(A)).project;
  assert.equal(raw13.schemaVersion, 'idea015.project.13'); assert.equal(imported.schemaVersion, 'idea015.project.14');
  for (const k of ['pasted', 'readings', 'sources', 'tasks', 'bases', 'space', 'id', 'name']) assert.deepEqual(imported[k], raw13[k], `import keeps ${k}`);
  const rq = BUNDLE.snapshots[0].scope;
  // The frozen request's own action: the plan's results for that request, then '코드·검사 자료 추가'.
  await page.locator('#plan-entry').click(); await page.getByRole('button', { name: /^돌아온 기록 · 요청문/ }).click();
  const before1 = posts();
  await page.locator('.pp-results').getByRole('button', { name: '코드·검사 자료 추가' }).click();
  await form.waitFor(); await shot('1-form-empty');
  // A refused file first (invalid UTF-8): nothing is kept, nothing is saved, the form stays.
  await form.locator('#file-kind-code').check();
  await form.locator('#file-pick').setInputFiles({ name: 'bad.ts', mimeType: 'text/plain', buffer: Buffer.from([0x61, 0xff, 0x62]) });
  await form.getByRole('alert').getByText('UTF-8 텍스트 파일이 아니라서').waitFor();
  await choose('code', fileOf('convert.ts', CASE.CODE_FILE));
  const preview = form.locator('.rr-file-preview'); await preview.waitFor();
  assert.equal(await preview.evaluate(e => e.textContent), CASE.CODE_FILE, 'preview is the decoded file exactly (BOM, CRLF, spaces)');
  assert.equal(await preview.evaluate(e => e.tagName), 'PRE'); assert.equal(await form.locator('textarea').count(), 0, 'no editable box in the way');
  await form.locator('.rr-file-preview-box .fine').getByText('BOM 있음 · 줄끝 CRLF').waitFor();
  await form.locator('#file-version').fill(CASE.CODE_META.version); await form.locator('#file-origin').fill(CASE.CODE_META.origin);
  await shot('1-form-filled');
  let seq = (await entry(A)).seq; await saveAndWait(A, seq);
  const saved1 = (await entry(A)).project, code = saved1.pasted.at(-1);
  assert.equal(code.text, CASE.CODE_FILE); assert.deepEqual(code.evidence, CASE.CODE_META); assert.deepEqual(saved1.pasted.slice(0, -1), imported.pasted); assert.deepEqual(saved1.readings, imported.readings);
  assert.equal(saved1.tasks.length, imported.tasks.length); assert.equal(saved1.sources.length, imported.sources.length);
  // The saved source beside the map: what it is, as declared, and that the app has not run it.
  const art = lens.locator('article.rr-provided'); await art.waitFor();
  const shown = await art.innerText();
  for (const t of ['사용자 제공 코드 자료', 'convert.ts', '앱이 실행·검증하지 않음', 'commit 3f2a1c9', '사용자 기재', CASE.CODE_META.origin]) assert.ok(shown.includes(t), `shown: ${t}`);
  assert.equal(await art.locator('a').count(), 0, 'the origin is text, not a link'); assert.ok(await lens.locator('.rr-back').evaluate(e => e === document.activeElement), 'focus on the way back');
  const box = await art.boundingBox(); assert.ok(box && box.x >= 0 && box.x + box.width <= 1280, 'readable within 1280');
  for (const sel of ['h3', '.rr-provided-note', '.rr-origin', '.rr-raw']) { const r = await art.locator(sel).first().boundingBox(); assert.ok(r && r.y >= 0 && r.y < 800, `in the first screen: ${sel} at ${r?.y}`); }
  await shot('1-saved-source');
  // The check file through the pane's own entry (no version or origin: shown as not recorded).
  await page.keyboard.press('Escape'); await lens.locator('.rr-file-open').click(); await form.waitFor();
  await choose('test', fileOf('convert-test.log', CASE.TEST_FILE)); seq = (await entry(A)).seq; await saveAndWait(A, seq);
  const saved2 = (await entry(A)).project; assert.deepEqual(saved2.pasted.at(-1).evidence, CASE.TEST_META); assert.equal(saved2.pasted.at(-1).text, CASE.TEST_FILE);
  assert.ok((await lens.locator('article.rr-provided').innerText()).includes('기록 없음'));
  assert.equal(posts(), before1, 'choosing, refusing and saving files sent nothing');
  // Export (the home card's backup) and import it back as a copy; reload: the same bytes.
  await go(null); await ready();
  const dl = page.waitForEvent('download'); await page.locator(`#saved-list [data-run-entry="${A}"]`).locator('xpath=ancestor::article').locator('.program-backup').click();
  const exported = readFileSync(await (await dl).path(), 'utf8'), exp = V.parseBackup(exported).project;
  assert.deepEqual(exp, saved2, 'the backup holds texts, ids and declarations');
  const beforeReload = await rawEntry(A); await page.reload(); await ready(); assert.equal(await rawEntry(A), beforeReload, 'reload leaves the saved bytes as they were');
  await importFile('a-backup.json', exported); await page.waitForURL(u => /#\/p\/E_/.test(u) && !u.toString().includes(A)); const A2 = keyOf();
  assert.deepEqual((await entry(A2)).project.pasted, saved2.pasted, 'an imported copy keeps the declarations');
  evidence.paths['1-import-add-save-export'] = { imported13: true, schemaAfter: imported.schemaVersion, codeTextSha256: sha(code.text), bomKept: code.text.startsWith('﻿'), crlf: code.text.includes('\r\n'),
    evidence: code.evidence, refusedInvalidUtf8: true, aiPosts: posts() - before1, exportImportSame: true, reloadSameBytes: true };

  /* ---------- 2. duplicates (a new project B from the empty map's entry) ---------- */
  await go(null); await ready(); await page.locator('#new-open').click(); await page.locator('#new-name').fill('B 중복 경계');
  await page.locator('#new-form').getByRole('button', { name: '만들기' }).click(); await page.waitForURL(u => /#\/p\/E_/.test(u) && ![A, A2].some(k => u.toString().includes(k))); const B = keyOf();
  const space = page.locator('#space-empty'), T = CASE.TEST_FILE, before2 = posts();
  await space.getByRole('button', { name: '기록 붙여넣기' }).click(); await page.locator('#paste-text').fill(T); seq = (await entry(B)).seq;
  await lens.getByRole('button', { name: '기록 저장' }).click(); await page.waitForFunction(([w, k, s]) => JSON.parse(localStorage.getItem(w)).entries.find(e => e.entryId === k).seq > s, [W, B, seq]);
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await space.getByRole('button', { name: '코드·검사 자료 추가' }).click(); await form.waitFor();
  await choose('test', fileOf('same.log', T)); seq = (await entry(B)).seq; await saveAndWait(B, seq);
  let b = (await entry(B)).project; assert.equal(b.pasted.length, 2); assert.notEqual(b.pasted[0].id, b.pasted[1].id); assert.equal(b.pasted[0].evidence, undefined); assert.equal(b.pasted[1].text, b.pasted[0].text);
  // The same file, kind, name, version and origin again: told, nothing written.
  await page.keyboard.press('Escape'); await lens.locator('.rr-file-open').click(); await choose('test', fileOf('same.log', T));
  seq = (await entry(B)).seq; await lens.getByRole('button', { name: '자료 저장' }).click();
  await lens.getByText('새로 저장하지 않았어요').first().waitFor(); assert.equal((await entry(B)).seq, seq, 'no write');
  // Another declared version: another source.
  await page.keyboard.press('Escape'); await lens.locator('.rr-file-open').click(); await choose('test', fileOf('same.log', T)); await form.locator('#file-version').fill('run 2');
  await saveAndWait(B, seq); b = (await entry(B)).project; assert.equal(b.pasted.length, 3); assert.equal(b.pasted[2].evidence.version, 'run 2');
  // An ordinary paste of the same text finds the pasted record, never a provided one.
  await page.keyboard.press('Escape'); await lens.locator('.rr-paste-open').first().click(); await page.locator('#paste-text').fill(T); seq = (await entry(B)).seq;
  await lens.getByRole('button', { name: '기록 저장' }).click(); await lens.getByText('새로 저장하지 않았어요').first().waitFor(); assert.equal((await entry(B)).seq, seq);
  assert.equal(posts(), before2);
  evidence.paths['2-duplicates'] = { pastedAndProvidedSeparate: [b.pasted[0].id !== b.pasted[1].id, b.pasted[0].evidence === undefined], sameDeclarationNoWrite: true, otherVersionNew: true, pasteFindsPastedOnly: true, aiPosts: posts() - before2 };

  /* ---------- 3. both asks: provided sources are evidence, the old report stays pasted, the request whole ---------- */
  await go(A); await ready();
  const pa = (await entry(A)).project, scopes = frozenRequests(pa, [rq]), view = studioView(pa);
  const unread = M.buildMapAsk(pa, view, scopes, undefined, M.MAP6_SCHEMA), chosen = M.buildMapAsk(pa, view, scopes, rq.id, M.MAP6_SCHEMA);
  const kinds = inp => Object.fromEntries(inp.ask.records.map(r => [inp.records.get(r.id).id, r.kind]));
  for (const inp of [unread, chosen]) {
    assert.equal(kinds(inp)[code.id], 'evidence'); assert.equal(kinds(inp)[saved2.pasted.at(-1).id], 'evidence'); assert.equal(kinds(inp)[pa.pasted[1].id], 'pasted');
    for (const r of inp.ask.records) assert.equal(M.askRecords(inp.ask).get(r.id).text, pa.pasted.find(x => x.id === inp.records.get(r.id).id).text.slice(inp.records.get(r.id).from, inp.records.get(r.id).to));
    assert.deepEqual(inp.fullRequests, [rq]);
  }
  evidence.paths['3-asks'] = { unread: kinds(unread), selectedRq: kinds(chosen), requestWhole: true, rawSpansExact: true };

  /* ---------- 4. the request's own reading through the job: an unlawful wire is refused with its path, a lawful one applied explicitly ---------- */
  writeFileSync(join(ctl, 'reply-1.json'), JSON.stringify(CASE.replyFor(chosen.ask, { pastedCode: true })));
  writeFileSync(join(ctl, 'reply-2.json'), JSON.stringify(CASE.replyFor(chosen.ask)));
  const readRq = async () => { await page.locator('#plan-entry').click(); await page.getByRole('button', { name: /^돌아온 기록 · 요청문/ }).click(); await page.locator('.pp-results').getByRole('button', { name: '이 요청과 보고 읽기' }).click(); };
  const jobsBefore = api.filter(x => x === 'POST /api/studio/jobs').length, rawBefore4 = await rawEntry(A);
  await readRq();
  await page.waitForFunction(() => /응답|거절|읽지 못|형식/.test(document.querySelector('#world .map-title .mu-error, #world .mu-error, .mu-error')?.textContent ?? ''), null, { timeout: 30000 });
  const refusedText = await page.locator('.mu-error').first().innerText(); await shot('4-refused');
  assert.equal(await rawEntry(A), rawBefore4, 'a refused reply changes nothing');
  // The explicit gate: the person starts the request reading and leaves while it runs; the ready result waits (nothing applied)
  // until they come back and press '정리 결과 보기'. (A result back within the same visit is applied there: shown on B below.)
  await readRq(); await page.waitForFunction(() => document.body.textContent.includes('읽고'), null, { timeout: 5000 }).catch(() => {});
  await go(null); await ready();
  await page.locator(`#saved-list [data-run-entry="${A}"]`).getByText('지도 정리 결과 도착 · 열어서 보기').waitFor({ timeout: 30000 }); await shot('4-home-ready');
  assert.equal((await entry(A)).project.readings.length, imported.readings.length, 'ready, not applied while away');
  await go(A); await ready(); const applyBtn = page.locator('.mu-apply'); await applyBtn.waitFor(); const applyLabel = await applyBtn.innerText(); await shot('4-apply-button');
  assert.equal((await entry(A)).project.readings.length, imported.readings.length, 'still not applied on return');
  await applyBtn.click();
  await page.waitForFunction(([w, k, n]) => JSON.parse(localStorage.getItem(w)).entries.find(e => e.entryId === k).project.readings.length === n, [W, A, imported.readings.length + 1], { timeout: 30000 });
  const how = 'left-then-apply-button';
  await shot('4-applied');
  await page.reload(); await ready();
  const pr = (await entry(A)).project; V.parseProject(JSON.stringify(pr));
  const got = RR.requestMatches(pr).filter(x => x.reading === pr.readings.at(-1).id).map(x => [x.match.kind, x.match.record]);
  assert.deepEqual(got.filter(x => x[0] === 'code' || x[0] === 'test').map(x => x[1]).sort(), [code.id, saved2.pasted.at(-1).id].sort(), 'code/test on the provided sources');
  assert.deepEqual(pr.readings.slice(0, imported.readings.length), imported.readings, 'earlier readings unchanged');
  // The quote of the code match, from the part's request reading, and back to the same item, focus and scroll.
  const area = pr.space.areas[0].id; await page.locator(`#world .node[data-part="${area}"]`).click();
  const item = lens.locator('.request-item').first(); await item.locator(':scope > summary').click();
  const cite = item.locator('.cl-cite[title*="export function"]').first(); await cite.waitFor();
  const body = lens.locator('.lens-body'); await cite.scrollIntoViewIfNeeded(); await cite.focus();
  const scroll = await body.evaluate(e => e.scrollTop), url0 = page.url(), quote = await cite.getAttribute('title');
  await page.keyboard.press('Enter'); await lens.locator('.rr-mark').waitFor();
  assert.equal(await lens.locator('.rr-mark').innerText(), quote.replace(/\r\n/g, '\n'), 'the marked passage');
  assert.ok((await lens.locator('article.rr-provided').innerText()).includes('사용자 제공 코드 자료'), 'the provided source, not the old pasted report');
  await shot('4-quote');
  await lens.locator('.rr-back').click(); await item.waitFor();
  assert.equal(page.url(), url0); assert.ok(await cite.evaluate(e => e === document.activeElement), 'focus back on the quote'); assert.ok(Math.abs(await body.evaluate(e => e.scrollTop) - scroll) <= 1);
  const exported4 = await (async () => { await go(null); await ready(); const d = page.waitForEvent('download'); await page.locator(`#saved-list [data-run-entry="${A}"]`).locator('xpath=ancestor::article').locator('.program-backup').click(); return readFileSync(await (await d).path(), 'utf8'); })();
  assert.deepEqual(V.parseBackup(exported4).project, pr, 'backup keeps the reading with its quotes and the declarations');
  evidence.paths['4-job-apply-quote'] = { refusedFirst: refusedText, applied: how, applyButton: applyLabel, jobPosts: api.filter(x => x === 'POST /api/studio/jobs').length - jobsBefore, invocations: invocations(), matches: got, quoteRoundtrip: true, reloadParsed: true, backupKeeps: true };

  /* ---------- 5. legacy and rollback, failed attempts ---------- */
  await go(null); await ready();
  const smuggle = JSON.stringify({ ...raw13, pasted: [...raw13.pasted, { ...raw13.pasted[0], id: 'N_smuggled', text: 'x = 1\n', evidence: CASE.CODE_META }] }), allBefore = JSON.stringify(await entries());
  await page.locator('#import-file').setInputFiles({ name: 'smuggled13.json', mimeType: 'application/json', buffer: Buffer.from(smuggle) });
  await page.locator('#home-message').getByText('아무것도 바꾸지 않았').waitFor(); assert.equal(JSON.stringify(await entries()), allBefore, 'a project.13 file with a declaration is not taken in');
  await go(A); await ready(); const rawA = await rawEntry(A);
  // Failed attempts in the form: too large, control characters, key-like text, a key-like origin. Nothing changes; the form keeps the last good file.
  const openForm = async () => { if (!(await form.count())) { if (!(await lens.locator('.rr-file-open').count())) { await page.locator('#plan-entry').click(); await page.getByRole('button', { name: /^돌아온 기록 · 요청문/ }).click(); await page.locator('.pp-results').getByRole('button', { name: '코드·검사 자료 추가' }).click(); } else await lens.locator('.rr-file-open').click(); } await form.waitFor(); };
  await openForm(); await choose('code', fileOf('good.ts', 'export const good = 1;\n'));
  const fails = [];
  for (const [name, buffer, words] of [['big.ts', Buffer.alloc(180004, 0x61), 'KB를 넘어'], ['ctl.ts', Buffer.from('a\u0007b'), '제어 문자'], ['key.ts', Buffer.from(`k = "sk-${'E'.repeat(24)}"`), '키나 토큰']]) {
    await form.locator('#file-pick').setInputFiles({ name, mimeType: 'text/plain', buffer }); await form.getByRole('alert').getByText(words).waitFor(); fails.push(name);
    assert.equal(await form.locator('.rr-file-preview').evaluate(e => e.textContent), 'export const good = 1;\n', 'the last good file stays');
  }
  await form.locator('#file-origin').fill(`ghp_${'F'.repeat(30)}`); await lens.getByRole('button', { name: '자료 저장' }).click(); await form.getByRole('alert').getByText('출처는').waitFor(); fails.push('key-like origin');
  assert.equal(await rawEntry(A), rawA, 'failed attempts leave the project as it was');
  let rollback = null;
  if (PRE) {
    // The pre-114 reader on the project.14 bytes: refused as an unsupported schema; its store keeps the raw bytes, never resets them.
    const OV = await import(pathToFileURL(`${PRE}/shared/validation.js`).href), OS = await import(pathToFileURL(`${PRE}/shared/storage.js`).href);
    let code14 = null; try { OV.parseProject(JSON.stringify((await entry(A)).project)); } catch (e) { code14 = e.message; }
    const ws = await page.evaluate(w => localStorage.getItem(w), W), mem = new Map([[W, ws]]), kv = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: k => mem.delete(k), key: i => [...mem.keys()][i] ?? null, get length() { return mem.size; } };
    let opened = null; try { const st = new OS.WorkspaceStore(kv); opened = { entries: st.entries().length }; } catch (e) { opened = { error: e.message }; }
    rollback = { pre114ParseProject14: code14, pre114StoreOpen: opened, rawKept: mem.get(W) === ws };
    assert.equal(code14, 'UNSUPPORTED_SCHEMA'); assert.ok(rollback.rawKept);
  }
  evidence.paths['5-legacy-failed'] = { smuggled13Refused: true, failedAttempts: fails, projectUnchanged: true, rollback };

  /* ---------- 6. async ownership: a read in A finishes after a switch to B; nothing goes to B, A keeps the file ---------- */
  await page.evaluate(() => { const orig = File.prototype.arrayBuffer; window.__hold114 = new Promise(r => { window.__release114 = r; }); File.prototype.arrayBuffer = async function () { await window.__hold114; return orig.call(this); }; });
  await choose('test', fileOf('slow.log', 'slow check log\n')); await form.getByText('읽는 중…').waitFor();
  const rawB = await rawEntry(B), rawA6 = await rawEntry(A);
  await go(B); await ready(); await space.getByRole('button', { name: '기록 붙여넣기' }).click(); await page.locator('#paste-text').fill('B의 초안'); await page.locator('#paste-text').evaluate(e => e.setSelectionRange(1, 2));
  await page.evaluate(() => window.__release114()); await page.waitForTimeout(300);
  assert.equal(await page.locator('#paste-text').inputValue(), 'B의 초안'); assert.deepEqual(await page.locator('#paste-text').evaluate(e => [e.selectionStart, e.selectionEnd, document.activeElement === e]), [1, 2, true], 'B draft, selection and focus untouched');
  assert.equal(await rawEntry(B), rawB, 'nothing written to B'); assert.equal(await rawEntry(A), rawA6, 'nothing written to A either (not saved)');
  await page.keyboard.press('Escape'); await space.getByRole('button', { name: '코드·검사 자료 추가' }).click(); await form.waitFor();
  assert.equal(await form.locator('.rr-file-preview').count(), 0, "B's form has none of A's file");
  await page.keyboard.press('Escape'); await go(A); await ready(); await openForm();
  assert.equal(await form.locator('.rr-file-preview').evaluate(e => e.textContent), 'slow check log\n', 'A keeps the file read after the switch');
  // Review fix (72b7e79): a read still pending when an oversized file is chosen. The oversized one is refused before reading, the
  // form is no longer 'reading' (save stays possible) and the earlier read, when it ends, is ignored.
  await page.evaluate(() => { window.__hold114 = new Promise(r => { window.__release114 = r; }); });
  await form.locator('#file-pick').setInputFiles(fileOf('late.log', 'late log\n')); await form.getByText('읽는 중…').waitFor();
  await form.locator('#file-pick').setInputFiles({ name: 'huge.log', mimeType: 'text/plain', buffer: Buffer.alloc(180004, 0x61) }); await form.getByRole('alert').getByText('KB를 넘어').waitFor();
  assert.equal(await lens.getByRole('button', { name: '자료 저장' }).isDisabled(), false, 'not held as reading'); assert.equal(await form.locator('.rr-file-name').innerText(), 'slow.log');
  await page.evaluate(() => window.__release114()); await page.waitForTimeout(300);
  assert.equal(await form.locator('.rr-file-preview').evaluate(e => e.textContent), 'slow check log\n', 'the stale read is ignored');
  // Review fix (72b7e79): while the form is saved its inputs are locked (seen at the moment the button reads '저장 중…').
  await page.evaluate(() => { window.__lock114 = []; const o = new MutationObserver(() => { const b = [...document.querySelectorAll('#lens button')].find(x => x.textContent === '저장 중…'); if (b) window.__lock114.push(['#file-version', '#file-origin', '#file-pick', '#file-kind-code', '#file-kind-test'].every(q => document.querySelector(q)?.disabled)); }); o.observe(document.getElementById('lens'), { subtree: true, childList: true }); window.__lockObs = o; });
  // Keyboard only: kind, file already chosen, save; the source view and its way back.
  await form.locator('#file-kind-code').focus(); await page.keyboard.press('ArrowDown'); assert.ok(await form.locator('#file-kind-test').isChecked());
  await form.locator('#file-origin').fill(''); seq = (await entry(A)).seq;
  await lens.getByRole('button', { name: '자료 저장' }).focus(); await page.keyboard.press('Enter');
  await page.waitForFunction(([w, k, s]) => JSON.parse(localStorage.getItem(w)).entries.find(e => e.entryId === k).seq > s, [W, A, seq]);
  assert.equal((await entry(A)).project.pasted.at(-1).text, 'slow check log\n'); assert.equal((await entry(B)).project.pasted.length, 3, 'B still as it was');
  const lock = await page.evaluate(() => { window.__lockObs.disconnect(); return window.__lock114; }); assert.ok(lock.length > 0 && lock.every(Boolean), `inputs locked while saving: ${JSON.stringify(lock)}`);
  await lens.locator('article.rr-provided').waitFor(); await shot('6-saved-after-switch');
  evidence.paths['6-async-ownership'] = { readFinishedAfterSwitch: true, bUntouched: true, aKeptFile: true, pendingReadThenOversize: 'refused, not held reading, stale read ignored', lockedWhileSaving: lock.length, keyboardSave: true };

  // In-visit (separately, on B): a map reading started and finished in the same visit is applied there, as every map job is.
  await go(B); await ready(); const readingsB = (await entry(B)).project.readings.length;
  await space.locator('.se-run').click();
  await page.waitForFunction(([w, k, n]) => JSON.parse(localStorage.getItem(w)).entries.find(e => e.entryId === k).project.readings.length === n, [W, B, readingsB + 1], { timeout: 30000 });
  evidence.paths['4b-in-visit'] = { project: 'B', applied: 'in the same visit (stub first-map reply of the 102 fake CLI)', readings: readingsB + 1 };
  assert.deepEqual(errors, []);
  evidence.api = { posts: api.filter(x => x.startsWith('POST')), jobPosts: api.filter(x => x === 'POST /api/studio/jobs').length, directMap: api.filter(x => x.endsWith('/api/studio/map')).length, invocations: invocations() };
  assert.equal(evidence.api.directMap, 0); assert.equal(evidence.api.jobPosts, 3); assert.ok(evidence.api.posts.every(x => x === 'POST /api/studio/jobs' || x.startsWith('POST /api/studio/jobs/')), 'only the map jobs and their acks');
  writeFileSync(`${OUT}/ui114.json`, JSON.stringify(evidence, null, 2));
  console.log('ui114 passed', JSON.stringify(evidence.api));
} catch (e) { const pages = browser.contexts()[0]?.pages() ?? []; if (pages[0]) { await pages[0].screenshot({ path: `${OUT}/ui114-FAILED.png` }).catch(() => {}); writeFileSync(`${OUT}/ui114-FAILED.txt`, await pages[0].locator('#lens').innerText().catch(() => '')); } throw e; }
finally { await browser.close(); proc.kill(); }
