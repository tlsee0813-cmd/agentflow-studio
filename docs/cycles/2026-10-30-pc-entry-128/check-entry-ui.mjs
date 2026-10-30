// AF128 control fixture (not real-PC evidence): the PC entry's own host (scripts/pc-entry.mjs serve) with a fake binary standing in
// for codex.exe (a copy of this Node binary; the 102 tests' harmless fake CLI answers; no network, no model, no key). In Chromium:
// the header says map readings only (no DeepSeek key) with the executor's scope; a new project is made in the normal UI, a record
// pasted and saved, and the ordinary first-map button is there to press (it is not pressed: nothing is generated). Then the entry
// is stopped in order, started again on the same address, and the project and its record are still there.
//   node docs/cycles/2026-10-30-pc-entry-128/check-entry-ui.mjs [shots-dir]     (from the repo root, after the continuity build)
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const APP = fileURLToPath(new URL('../../../app/', import.meta.url));
const { chromium } = createRequire(`${APP}package.json`)('playwright');
const { FIXED_POLICY, serve, stop, check } = await import(`${APP}continuity/scripts/pc-entry.mjs`);
const FAKE = `${APP}continuity/tests/fake-cli102.mjs`, SHOTS = process.argv[2] ?? null; if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const root = mkdtempSync(join(tmpdir(), 'af128-ui-')), ctl = join(root, 'ctl'), data = join(root, 'data'); mkdirSync(ctl); mkdirSync(data);
const exe = join(root, process.platform === 'win32' ? 'codex.exe' : 'codex'); copyFileSync(process.execPath, exe);
const fixed = { ...FIXED_POLICY, binarySha256: createHash('sha256').update(readFileSync(process.execPath)).digest('hex'), version: 'fake-cli 102-test', versionArgs: [FAKE, '--version', '--ctl', ctl],
  args: [FAKE, '--ctl', ctl, '--final', '{final}', '--cwd', '{cwd}', '--model', '{model}', '--reasoning', '{reasoning}'], selectionMs: 20000, verdictMs: 21000 };
const port = await new Promise(r => { const s = createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const up = () => serve({ port, policy: { ...fixed, exe }, data, env: {}, log: () => {}, pollMs: 50, exit: () => {} });
const base = `http://127.0.0.1:${port}`, children = () => existsSync(join(ctl, 'invocations')) ? 1 : 0;
let host = await up();
const browser = await chromium.launch(process.env.STUDIO_CHROMIUM ? { executablePath: process.env.STUDIO_CHROMIUM } : {});
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } }), page = await context.newPage(), errors = [], sent = [];
  page.on('pageerror', e => errors.push(String(e))); page.on('request', q => { const u = new URL(q.url()); if (u.pathname.startsWith('/api/')) sent.push(`${q.method()} ${u.pathname}`); });
  const shot = async n => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/entry128-${n}.png` }); };
  await page.goto(`${base}/`);
  await page.waitForFunction(() => document.getElementById('ai-text')?.textContent === '지도 정리만 가능');
  const title = await page.locator('#ai-pill').getAttribute('title');
  assert.match(title, /질문·계획·결과 정리는 서버에 AI 키가 없어 꺼져 있어요/); assert.match(title, /fake|gpt-6\.1-sol/); assert.match(title, /첫 지도와 이후 기록·요청 대조까지/);
  await page.locator('#new-open').click(); await page.locator('#new-name').fill('PC 입구 확인');
  await page.locator('#new-form').getByRole('button', { name: '만들기' }).click(); await page.waitForURL(/#\/p\/E_/);
  const space = page.locator('#space-empty');
  await space.getByRole('button', { name: '기록 붙여넣기' }).click();
  await page.locator('#paste-text').fill('요구: 폴더 안의 문서를 한 번에 변환한다.\n작업 보고: 변환기는 문서마다 PDF 하나를 만든다.');
  await page.locator('#lens').getByRole('button', { name: '기록 저장' }).click();
  const run = space.locator('.se-run'); await run.waitFor();
  assert.equal(await run.textContent(), '기록으로 지도 정리'); assert.ok(await run.isEnabled(), 'the first-map button can be pressed');
  assert.equal(await page.getByRole('button', { name: '질문하기' }).count(), 0, 'questions keep the DeepSeek condition (off)');
  await shot('ready-to-read');
  const url = page.url();
  // Orderly stop through the entry's own request, then the same address again: the project and its record are still there.
  const s = await stop({ port, explicit: exe, data, fixed }); assert.equal(s.why, 'STOPPED');
  host = await up(); await page.goto(url);
  await page.waitForFunction(() => document.getElementById('ai-text')?.textContent === '지도 정리만 가능');
  await space.locator('.se-run').waitFor(); await shot('reopened');
  const c = await check({ port, explicit: exe, data, fixed }); assert.equal(c.port, 'ours');
  assert.equal(children(), 0, 'no child: nothing was generated'); assert.ok(!sent.some(x => x === 'POST /api/studio/jobs'), 'no job was submitted');
  assert.deepEqual(errors, []);
  console.log('entry128 ui passed', JSON.stringify({ port: 'ours-after-reopen', jobPosts: 0, children: 0 }));
  await context.close();
} finally { await browser.close(); await host?.stop?.(); }
