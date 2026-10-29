// AF97 map return flow, auxiliary Node Playwright mirror of studio_browser.py map97_flow (the CI path runs the Python one; same
// steps and checks, for a machine without Python Playwright):
//   node continuity/tests/map97-flow.mjs [shots-dir]        (from app/, after the continuity and app builds)
// Real local app and studio handler with the stubbed provider of studio-smoke-server; replies are the stub's ([스텁]), not a
// model's. Each of A's map requests is held in the browser and let through while the person is elsewhere:
//   1. on B with a long unsaved paste (backward selection, scrolled): B's paste, selection, scroll and focus stay as they were;
//   2. on B with its reading button focused: the same button keeps focus; A applies its result on return, asking nothing again;
//   3. at home typing a new project's name: A's card changes in place, the draft, focus and list stay;
//   4. saving held (the workspace lock taken in the page) while the person goes to B and back to A: no cancel while saving, and the
//      visit opened meanwhile takes the saved project, so the next edit saves without a conflict.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url)), APP = fileURLToPath(new URL('../..', import.meta.url));
const SHOTS = process.argv[2] ?? null; if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const A = 'E_flow97-aaaa-0001', B = 'E_flow97-bbbb-0002', W = 'agentflow.idea015.workspace';
// Built in the page with the app's own modules (the Python flow runs the same scripts, as text).
const SEED = async ([w, a, b]) => {
  const D = await import('./shared/domain.js'), S = await import('./shared/storage.js');
  const make = (name, text) => JSON.parse(S.serializeProject(D.pasteRecord(D.rename(D.createProject(), name), text, null).project));
  const entry = (entryId, project) => ({ entryId, state: 'active', lifecycle: 1, seq: 1, createdAt: new Date().toISOString(), trashedAt: null, origin: 'new', project });
  localStorage.setItem(w, JSON.stringify({ version: 'agentflow.workspace.1', migratedFromLegacy: false, entries: [
    entry(a, make('A 변환기', '요구: 폴더 안의 문서를 한 번에 변환한다.\n작업 보고: 변환기는 문서마다 PDF 하나를 만든다.')), entry(b, make('B 메모', '요구: B는 일정표를 보여 준다.'))] }));
};
const ADD = async ([w, k, text]) => {
  const D = await import('./shared/domain.js'), S = await import('./shared/storage.js');
  const env = JSON.parse(localStorage.getItem(w)), e = env.entries.find(x => x.entryId === k);
  e.project = JSON.parse(S.serializeProject(D.pasteRecord(e.project, text, null).project)); e.seq++; localStorage.setItem(w, JSON.stringify(env));
};
const STORED = ([w, k]) => JSON.parse(localStorage.getItem(w)).entries.find(e => e.entryId === k);
// B's unsaved paste as the person left it: its text, selection (with its direction), scroll, the pane's scroll and the focus.
const PASTE = () => { const t = document.getElementById('paste-text'), body = document.querySelector('#lens .lens-body');
  return { length: t.value.length, value: t.value, start: t.selectionStart, end: t.selectionEnd, direction: t.selectionDirection, scroll: t.scrollTop, pane: body ? body.scrollTop : null, focus: document.activeElement === t, same: t === window.__paste97 }; };
const SET_PASTE = () => { const t = document.getElementById('paste-text'); t.focus(); t.setSelectionRange(t.value.length - 48, t.value.length, 'backward'); t.scrollTop = t.scrollHeight;
  const body = document.querySelector('#lens .lens-body'); if (body) body.scrollTop = body.scrollHeight; window.__paste97 = t; };
const LONG = Array.from({ length: 60 }, (_, i) => `${String(i + 1).padStart(2, '0')} B의 미저장 붙여넣기: 일정표 화면의 주간 보기와 월간 보기를 견주어 적은 보고 문장입니다.`).join('\n');

function start() {
  const proc = spawn(process.execPath, [`${ROOT}tests/studio-smoke-server.mjs`], { cwd: APP, env: { ...process.env, STUDIO_STUB: 'ok', PORT: '0' }, stdio: ['ignore', 'pipe', 'inherit'] });
  return new Promise((res, rej) => { proc.stdout.once('data', d => { const m = /READY (http:\/\/\S+)/.exec(String(d)); m ? res({ proc, base: m[1] }) : rej(new Error(String(d))); }); proc.once('exit', c => rej(new Error(`server exit ${c}`))); });
}
const deferred = () => { let open; const promise = new Promise(r => { open = r; }); return { promise, open }; };

async function flow(browser, base, [w, hgt]) {
  const context = await browser.newContext({ viewport: { width: w, height: hgt } });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  const shot = async name => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/map97-${w}x${hgt}-${name}.png` }); };
  const stored = key => page.evaluate(STORED, [W, key]);
  const go = key => page.evaluate(k => { location.hash = k ? `#/p/${k}` : ''; }, key);
  // Projects open from a page that already has the server's status (a reload straight into a project draws its empty map first).
  const fresh = async () => { await go(null); await page.reload(); await page.waitForFunction(() => document.getElementById('ai-text')?.textContent === 'AI 정리 가능'); await page.waitForTimeout(100); };
  // Each map request waits in the browser until let through, then goes on to the real local server (its provider is the stub).
  let calls = 0; const gates = [deferred(), deferred(), deferred(), deferred()];
  await page.route('**/api/studio/map', async route => { const i = calls++; await gates[i].promise; await route.continue(); });
  const letThrough = async i => { const answered = page.waitForResponse(r => r.url().endsWith('/api/studio/map')); gates[i].open(); await answered; await page.waitForTimeout(300); };
  const space = page.locator('#space-empty'), line = page.locator('#world .map-understood'), card = page.locator(`#saved-list [data-run-entry="${A}"]`);
  const applyOnA = async n => { await go(A); await page.locator('.mu-apply').getByText('정리 결과 보기').waitFor(); await page.locator('.mu-apply').click();
    await page.waitForFunction(([w, k, n]) => JSON.parse(localStorage.getItem(w)).entries.find(e => e.entryId === k).project.readings.length === n, [W, A, n]); assert.equal(calls, n, 'applied without another request'); };
  await page.goto(base + '/'); await page.evaluate(SEED, [W, A, B]); await fresh();

  // 1. A asks; on B the person pastes a long record and selects its end backwards; A's reply comes in meanwhile.
  await go(A); await space.locator('.se-run').click(); await space.getByText('기록을 읽고 지도를 정리하는 중…').waitFor(); assert.equal(calls, 1);
  await go(B); await space.locator('.se-run').waitFor();
  assert.equal(await space.getByText('기록을 읽고 지도를 정리하는 중…').count(), 0, 'B shows nothing of A');
  await space.getByRole('button', { name: '기록 붙여넣기' }).click(); await page.locator('#paste-text').fill(LONG); await page.evaluate(SET_PASTE);
  const before = await page.evaluate(PASTE); assert.equal(before.direction, 'backward'); assert.ok(before.scroll > 0, 'the paste is scrolled');
  await letThrough(0);
  assert.deepEqual(await page.evaluate(PASTE), before, 'B\'s paste, selection, its direction, scroll and focus stay'); await shot('b-paste');
  assert.equal((await stored(A)).project.readings.length, 0, 'A not saved while away'); assert.equal((await stored(B)).seq, 1, 'B untouched');
  await go(null); await card.getByText('지도 정리 결과 도착 · 열어서 보기').waitFor();
  await go(A); assert.equal(await space.locator('.se-run').count(), 0, 'no ordinary reading button while a result is ready'); await shot('a-ready');
  await applyOnA(1); await page.locator('#world .node').first().waitFor(); assert.equal((await stored(A)).seq, 2);

  // 2. A asks again; on B the reading button has the focus when A's reply comes in.
  await page.evaluate(ADD, [W, A, '작업 보고: 폴더 입력은 다음 판에서 구현한다.']); await fresh();
  await go(A); await line.locator('.mu-run').click(); await line.getByText('기록을 읽고 지도를 갱신하는 중…').waitFor(); assert.equal(calls, 2);
  await go(B); await space.locator('.se-run').waitFor(); await page.evaluate(() => { const b = document.querySelector('#space-empty .se-run'); b.focus(); window.__button97 = b; });
  await letThrough(1);
  assert.ok(await page.evaluate(() => document.activeElement === window.__button97 && window.__button97.isConnected), 'B\'s reading button keeps the focus');
  await applyOnA(2);

  // 3. A asks again; at home the person types a new project's name when A's reply comes in.
  await page.evaluate(ADD, [W, A, '작업 보고: 결과 파일은 한 폴더에 모은다.']); await fresh();
  await go(A); await line.locator('.mu-run').click(); await line.getByText('기록을 읽고 지도를 갱신하는 중…').waitFor();
  await go(null); await card.getByText('지도 정리 중…').waitFor();
  assert.equal(await page.locator(`#saved-list [data-run-entry="${B}"]`).isHidden(), true, 'B has no reading of its own');
  await page.locator('#new-open').click(); await page.locator('#new-name').fill('작성 중인 이름');
  await page.evaluate(() => { window.__list97 = document.querySelector('#saved-list > li'); });
  await letThrough(2);
  await card.getByText('지도 정리 결과 도착 · 열어서 보기').waitFor(); await shot('home-ready');
  assert.equal(await page.locator('#new-name').inputValue(), '작성 중인 이름');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'new-name', 'focus kept');
  assert.ok(await page.evaluate(() => document.querySelector('#saved-list > li') === window.__list97), 'the home list is not drawn again');
  await applyOnA(3); assert.equal((await stored(A)).seq, 6);

  // 4. Saved while the person goes to B and back: the save is held by taking the workspace lock in the page.
  await page.evaluate(ADD, [W, A, '작업 보고: 변환 실패는 문서 이름과 함께 알린다.']); await fresh();
  await go(A);
  await page.evaluate(w => { window.__held = new Promise(r => { window.__release97 = r; }); void navigator.locks.request(w, () => window.__held); }, W);
  gates[3].open(); await line.locator('.mu-run').click();
  // The reply is back while A is still open in the same visit: it goes straight to saving, which the lock holds.
  await line.getByText('지도에 반영하는 중…').waitFor(); await shot('a-committing');
  assert.equal(await line.getByRole('button', { name: '취소' }).count(), 0, 'no cancel while saving');
  await go(B); await space.locator('.se-run').waitFor();
  await go(A); await page.locator('#world .node').first().waitFor();
  await page.evaluate(() => window.__release97());
  await page.waitForFunction(([w, k]) => JSON.parse(localStorage.getItem(w)).entries.find(e => e.entryId === k).project.readings.length === 4, [W, A]);
  await page.waitForFunction(() => !document.querySelector('#world .mu-committing'));
  // The visit opened during the save took the saved project: adding a part saves on top of it, with no conflict.
  await page.locator('#add-part').click(); await page.locator('#part-name').fill('직접 추가한 부분'); await page.locator('#part-form button[type=submit]').click();
  await page.waitForFunction(([w, k]) => JSON.parse(localStorage.getItem(w)).entries.find(e => e.entryId === k).project.space.areas.some(a => a.name === '직접 추가한 부분'), [W, A]);
  const last = await stored(A); assert.equal(last.project.readings.length, 4, 'the reading kept'); assert.equal(last.seq, 9); assert.equal(calls, 4);
  await shot('a-edited');
  assert.deepEqual(errors, []);
  await context.close();
  return { viewport: `${w}x${hgt}`, calls, seq: last.seq };
}

const browser = await chromium.launch(process.env.STUDIO_CHROMIUM ? { executablePath: process.env.STUDIO_CHROMIUM } : {});
const { proc, base } = await start();
try { for (const v of [[1280, 720], [1440, 900]]) console.log('map97 flow passed', JSON.stringify(await flow(browser, base, v))); }
finally { await browser.close(); proc.kill(); }
