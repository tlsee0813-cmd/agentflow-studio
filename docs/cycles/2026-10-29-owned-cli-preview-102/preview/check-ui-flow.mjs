// AF102 no-generation check of the real HTTP path and the normal UI: this cycle's launcher (real local app, studio handler, AF100
// job store, CLI executor) runs the harmless fake CLI of the app tests (no network, no model, no key). In Chromium:
//   A (records, no parts) is read into its first map with the ordinary button although the server has no DeepSeek key (ai off);
//   while the child runs the person edits project B and reloads the page; A's result comes back to A and is applied only there.
//   The other AI features stay off (no question button, the AI pill says no key). B is then read too (applied in place).
//   node docs/cycles/2026-10-29-owned-cli-preview-102/preview/check-ui-flow.mjs [shots-dir]     (from the repo root, after the builds)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const APP = fileURLToPath(new URL('../../../../app/', import.meta.url));
const { chromium } = createRequire(`${APP}package.json`)('playwright');
const FAKE = `${APP}continuity/tests/fake-cli102.mjs`, SHOTS = process.argv[2] ?? null; if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const A = 'E_flow102-aaaa-0001', B = 'E_flow102-bbbb-0002', W = 'agentflow.idea015.workspace';
const root = mkdtempSync(join(tmpdir(), 'af102-ui-')), ctl = join(root, 'ctl'); mkdirSync(ctl);
writeFileSync(join(ctl, 'mode'), 'delay:2500\nok');
writeFileSync(join(root, 'policy.json'), JSON.stringify({ executor: 'codex-cli-preview.102', exe: process.execPath, binarySha256: createHash('sha256').update(readFileSync(process.execPath)).digest('hex'),
  version: 'fake-cli 102-test', versionArgs: [FAKE, '--version', '--ctl', ctl], args: [FAKE, '--ctl', ctl, '--final', '{final}', '--cwd', '{cwd}', '--model', '{model}', '--reasoning', '{reasoning}'],
  model: 'fake-model-102', reasoning: 'high', selectionMs: 60000, verdictMs: 61000 }));
const invocations = () => existsSync(join(ctl, 'invocations')) ? readFileSync(join(ctl, 'invocations'), 'utf8').split('\n').filter(Boolean).length : 0;

const SEED = async ([w, a, b]) => {
  const D = await import('./shared/domain.js'), S = await import('./shared/storage.js');
  const make = (name, text) => JSON.parse(S.serializeProject(D.pasteRecord(D.rename(D.createProject(), name), text, null).project));
  const entry = (entryId, project) => ({ entryId, state: 'active', lifecycle: 1, seq: 1, createdAt: new Date().toISOString(), trashedAt: null, origin: 'new', project });
  localStorage.setItem(w, JSON.stringify({ version: 'agentflow.workspace.1', migratedFromLegacy: false, entries: [
    entry(a, make('A 변환기', '요구: 폴더 안의 문서를 한 번에 변환한다.\n작업 보고: 변환기는 문서마다 PDF 하나를 만든다.')), entry(b, make('B 일정표', '요구: B는 일정표를 보여 준다.'))] }));
};
const STORED = ([w, k]) => JSON.parse(localStorage.getItem(w)).entries.find(e => e.entryId === k);

const proc = spawn(process.execPath, [fileURLToPath(new URL('./serve-preview.mjs', import.meta.url)), '--policy', join(root, 'policy.json'), '--state', join(root, 'state')],
  { cwd: APP, env: { ...process.env, PORT: '0', STUDIO_JOBS_DIR: join(root, 'jobs'), DEEPSEEK_API_KEY: '' }, stdio: ['ignore', 'pipe', 'inherit'] });
const base = await new Promise((res, rej) => { let out = ''; proc.stdout.on('data', d => { out += d; const m = /READY (http:\/\/\S+) jobs=durable executor=ready/.exec(out); if (m) res(m[1]); }); proc.once('exit', c => rej(new Error(`launcher exit ${c}`))); });
const browser = await chromium.launch(process.env.STUDIO_CHROMIUM ? { executablePath: process.env.STUDIO_CHROMIUM } : {});
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } }), page = await context.newPage(), errors = [], sent = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('request', r => { const u = new URL(r.url()); if (u.pathname.startsWith('/api/')) sent.push(`${r.method()} ${u.pathname}`); });
  const shot = async n => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/ui102-${n}.png` }); };
  const go = key => page.evaluate(k => { location.hash = k ? `#/p/${k}` : ''; }, key);
  const space = page.locator('#space-empty'), card = page.locator(`#saved-list [data-run-entry="${A}"]`);
  const ready = async () => { await page.waitForFunction(() => ['AI 키 없음', 'AI 정리 가능', '지도 정리만 가능'].includes(document.getElementById('ai-text')?.textContent ?? '')); await page.waitForTimeout(100); };
  await page.goto(`${base}/`); await page.evaluate(SEED, [W, A, B]); await page.reload(); await ready();
  assert.equal(await page.locator('#ai-text').textContent(), '지도 정리만 가능', 'map-only: the executor is not shown as DeepSeek');
  assert.equal(await page.locator('#ai-pill').getAttribute('data-state'), 'map');

  // A: the ordinary first-map button works through the executor.
  await go(A); await space.locator('.se-run').click(); await space.getByText('기록을 읽고 지도를 정리하는 중…').waitFor();
  await page.waitForFunction(() => document.body.textContent.includes('창을 닫아도'), null, { timeout: 5000 }).catch(() => {});
  await shot('a-running');
  // Meanwhile: B is edited (a record pasted and saved) and the page is reloaded.
  await go(B); await space.locator('.se-run').waitFor();
  assert.equal(await space.getByText('기록을 읽고 지도를 정리하는 중…').count(), 0, 'B shows nothing of A');
  await space.getByRole('button', { name: '기록 붙여넣기' }).click(); await page.locator('#paste-text').fill('작업 보고: B 일정표는 주간 보기를 먼저 만든다.');
  await page.locator('#lens').getByRole('button', { name: '기록 저장' }).click();
  await page.waitForFunction(([w, k]) => JSON.parse(localStorage.getItem(w)).entries.find(e => e.entryId === k).seq === 2, [W, B]);
  await go(null); await page.reload(); await ready();
  await card.getByText('지도 정리 결과 도착 · 열어서 보기').waitFor({ timeout: 20000 }); await shot('home-ready');
  assert.equal((await page.evaluate(STORED, [W, A])).project.readings.length, 0, 'not applied while away');
  assert.equal((await page.evaluate(STORED, [W, B])).project.readings.length, 0, 'B untouched by A');
  await go(A); await page.locator('.mu-apply').getByText('정리 결과 보기').waitFor(); await page.locator('.mu-apply').click();
  await page.waitForFunction(([w, k]) => JSON.parse(localStorage.getItem(w)).entries.find(e => e.entryId === k).project.readings.length === 1, [W, A]);
  await page.locator('#world .node').first().waitFor(); await shot('a-applied');
  const a = await page.evaluate(STORED, [W, A]), reading = a.project.readings[0];
  assert.deepEqual([reading.model, reading.prompt], ['fake-model-102', 'm6-943df4fe3fd6']);
  assert.ok(a.project.space.areas.some(x => x.name === '가짜 부분 1'));
  assert.equal(await page.getByRole('button', { name: '질문하기' }).count(), 0, 'questions keep the DeepSeek condition (off)');

  // B: read in place (the same visit applies it).
  await go(B); await space.locator('.se-run').click();
  await page.waitForFunction(([w, k]) => JSON.parse(localStorage.getItem(w)).entries.find(e => e.entryId === k).project.readings.length === 1, [W, B], { timeout: 20000 });
  assert.equal(invocations(), 2, 'one child per reading, none again after the reload');
  assert.ok(!sent.some(s => s.endsWith('/api/studio/map')), 'never the direct map route');
  assert.deepEqual(errors, []);
  console.log('ui102 flow passed', JSON.stringify({ invocations: invocations(), jobPosts: sent.filter(s => s === 'POST /api/studio/jobs').length, readingsA: 1, readingsB: 1 }));
  await context.close();
} finally { await browser.close(); proc.kill(); }
