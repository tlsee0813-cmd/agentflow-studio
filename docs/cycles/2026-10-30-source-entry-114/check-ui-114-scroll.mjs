// AF114 targeted 1280x800 check of where a new view starts in the return pane (model-free, no AI request). The pane keeps its scroll
// across renders; a provided source opened as itself (from a long list, or right after saving) and the file form start at their
// head, while the way back returns the reading to where it was. Quote entries keep their centring (check-ui-114.mjs path 4).
//   node docs/cycles/2026-10-30-source-entry-114/check-ui-114-scroll.mjs <evidence-dir>    (from the repo root, after the builds)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const APP = fileURLToPath(new URL('../../../app/', import.meta.url)), DIST = `${APP}continuity/dist/public/`;
const { chromium } = createRequire(`${APP}package.json`)('playwright');
const OUT = resolve(process.argv[2] ?? 'evidence-114'); mkdirSync(OUT, { recursive: true });
const D = await import(`${DIST}shared/domain.js`), S = await import(`${DIST}shared/storage.js`);
const code = name => `// ${name}\r\n${Array.from({ length: 90 }, (_, i) => `export const label${i} = lookup('key-${i}'); // line ${i}`).join('\r\n')}\r\n`;
const report = i => `작업 보고 ${i}: 이 보고는 긴 목록을 만들기 위한 작성자 예시 기록이며 실제 보고가 아니에요. 줄을 넘겨 두 줄로 보이도록 길게 씁니다 (${i}).\n본문 ${i}`;
// Oldest first: a provided source at the bottom of the full list, many pasted reports, a provided source fourth in the short list.
let p = D.rename(D.createProject(), '스크롤 114');
p = D.provideRecord(p, code('label-lookup.js'), { kind: 'code', name: 'label-lookup.js', version: 'v1.4.0 (40자 판본 예시입니다 · 사용자 기재 값)', origin: 'https://github.com/example/labels/blob/0123456789abcdef0123456789abcdef01234567/src/label-lookup.js' }, null).project;
for (let i = 0; i < 16; i++) p = D.pasteRecord(p, report(i), null).project;
p = D.provideRecord(p, code('near.js'), { kind: 'code', name: 'near.js', version: null, origin: null }, null).project;
for (let i = 16; i < 19; i++) p = D.pasteRecord(p, report(i), null).project;
const backup = S.serializeBackup(p, null);

const root = mkdtempSync(join(tmpdir(), 'af114-scroll-'));
const proc = spawn(process.execPath, [fileURLToPath(new URL('../2026-10-29-owned-cli-preview-102/preview/serve-preview.mjs', import.meta.url)), '--executor', 'off'],
  { cwd: APP, env: { ...process.env, PORT: '0', STUDIO_JOBS_DIR: join(root, 'jobs'), DEEPSEEK_API_KEY: '' }, stdio: ['ignore', 'pipe', 'inherit'] });
const base = await new Promise((res, rej) => { let out = ''; proc.stdout.on('data', d => { out += d; const m = /READY (http:\/\/\S+)/.exec(out); if (m) res(m[1]); }); proc.once('exit', c => rej(new Error(`server exit ${c}`))); });
const browser = await chromium.launch(process.env.STUDIO_CHROMIUM ? { executablePath: process.env.STUDIO_CHROMIUM } : {});
const result = {};
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage(), errors = [], posts = [];
  page.on('pageerror', e => errors.push(String(e))); page.on('request', r => { if (r.method() === 'POST' && r.url().includes('/api/')) posts.push(r.url()); });
  const lens = page.locator('#lens'), body = lens.locator('.lens-body'), top = () => body.evaluate(e => e.scrollTop);
  const inFirstScreen = async loc => { const r = await loc.boundingBox(), h = page.viewportSize().height; return !!r && r.y >= 0 && r.y + 10 < h; };
  const head = async name => { const art = lens.locator('article.rr-provided'); await art.waitFor(); assert.equal(await art.locator('h3').innerText(), name);
    for (const sel of ['h3', '.rr-provided-note', '.rr-origin']) assert.ok(await inFirstScreen(art.locator(sel)), `${name}: ${sel} in the first screen`); };
  await page.goto(`${base}/`); await page.waitForFunction(() => !!document.getElementById('ai-text')?.textContent);
  await page.locator('#import-file').setInputFiles({ name: 'scroll114.json', mimeType: 'application/json', buffer: Buffer.from(backup) }); await page.waitForURL(/#\/p\/E_/);
  await page.getByRole('button', { name: '돌아와 읽기' }).first().click(); await lens.locator('.rr-material').waitFor();

  // 1. The short list in the reading, scrolled: the provided source opens at its head; back returns the reading where it was. The
  // reading fits 800 px, so this section alone runs 1280x520 to give the way back a place other than 0.
  await page.setViewportSize({ width: 1280, height: 520 }); await page.waitForTimeout(200);
  await body.evaluate(e => { e.scrollTop = e.scrollHeight; }); const readingAt = await top(); assert.ok(readingAt > 0, `the reading scrolls at 520 (${readingAt})`);
  await lens.locator('.rr-material .rr-src', { hasText: 'near.js' }).click(); await head('near.js'); const opened1 = await top();
  await page.screenshot({ path: `${OUT}/ui114-scroll-1-near.png` });
  await lens.locator('.rr-back').click(); await lens.locator('.rr-material').waitFor(); const back1 = await top();
  assert.equal(opened1, 0); assert.ok(Math.abs(back1 - readingAt) <= 1, `reading back at ${readingAt}, got ${back1}`);
  await page.setViewportSize({ width: 1280, height: 800 }); await page.waitForTimeout(200);
  result.readingList = { viewport: '1280x520', readingScrolledTo: readingAt, sourceOpenedAt: opened1, backTo: back1 };

  // 2. The full list scrolled to its end: label-lookup.js (the oldest) opens at its head, not mid-code.
  await lens.getByRole('button', { name: /개 모두 보기/ }).click(); await lens.locator('.rr-src', { hasText: 'label-lookup.js' }).waitFor();
  await body.evaluate(e => { e.scrollTop = e.scrollHeight; }); const listAt = await top(); assert.ok(listAt > 300, `a long list (${listAt})`);
  const item = lens.locator('.rr-src', { hasText: 'label-lookup.js' }); assert.ok(await inFirstScreen(item), 'the item is where the person clicks it');
  await item.click(); await head('label-lookup.js'); const opened2 = await top();
  await page.screenshot({ path: `${OUT}/ui114-scroll-2-label-lookup.png` });
  assert.equal(opened2, 0);
  await lens.locator('.rr-back').click(); await lens.locator('.rr-material').waitFor(); const back2 = await top();
  result.fullList = { listScrolledTo: listAt, sourceOpenedAt: opened2, backTo: back2 };

  // 3. The file form, scrolled, then saved: the form starts at its head; the saved source opens at its head; back to the reading.
  await body.evaluate(e => { e.scrollTop = e.scrollHeight; }); const before3 = await top();
  await lens.locator('.rr-file-open').click(); await lens.locator('.rr-file-box').waitFor(); const formAt = await top();
  assert.equal(formAt, 0, 'the form starts at its head'); assert.ok(await inFirstScreen(lens.locator('.rr-file-box h3')));
  await lens.locator('#file-kind-code').check();
  await lens.locator('#file-pick').setInputFiles({ name: 'label-lookup.js', mimeType: 'text/javascript', buffer: Buffer.from(code('label-lookup.js 2')) });
  await lens.locator('.rr-file-preview').waitFor(); await lens.locator('#file-version').fill('v1.5.0');
  await body.evaluate(e => { e.scrollTop = e.scrollHeight; }); const formScrolled = await top(); assert.ok(formScrolled > 0, `the form scrolls (${formScrolled})`);
  // Another file in the same form re-renders it twice (reading, read): an ordinary render keeps the place, nothing resets it.
  await lens.locator('#file-pick').setInputFiles({ name: 'label-lookup.js', mimeType: 'text/javascript', buffer: Buffer.from(code('label-lookup.js 3')) });
  await page.waitForFunction(() => document.querySelector('#lens .rr-file-preview')?.textContent.startsWith('// label-lookup.js 3')); const rerendered = await top();
  assert.ok(Math.abs(rerendered - formScrolled) <= 1, `a re-render keeps the scroll (${formScrolled} → ${rerendered})`);
  await lens.getByRole('button', { name: '자료 저장' }).click(); await head('label-lookup.js'); const saved = await top();
  assert.ok((await lens.locator('article.rr-provided').innerText()).includes('v1.5.0'), 'the saved one');
  await page.screenshot({ path: `${OUT}/ui114-scroll-3-saved.png` });
  assert.equal(saved, 0);
  await lens.locator('.rr-back').click(); await lens.locator('.rr-material').waitFor(); const back3 = await top();
  result.fileForm = { readingBefore: before3, formOpenedAt: formAt, formScrolledTo: formScrolled, afterRerender: rerendered, savedOpenedAt: saved, backTo: back3 };
  assert.ok(Math.abs(back3 - before3) <= 1, `reading back at ${before3}, got ${back3}`);
  assert.deepEqual(errors, []); assert.deepEqual(posts, [], 'no AI or job request');
  writeFileSync(`${OUT}/ui114-scroll.json`, JSON.stringify({ at: new Date().toISOString(), viewport: '1280x800', ...result, aiRequests: posts.length }, null, 2));
  console.log('ui114 scroll passed', JSON.stringify(result));
} finally { await browser.close(); proc.kill(); }
