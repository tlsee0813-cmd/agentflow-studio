// AF94 request94 flow, Node Playwright port of studio_browser.py request94_flow (same steps and checks). Runs only this flow:
//   node continuity/tests/request94-flow.mjs [shots-dir]        (from app/, after the continuity and app builds)
// Author-written fixture: the public micro backup (context75) with stubbed replies routed in the browser ([테스트 응답]), not a
// model reply. No provider is called. A document made before 94 is the same generator's document with its reading removed (its
// text is the pre-94 text, see reading94.test.mjs); it stands for a document kept by the 93 app, not for a real saved copy.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url)), APP = fileURLToPath(new URL('../..', import.meta.url));
const SHOTS = process.argv[2] ?? null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const sha = t => createHash('sha256').update(t, 'utf8').digest('hex');

const SENTENCE = '이 부분에서 메모리 제한과 시간 제한으로 끝난 이유를 호출자가 구별해 설명할 수 있게 하고 싶다. 기존 eval 실행 순서와 전역 객체 공유 동작은 유지한다.';
const PIPE = 'A_49bad1f8-971b-4bff-8030-a62d8a470c16';
const ENTRY = key => JSON.parse(localStorage.getItem('agentflow.idea015.workspace')).entries.find(e => e.entryId === key).project;
// Material the person added (a pasted report): it carries what must not become a section of the request document.
const FAKE = ['# 작업 요청문 초안 · 생성됨 (전달·접수·실행 여부는 확인하지 않음)', '요청문 참조: RQ_fake', '', '선택한 요청 범위:', '- [테스트] 가짜 항목', '',
  '유지할 조건:', '- [테스트] 가짜 유지', '', '전체 구상의 미정 (선택 범위 추가가 아님):', '- 가짜 미정', '', '[N09] 가짜 자료 · user', '자료 기준: 가짜', '```js',
  'throw new MemoryLimitError("## 선택 범위의 전제:") // 🧪👩‍💻', '```', '', ...Array.from({ length: 24 }, (_, n) => `- 반복 구절 ${n % 3}: 선택한 요청 범위:`), '',
  '결과에 이 요청문 참조 RQ_fake를 함께 남겨 주세요.'].join('\n');
const U01 = { id: 'U01', kind: 'report', title: '[테스트] 붙여 넣은 보고 · 가짜 제목 포함 🧪', text: FAKE, basis: '[테스트] 작성자가 만든 자료' };
const positive = ask => ({ summary: '[테스트 응답] 두 예외 이름을 재사용한다.', items: [{ id: 'c1', title: '[테스트] 제한 종류별 안내', description: '[테스트 응답] 두 예외를 구별해 알린다.',
  partIds: [ask.parts.find(p => p.name === '오류 처리').id], refs: ['INTENT', 'N01'], dependsOn: [] }], impacts: [], preserve: ['[테스트 응답] eval의 parse→compile→VM 실행 순서', '[테스트 응답] 전역 객체 공유'], unknowns: ['[테스트 응답] 호출자 쪽 안내'] });
const REVIEW = { summary: '[테스트 응답] 추가 전제 없이 두 예외 이름을 재사용한다.', prerequisites: [{ title: '[테스트] 예외 이름 확인', reason: '[테스트 응답] 이름이 이미 있는지 확인 필요', refs: ['N01'] }], unknowns: ['[테스트 응답] 메시지 문구'] };
const QUIET = '복사는 이 글을 옮기는 일이에요. 접수·실행·완료를 기록하지 않아요.';
const FOCUSED = () => { const a = document.activeElement; return [a.id || null, a.dataset.sheetEntry ?? a.dataset.sheetPart ?? null, a.closest('#plan-sheet') ? 'sheet' : a.closest('.pw-req') ? 'request' : a.tagName]; };
// The document as shown, from its own pieces: every [data-at] slice in order (reading view) or the text view's whole text.
const SHOWN = () => { const s = document.getElementById('plan-sheet'), pre = s.querySelector('pre'); return pre ? pre.textContent : [...s.querySelectorAll('[data-at]')].map(e => e.textContent).join(''); };

function start() {
  const proc = spawn(process.execPath, [`${ROOT}tests/studio-smoke-server.mjs`], { cwd: APP, env: { ...process.env, STUDIO_STUB: 'ok', PORT: '0' }, stdio: ['ignore', 'pipe', 'inherit'] });
  return new Promise((res, rej) => { proc.stdout.once('data', d => { const m = /READY (http:\/\/\S+)/.exec(String(d)); m ? res({ proc, base: m[1] }) : rej(new Error(String(d))); }); proc.once('exit', c => rej(new Error(`server exit ${c}`))); });
}

async function flow(browser, base, [w, hgt]) {
  const context = await browser.newContext({ viewport: { width: w, height: hgt }, acceptDownloads: true });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
  const page = await context.newPage(), errors = [], calls = [], record = {};
  page.on('pageerror', e => errors.push(String(e)));
  const shot = async name => { if (!SHOTS) return; await page.waitForTimeout(250); /* after the sheet's short pop-in */ await page.screenshot({ path: `${SHOTS}/request94-${w}x${hgt}-${name}.png` }); };
  const ev = (fn, arg) => page.evaluate(fn, arg);
  await page.goto(base + '/');
  await page.locator('#import-file').setInputFiles(`${ROOT}tests/fixtures/context75/micro-javascript-backup.json`);
  await page.locator('#crumbs').getByText('micro-javascript').waitFor();
  await page.waitForURL(/#\/p\/[^/]+/);
  const project = await ev(ENTRY, decodeURIComponent(/#\/p\/([^/]+)/.exec(page.url())[1]));
  const ref = { id: PIPE, name: '평가 실행 파이프라인' };
  const other = { draft: '[테스트] 다른 프로젝트의 .2 초안', extra: [], plan: null, by: null, snapshots: [], labels: {}, origins: {}, observations: [], attached: {} };
  const bundle = { draft: SENTENCE, extra: [U01], plan: null, by: null, snapshots: [], labels: {}, origins: {}, observations: [], attached: {},
    authoring: { version: 'authoring-context.1', draft: { state: 'set', context: { projectId: project.id, selection: ref, scope: ref, at: '2026-10-28T00:00:00.000Z', how: 'explicit' } }, analyzed: null } };
  const KEY = 'agentflow.studio.plans.1';
  await ev(([k, id, b, o]) => localStorage.setItem(k, JSON.stringify({ version: 'studio.plans.3', projects: { [id]: b, P_other94: o }, legacy: { P_other94: 'studio.plans.2' } })), [KEY, project.id, bundle, other]);
  await page.reload();
  const env = () => ev(k => JSON.parse(localStorage.getItem(k)), KEY), stored = async () => (await env()).projects[project.id];
  const panel = page.locator('#plan-panel'), sheet = page.locator('#plan-sheet'), area = page.locator('#plan-intent'), status = sheet.locator('footer [role=status]');
  const body = sheet.locator('[data-sheet-part="text"]'), last = panel.locator('[data-sheet-entry="last"]');
  // The plan opens on the map with its strip; the request and its documents read in the wide comparison.
  const reopen = async () => { await page.locator('#plan-entry').click(); if (!(await last.isVisible())) await page.locator('#plan-strip .ps-more').click(); await last.waitFor(); };
  await page.route('**/api/studio/plan', route => { calls.push(route.request().url()); route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ model: 'stub-model', reply: positive(route.request().postDataJSON()) }) }); });
  await page.route('**/api/studio/scope', route => { calls.push(route.request().url()); route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ model: 'stub-model', reply: REVIEW }) }); });
  await page.locator('#plan-entry').click();
  await page.locator('#plan-ask').click();
  await page.locator('#plan-strip .ps-item').getByText('[테스트] 제한 종류별 안내').waitFor();
  await page.locator('#plan-strip .ps-more').click();

  // 1) A document as the 93 app kept it (no reading) reads as its whole text, exactly as before: no sections, no switch.
  await page.locator('#plan-make').click(); await sheet.waitFor();
  const first = await stored(); assert.ok(first.snapshots[0].reading, 'made by 94 with its reading');
  const pre94 = structuredClone(first); delete pre94.snapshots[0].reading;
  await ev(([k, id, b, o]) => localStorage.setItem(k, JSON.stringify({ version: 'studio.plans.3', projects: { [id]: b, P_other94: o }, legacy: { P_other94: 'studio.plans.2' } })), [KEY, project.id, pre94, other]);
  await page.reload();
  await reopen();
  await last.click(); await sheet.waitFor();
  const oldText = pre94.snapshots[0].text;
  assert.equal(await sheet.locator('pre').textContent(), oldText);
  assert.equal(await sheet.locator('.rq-tools, .rq-read, [data-at]').count(), 0, 'the earlier document has no sections or switch');
  assert.equal((await ev(FOCUSED))[1], 'text');
  assert.equal(await sheet.locator('#plan-copy').textContent(), '복사');
  record.old = { length: oldText.length, sha256: sha(oldText) };
  await shot('0-old-document-text');
  await page.keyboard.press('Escape'); await sheet.waitFor({ state: 'hidden' });
  assert.deepEqual((await ev(FOCUSED)).slice(1), ['last', 'request']);

  // 2) A new document: made with its reading, which opens on its sections.
  await page.locator('#plan-make').click(); await sheet.waitFor();
  assert.equal((await ev(FOCUSED))[0], 'plan-copy');
  const made = await stored(), snap = made.snapshots.at(-1), text = snap.text, spans = snap.reading.spans;
  assert.equal(made.snapshots.length, 2); assert.equal(Object.hasOwn(made.snapshots[0], 'reading'), false, 'never backfilled'); assert.equal(made.snapshots[0].text, oldText);
  const up = await env();
  assert.equal(up.version, 'studio.plans.4'); assert.deepEqual(up.legacy, { P_other94: 'studio.plans.2' }); assert.deepEqual(up.projects.P_other94, other);
  assert.equal(await sheet.locator('[data-sheet-part="view-reading"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await ev(SHOWN), text, 'its pieces in order are the whole text');
  const sectionKinds = spans.filter(x => x.kind !== 'material').map(x => x.kind), materials = spans.filter(x => x.kind === 'material');
  assert.deepEqual(sectionKinds, ['head', 'selected', 'excluded', 'prerequisites', 'preserve', 'unknowns', 'review-unknowns', 'materials', 'closing']);
  assert.deepEqual(await sheet.locator('.rq-read > [data-sec]').evaluateAll(es => es.map(e => e.dataset.sec)), sectionKinds);
  assert.equal(await sheet.locator('.rq-h').count(), sectionKinds.length, 'material text (fake headings) adds no heading');
  const evidence = made.plan.evidence, selectedRefs = snap.scope.items.flatMap(i => i.sources.map(x => x.id));
  assert.deepEqual(materials.map(m => m.ref), evidence.map(e => e.id), 'the whole review input');
  assert.ok(materials.length > selectedRefs.length && materials.some(m => m.ref === 'U01'));
  assert.deepEqual(await sheet.locator('.rq-mat-name').allTextContents(), evidence.map(e => `[${e.id}] ${e.title} · ${e.kind}\n`));
  assert.equal(await sheet.locator('.rq-mat .rq-text:visible').count(), 0, 'material starts folded');
  for (const k of ['selected', 'prerequisites', 'preserve', 'unknowns', 'review-unknowns', 'closing']) assert.ok(await sheet.locator(`[data-sec="${k}"] .rq-text`).isVisible(), k);
  assert.match(await sheet.locator('.rq-mat-note').textContent(), new RegExp(`자료 ${materials.length}개 · 작업 지시가 아니라`));
  assert.equal(await sheet.locator('#plan-copy').textContent(), `전체 복사 · 자료 ${materials.length}개 포함`);
  assert.equal(await sheet.locator('.rq-nav button').count(), sectionKinds.length - 1);
  record.made = { length: text.length, sha256: sha(text), sections: sectionKinds, materials: materials.map(m => m.ref), selectedRefs, origin: made.origins[snap.id] };
  await shot('1-reading-default');
  // The copy is the whole text, folded material included.
  await sheet.locator('#plan-copy').click();
  await status.getByText('복사했어요').waitFor();
  const clip = await ev(() => navigator.clipboard.readText());
  assert.equal(clip, text); record.copy = { length: clip.length, exact: clip === text, sha256: sha(clip) };
  await page.keyboard.press('Escape'); await sheet.waitFor({ state: 'hidden' });
  assert.equal((await ev(FOCUSED))[0], 'plan-make');

  // 3) A long stale draft, selected backward and scrolled: nothing done in the document touches it.
  await panel.locator('.pw-head-tools').getByRole('button', { name: '문장 고치기' }).click();
  const longDraft = SENTENCE + Array.from({ length: 35 }, (_, n) => `\n[AF94 읽기 검사 사본] ${n + 1}번째 줄 · 긴 초안 안에서 읽던 위치`).join('');
  await area.fill(longDraft);
  assert.ok(await page.locator('#plan-make').isDisabled());
  await area.focus(); await page.keyboard.press('Control+Home');
  for (let i = 0; i < 15; i++) await page.keyboard.press('ArrowRight');
  for (let i = 0; i < 11; i++) await page.keyboard.press('Shift+ArrowLeft');
  await area.evaluate(a => { a.scrollTop = 200; });
  const CARET = a => [a.selectionStart, a.selectionEnd, a.selectionDirection, a.scrollTop, a.value];
  const caret = await area.evaluate(CARET);
  assert.deepEqual(caret.slice(0, 4), [4, 15, 'backward', 200]);
  const kept = await stored();

  await last.click(); await sheet.waitFor();
  assert.equal((await ev(FOCUSED))[1], 'text');
  // The keyboard from the text: Shift+Tab reaches ×; Tab goes through the reader's own controls (folds) to copy and close, never
  // out of the sheet. (93 went from the text straight to copy; the sections' material folds now sit between.)
  await page.keyboard.press('Shift+Tab'); assert.equal((await ev(FOCUSED))[1], 'x');
  await page.keyboard.press('Tab'); assert.equal((await ev(FOCUSED))[1], 'text');
  const stops = [];
  for (let i = 0; i < 40 && (await ev(FOCUSED))[1] !== 'copy'; i++) { await page.keyboard.press('Tab'); const f = await ev(FOCUSED); assert.equal(f[2], 'sheet', String(f)); stops.push(f[1]); }
  assert.equal(stops.at(-1), 'copy'); assert.deepEqual(stops, ['mat-all', ...materials.map(m => `mat-${m.ref}`), 'copy']);
  await page.keyboard.press('Tab'); assert.equal((await ev(FOCUSED))[1], 'close');
  assert.equal(await sheet.locator('.rq-mat .rq-text:visible').count(), 0, 'walking the folds by keyboard does not unfold them');
  await body.evaluate(b => { b.scrollTop = 0; });
  record.keyboard = stops;
  // a) Move to a section: its heading at the top of the view, the keyboard there.
  await sheet.locator('[data-sheet-part="go-preserve"]').click();
  const headTop = () => sheet.locator('[data-sec="preserve"] .rq-h').evaluate(hd => hd.getBoundingClientRect().top - hd.closest('.rq-read').getBoundingClientRect().top);
  const jumped = await body.evaluate(b => b.scrollTop), gapTop = await headTop();
  assert.ok(jumped > 0 && gapTop >= 0 && gapTop < 40, [jumped, gapTop]);
  assert.equal((await ev(FOCUSED))[1], 'sec-preserve');
  // b) Unfold the pasted material in place: its text, the same place, the same control.
  await sheet.locator('[data-sheet-part="go-materials"]').click();
  const u01 = sheet.locator('[data-ref="U01"]');
  await u01.locator('button').click();
  assert.equal(await u01.locator('button').getAttribute('aria-expanded'), 'true');
  const u = spans.find(x => x.ref === 'U01');
  assert.deepEqual([u.source, u.title, u.basis, u.length], [U01.kind, U01.title, U01.basis, U01.text.length], 'frozen as the pasted material');
  assert.equal(await u01.locator('.rq-text').textContent(), text.slice(u.start + `[U01] ${u.title} · report\n`.length, u.end - 2));
  assert.ok((await u01.locator('.rq-text').textContent()).includes('유지할 조건:\n- [테스트] 가짜 유지'));
  assert.equal((await ev(FOCUSED))[1], 'mat-U01');
  await body.evaluate(b => { b.scrollTop = Math.floor((b.scrollHeight - b.clientHeight) / 2); });
  const mid = await body.evaluate(b => b.scrollTop);
  assert.ok(mid > 0);
  // c) A copy keeps the unfolded material, the place and the focus.
  await sheet.locator('#plan-copy').click();
  await status.getByText('복사했어요').waitFor();
  assert.equal(await ev(() => navigator.clipboard.readText()), text);
  assert.deepEqual([(await ev(FOCUSED))[1], await body.evaluate(b => b.scrollTop), await u01.locator('button').getAttribute('aria-expanded')], ['copy', mid, 'true']);
  assert.deepEqual(await area.evaluate(CARET), caret, 'the draft behind stays as it was read');
  await shot('2-material-open-copied');
  // d) The text view and back: each keeps its own place in this opening; the unfolded material stays unfolded.
  await sheet.locator('[data-sheet-part="view-text"]').click();
  assert.equal(await sheet.locator('pre').textContent(), text);
  assert.equal((await ev(FOCUSED))[1], 'view-text');
  await body.evaluate(b => { b.scrollTop = Math.floor(b.scrollHeight / 3); });
  const textAt = await body.evaluate(b => b.scrollTop);
  assert.ok(textAt > 0);
  await shot('3-text-view');
  await sheet.locator('[data-sheet-part="view-reading"]').click();
  assert.deepEqual([await body.evaluate(b => b.scrollTop), await u01.locator('button').getAttribute('aria-expanded'), (await ev(FOCUSED))[1]], [mid, 'true', 'view-reading']);
  assert.equal(await ev(SHOWN), text);
  await sheet.locator('[data-sheet-part="view-text"]').click();
  assert.equal(await body.evaluate(b => b.scrollTop), textAt);
  await sheet.locator('[data-sheet-part="view-reading"]').click();
  record.reading = { jumpedTo: jumped, headingOffset: gapTop, mid, textAt };
  // e) Closing goes back to the control that opened it; the draft as it was.
  await page.keyboard.press('Escape'); await sheet.waitFor({ state: 'hidden' });
  assert.equal((await ev(FOCUSED))[1], 'last');
  assert.deepEqual(await area.evaluate(CARET), caret);
  // f) A new opening of the same document starts afresh: sections, all folded, at the top.
  await last.click(); await sheet.waitFor();
  assert.deepEqual([await sheet.locator('[data-sheet-part="view-reading"]').getAttribute('aria-pressed'), await sheet.locator('.rq-mat .rq-text:visible').count(), await body.evaluate(b => b.scrollTop), await status.textContent()], ['true', 0, 0, QUIET]);
  await page.keyboard.press('Escape'); await sheet.waitFor({ state: 'hidden' });

  // 4) Copies that end late or are blocked (writeText replaced in the page and settled by hand; not the OS clipboard order).
  await ev(() => { window.__clips = []; window.__late = []; navigator.clipboard.writeText = () => new Promise((res, rej) => window.__clips.push({ res, rej, done: false })); addEventListener('unhandledrejection', e => window.__late.push(String(e.reason))); });
  const settle = async (n, how) => { assert.ok(await ev(([n, how]) => { const c = window.__clips[n]; if (!c || c.done) return false; c.done = true; how === 'res' ? c.res() : c.rej(new Error('late')); return true; }, [n, how])); await page.waitForTimeout(100); };
  const boundaries = [];
  await last.click(); await sheet.waitFor();
  await sheet.locator('[data-sheet-part="go-materials"]').click(); await u01.locator('button').click();
  await sheet.locator('#plan-copy').click();
  await page.keyboard.press('Escape'); await sheet.waitFor({ state: 'hidden' });
  await last.click(); await sheet.waitFor();
  await settle(0, 'rej');
  boundaries.push({ attempt: 0, settled: 'rej', at: 'the same document opened again (a new opening)', status: await status.textContent(), unfolded: await sheet.locator('.rq-mat .rq-text:visible').count(), scrollTop: await body.evaluate(b => b.scrollTop), focus: await ev(FOCUSED) });
  assert.equal(await status.textContent(), QUIET); assert.equal(await sheet.locator('.rq-mat .rq-text:visible').count(), 0);
  // Blocked in the reading view: said so; the text view then holds the whole text, selected.
  await sheet.locator('#plan-copy').click(); await settle(1, 'rej');
  const blocked = await status.textContent();
  assert.match(blocked, /원문 그대로/); assert.equal(await ev(() => getSelection().toString()), '');
  assert.equal((await ev(FOCUSED))[1], 'copy');
  await sheet.locator('[data-sheet-part="view-text"]').click();
  const selected = await ev(() => getSelection().toString());
  boundaries.push({ attempt: 1, settled: 'rej', at: 'blocked in the reading view, then the text view', status: blocked, selectedLength: selected.length, selectedExact: selected === text });
  assert.equal(selected, text);
  await page.keyboard.press('Escape'); await sheet.waitFor({ state: 'hidden' });
  assert.deepEqual(await area.evaluate(CARET), caret);
  assert.deepEqual(await ev(() => window.__late), []);
  record.lateCopies = boundaries;

  // 5) Saved, reloaded, exported and imported: the same text and reading.
  assert.deepEqual(await stored(), kept, 'reading, folding, moving and copying store nothing');
  await page.reload();
  await reopen(); await last.click(); await sheet.waitFor();
  assert.equal(await ev(SHOWN), text); assert.deepEqual((await stored()).snapshots.at(-1), snap);
  await page.keyboard.press('Escape'); await sheet.waitFor({ state: 'hidden' });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '파일로 내보내기' }).click()]);
  const file = JSON.parse(readFileSync(await dl.path(), 'utf8'));
  assert.equal(file.format, 'agentflow.change-plan-file.4'); assert.deepEqual(file.bundle.snapshots, made.snapshots);
  page.once('dialog', d => d.accept());
  await page.locator('#plan-import-file').setInputFiles(await dl.path());
  await panel.getByText('변경안 파일을 가져왔어요.').waitFor();
  const back = await stored(); assert.deepEqual(back.snapshots, made.snapshots); assert.deepEqual(back.labels, made.labels); assert.deepEqual(back.origins, made.origins);
  await last.click(); await sheet.waitFor(); assert.equal(await ev(SHOWN), text);
  await page.keyboard.press('Escape');
  const fin = await env(); assert.deepEqual(fin.projects.P_other94, other); assert.deepEqual(fin.legacy, { P_other94: 'studio.plans.2' });
  record.storage = { envelope: fin.version, legacy: fin.legacy, file: file.format, otherEntryUnchanged: true };
  assert.equal(calls.length, 3, calls); // the analysis and one scope review per made document; reading and copying call nothing
  record.calls = calls.length; record.errors = errors;
  assert.deepEqual(errors, []);
  if (SHOTS) writeFileSync(`${SHOTS}/request94-${w}x${hgt}-boundaries.json`, JSON.stringify(record, null, 1) + '\n');
  await context.close();
  return record;
}

const { proc, base } = await start();
const browser = await chromium.launch(process.env.STUDIO_CHROMIUM ? { executablePath: process.env.STUDIO_CHROMIUM } : {});
try {
  for (const size of [[1280, 720], [1440, 900]]) { const t = Date.now(); await flow(browser, base, size); console.log(`ok  AF94 request reading at ${size[0]}x${size[1]} (${Date.now() - t} ms)`); }
} finally { await browser.close(); proc.kill(); }
