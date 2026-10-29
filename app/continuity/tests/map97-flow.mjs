// AF97 map return flow (Node Playwright, real local app and studio handler with the stubbed provider of studio-smoke-server):
//   node continuity/tests/map97-flow.mjs [shots-dir]        (from app/, after the continuity and app builds)
// A reading asked in project A; the person goes home (typing a new project's name) and reads project B while the reply comes in;
// A's reply waits for A, the home card says so in place, and applying it on return asks nothing again. Then the save is held
// (the workspace lock taken in the page) while the person goes to B and back to A: no cancel while saving, and the visit opened
// meanwhile takes the saved project, so the next edit saves without a conflict. Replies are the stub's ([스텁]), not a model's.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import { serializeProject } from '../dist/public/shared/storage.js';

const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url)), APP = fileURLToPath(new URL('../..', import.meta.url));
const SHOTS = process.argv[2] ?? null; if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const A = 'E_flow97-aaaa-0001', B = 'E_flow97-bbbb-0002';
const projectA = D.pasteRecord(D.rename(D.createProject(), 'A 변환기'), '요구: 폴더 안의 문서를 한 번에 변환한다.\n작업 보고: 변환기는 문서마다 PDF 하나를 만든다.', null).project;
const projectB = D.pasteRecord(D.rename(D.createProject(), 'B 메모'), '요구: B는 일정표를 보여 준다.', null).project;
const entry = (entryId, p) => ({ entryId, state: 'active', lifecycle: 1, seq: 1, createdAt: '2026-10-29T00:00:00.000Z', trashedAt: null, origin: 'new', project: JSON.parse(serializeProject(p)) });
const ENVELOPE = JSON.stringify({ version: 'agentflow.workspace.1', migratedFromLegacy: false, entries: [entry(A, projectA), entry(B, projectB)] });

function start() {
  const proc = spawn(process.execPath, [`${ROOT}tests/studio-smoke-server.mjs`], { cwd: APP, env: { ...process.env, STUDIO_STUB: 'ok', PORT: '0' }, stdio: ['ignore', 'pipe', 'inherit'] });
  return new Promise((res, rej) => { proc.stdout.once('data', d => { const m = /READY (http:\/\/\S+)/.exec(String(d)); m ? res({ proc, base: m[1] }) : rej(new Error(String(d))); }); proc.once('exit', c => rej(new Error(`server exit ${c}`))); });
}

async function flow(browser, base, [w, hgt]) {
  const context = await browser.newContext({ viewport: { width: w, height: hgt } });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  const shot = async name => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/map97-${w}x${hgt}-${name}.png` }); };
  const stored = key => page.evaluate(k => JSON.parse(localStorage.getItem('agentflow.idea015.workspace')).entries.find(e => e.entryId === k), key);
  await page.goto(base + '/');
  await page.evaluate(env => localStorage.setItem('agentflow.idea015.workspace', env), ENVELOPE);
  // Map requests are held in the browser until released, then go on to the real local server (its provider is the stub).
  let calls = 0, release = null; const held = new Promise(r => { release = r; });
  await page.route('**/api/studio/map', async route => { calls++; await held; await route.continue(); });
  // Projects open from a page that already has the server's status (a reload straight into a project draws its empty map first).
  const go = key => page.evaluate(k => { location.hash = k ? `#/p/${k}` : ''; }, key);
  const fresh = async () => { await page.reload(); await page.waitForFunction(() => document.getElementById('ai-text')?.textContent === 'AI 정리 가능'); await page.waitForTimeout(100); };
  await fresh(); await go(A);
  const space = page.locator('#space-empty');
  await space.locator('.se-run').click();
  await space.getByText('기록을 읽고 지도를 정리하는 중…').waitFor();
  assert.equal(calls, 1);
  // Home: the card for A says a reading is under way.
  await go(null);
  const card = page.locator(`#saved-list [data-run-entry="${A}"]`);
  await card.getByText('지도 정리 중…').waitFor();
  assert.equal(await page.locator(`#saved-list [data-run-entry="${B}"]`).isHidden(), true, 'B has no reading of its own');
  // B: A's reading is not shown here.
  await go(B); await space.locator('.se-run').waitFor();
  assert.equal(await space.getByText('기록을 읽고 지도를 정리하는 중…').count(), 0, 'B shows nothing of A');
  // Home with a draft name and its focus; the reply comes in now: the card changes in place, the draft and focus stay.
  await go(null);
  await page.locator('#new-open').click(); await page.locator('#new-name').fill('작성 중인 이름');
  const homeList = await page.evaluate(() => { window.__list97 = document.querySelector('#saved-list > li'); return true; });
  release();
  await card.getByText('지도 정리 결과 도착 · 열어서 보기').waitFor(); await shot('home-ready');
  assert.equal(await page.locator('#new-name').inputValue(), '작성 중인 이름');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'new-name', 'focus kept');
  assert.ok(homeList && await page.evaluate(() => document.querySelector('#saved-list > li') === window.__list97), 'the home list is not drawn again');
  assert.equal((await stored(A)).project.readings.length, 0, 'A not saved while away');
  assert.equal((await stored(B)).seq, 1, 'B untouched');
  await go(B); await space.locator('.se-run').waitFor(); assert.equal(await space.locator('.mu-apply').count(), 0, 'nothing to apply on B');
  // A again: the result waits there; applying it asks nothing.
  await go(A);
  await space.locator('.mu-apply').getByText('정리 결과 보기').waitFor(); await shot('a-ready');
  assert.equal(await space.locator('.se-run').count(), 0, 'no ordinary reading button while a result is ready');
  await space.locator('.mu-apply').click();
  await page.locator('#world .node').first().waitFor();
  assert.equal(calls, 1, 'applied without another request');
  const savedA = await stored(A); assert.equal(savedA.project.readings.length, 1); assert.equal(savedA.seq, 2);
  await shot('a-applied');

  // A second reading on A, saved while the person goes to B and back: the save is held by taking the workspace lock in the page.
  const more = JSON.parse(serializeProject(D.pasteRecord((await stored(A)).project, '작업 보고: 폴더 입력은 다음 판에서 구현한다.', null).project));
  await page.evaluate(([k, p]) => { const env = JSON.parse(localStorage.getItem('agentflow.idea015.workspace')), e = env.entries.find(x => x.entryId === k);
    e.project = p; e.seq++; localStorage.setItem('agentflow.idea015.workspace', JSON.stringify(env)); }, [A, more]);
  await go(null); await fresh(); await go(A);
  const line = page.locator('#world .map-understood');
  await page.evaluate(() => { window.__held = new Promise(r => { window.__release97 = r; }); void navigator.locks.request('agentflow.idea015.workspace', () => window.__held); });
  // The reply comes back while A is still open in the same visit: it goes straight to saving, which the lock holds.
  await line.locator('.mu-run').click();
  await line.getByText('지도에 반영하는 중…').waitFor(); await shot('a-committing');
  assert.equal(await line.getByRole('button', { name: '취소' }).count(), 0, 'no cancel while saving');
  await go(B); await space.locator('.se-run').waitFor();
  await go(A); await page.locator('#world .node').first().waitFor();
  await page.evaluate(() => window.__release97());
  await page.waitForFunction(k => JSON.parse(localStorage.getItem('agentflow.idea015.workspace')).entries.find(e => e.entryId === k).project.readings.length === 2, A);
  await page.waitForFunction(() => !document.querySelector('#world .mu-committing'));
  assert.equal(calls, 2);
  // The visit opened during the save took the saved project: adding a part saves on top of it, with no conflict.
  await page.locator('#add-part').click(); await page.locator('#part-name').fill('직접 추가한 부분'); await page.locator('#part-form button[type=submit]').click();
  await page.waitForFunction(k => JSON.parse(localStorage.getItem('agentflow.idea015.workspace')).entries.find(e => e.entryId === k).project.space.areas.some(a => a.name === '직접 추가한 부분'), A);
  const last = await stored(A); assert.equal(last.project.readings.length, 2, 'the reading kept'); assert.equal(last.seq, 5);
  await shot('a-edited');
  assert.deepEqual(errors, []);
  await context.close();
  return { viewport: `${w}x${hgt}`, calls, seq: last.seq };
}

const browser = await chromium.launch(process.env.STUDIO_CHROMIUM ? { executablePath: process.env.STUDIO_CHROMIUM } : {});
const { proc, base } = await start();
try { for (const v of [[1366, 768], [1920, 1080]]) console.log('map97 flow passed', JSON.stringify(await flow(browser, base, v))); }
finally { await browser.close(); proc.kill(); }
