// AF135 a withdrawal names what it took back. Auxiliary Node Playwright flow (like connected126-flow.mjs), not part of CI:
//   node continuity/tests/withdrawal135-flow.mjs [shots-dir]        (from app/, after the continuity build)
// Real local app (studio-smoke-server with its stub transport; no map request reaches it: the one in U is answered in the page by
// this test). Author-written project, never a model's reading (replies labelled '[스텁]'):
//   RQ1 (폴더 입력 · 실패 후 계속) and RQ2 (another plan) whose item has the same title '폴더 입력'. A report names RQ1 and says
//   '폴더 입력을 구현했습니다.' twice; the RQ1 match quotes the second place. A correction withdraws exactly that match (map.6
//   replaces). Then a stored replay of the first reading (as a re-comparison or a copy stores it) folds that match away from
//   requestMatches: the link still names the very first entry (full ledger), never a passage, title or time that looks the same.
//   K. Narrow list: the withdrawing passage names the report, its scope, the request item and revision; that report's original
//      opens marked at its own (second) place and comes back to the same button, in view; RQ2's same-titled item is untouched.
//   W. Wide reading: the same on the card, both sides of the link, the original by the full ledger, back in view; no sideways.
//   C. The person retargets the withdrawing passage, then excludes it, then unlinks: the original item stays named while the link
//      holds, today's correspondence reads apart, and after unlinking nothing is named.
//   U. A map reading of this visit lands while that original is open: re-read, the original stays, back to the exact button.
//   P. The change plan's results rail: the same line; the report's original in its own fold (no quote pane there).
//   N. 390×844: the line wraps, no sideways scroll.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url)), APP = fileURLToPath(new URL('../..', import.meta.url));
const SHOTS = process.argv[2] ?? null; if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const D = await import(`${ROOT}dist/public/shared/domain.js`), S = await import(`${ROOT}dist/public/shared/storage.js`);
const M = await import(`${ROOT}dist/public/shared/map-reading.js`), C = await import(`${ROOT}dist/public/shared/change-plan.js`);
const RR = await import(`${ROOT}dist/public/shared/request-return.js`), { textDigest } = await import(`${ROOT}dist/public/shared/evidence-span.js`);
const { parseProject } = await import(`${ROOT}dist/public/shared/validation.js`);
const { studioView } = await import(`${ROOT}dist/public/shared/studio.js`), { emptyBundle, saveBundle } = await import(`${ROOT}dist/public/client/plan-store.js`);
const W = 'agentflow.idea015.workspace', PLANS = 'agentflow.studio.plans.1', MAIN = 'E_wd135-aaaa-0001';

/* ---------- the project (author-written) ---------- */
const T1 = '폴더 입력', T2 = '실패 후 계속';
const SAID = '폴더 입력을 구현했습니다.';
const report = rq => [`작업 보고 (요청 ${rq})`, `요약: ${SAID}`, '조건: feature/folder 브랜치 · commit abc1234', '세부:', SAID,
  '한 파일이 실패해도 나머지를 계속 처리하도록 바꿨습니다.'].join('\n');
const reportQ2 = rq => [`다른 요청 보고 (요청 ${rq})`, '폴더 입력 화면을 따로 만들었습니다.'].join('\n');
const correction = rq => `정정 (요청 ${rq}): feature/folder의 폴더 입력 구현 주장을 철회합니다. 아직 미구현입니다.`;
const late = rq => `늦은 정정 (요청 ${rq}): 실패 후 계속 처리 보고도 철회합니다. 아직 미구현입니다.`;
const reply6 = o => ({ summary: '', parts: [], relations: [], candidates: [], gaps: [], matches: [], material: [], ...o });
const spans = (inp, alias, words) => inp.ask.records.find(r => r.id === alias).spans.filter(s => s.t.trimStart().startsWith(words)).map(s => s.s);
const aliasOf = (inp, text) => inp.ask.records.find(r => inp.records.get(r.id)?.text === text).id;
let n = 0;
const meta = id => ({ id, at: new Date(Date.now() + ++n).toISOString(), model: 'stub-135', prompt: 'm6-000000000135', hash: String(n).repeat(64).slice(0, 64) });
function plan(p, area, items) {
  const evidence = [{ id: 'INTENT', kind: 'user', title: '원함', text: items.map(x => x[0]).join(' / '), basis: '사용자 초안' }];
  const analysis = { summary: '[스텁] 폴더', items: items.map(([title, description], i) => ({ id: `I${i + 1}`, title, description, partIds: [area], refs: ['INTENT'], dependsOn: [] })), impacts: [], preserve: [], unknowns: [] };
  return C.createPlan(p.id, '기준', evidence[0].text, evidence, analysis);
}
function build() {
  let p = D.rename(D.addArea(D.createProject(), '폴더 일괄 처리', ''), '폴더 변환기 · 135'); const area = p.space.areas[0].id;
  const pl1 = plan(p, area, [[T1, '폴더 경로를 받아 안의 문서를 모두 변환한다.'], [T2, '한 파일이 실패해도 나머지는 계속 변환한다.']]), s1 = C.requestSnapshot(pl1);
  const s2 = C.requestSnapshot(plan(p, area, [[T1, '폴더를 고르는 화면을 따로 둔다.']]));
  const Q1 = s1.scope, Q2 = s2.scope;
  p = D.pasteRecord(p, report(Q1.id), area).project; p = D.pasteRecord(p, reportQ2(Q2.id), area).project;
  const a1 = M.buildMapAsk(p, studioView(p), [Q1, Q2], undefined, M.MAP6_SCHEMA), R = aliasOf(a1, report(Q1.id)), R2 = aliasOf(a1, reportQ2(Q2.id));
  const said = spans(a1, R, SAID); assert.equal(said.length, 1, 'the second place is its own piece'); // '요약: …' starts otherwise
  const mm = (at, q, item, text, o = {}) => ({ at, text: `[스텁] ${text}`, kind: 'reported', stance: 'made', about: null, targets: [{ requestId: q.id, itemId: item }], why: '[스텁] 대응', replaces: null, ...o });
  p = M.applyReading(p, a1, M.validateMapReply(reply6({ summary: '[스텁] 첫 보고', matches: [
    mm(said[0], Q1, 'I1', '폴더 입력을 구현했다고 보고함', { about: '조건: feature/folder 브랜치 · commit abc1234' }),
    mm(spans(a1, R, '한 파일이 실패해도')[0], Q1, 'I2', '실패 후 계속 처리로 바꿨다고 보고함'),
    mm(spans(a1, R2, '폴더 입력 화면을')[0], Q2, 'I1', '폴더 입력 화면을 따로 만들었다고 보고함')] }), a1.ask), meta('R_135_first')).project;
  p = D.pasteRecord(p, correction(Q1.id), null).project;
  const a2 = M.buildMapAsk(p, studioView(p), [Q1, Q2], undefined, M.MAP6_SCHEMA), Cn = aliasOf(a2, correction(Q1.id));
  const key = a2.ask.priors.find(x => x.quote === SAID && x.target.requestId === Q1.id).key;
  p = M.applyReading(p, a2, M.validateMapReply(reply6({ summary: '[스텁] 정정', matches: [
    mm(spans(a2, Cn, '정정')[0], Q1, 'I1', '폴더 입력 구현 주장을 철회하고 미구현이라고 정정함', { stance: 'not-made', about: 'feature/folder', replaces: key })] }), a2.ask), meta('R_135_fix')).project;
  // A stored replay of the first reading (a re-comparison or a copy): it folds the withdrawn entry away from requestMatches.
  const first = p.readings.find(r => r.id === 'R_135_first');
  p = parseProject(JSON.stringify({ ...p, readings: [...p.readings, { ...structuredClone(first), id: 'R_135_replay', hash: 'e'.repeat(64), parts: [], relations: [] }] }));
  const project = JSON.parse(S.serializeProject(p));
  const bundle = { ...emptyBundle(''), plan: pl1, by: { kind: 'ai', model: 'stub-135', at: s1.createdAt, records: { total: 1, sent: 1 } }, snapshots: [s2, s1],
    labels: { [s2.id]: { I1: T1 }, [s1.id]: { I1: T1, I2: T2 } }, origins: { [s2.id]: 'ai', [s1.id]: 'ai' } };
  const later = JSON.parse(S.serializeProject(D.pasteRecord(p, late(Q1.id), null).project));
  return { project, later, bundle, Q1, Q2, area, reportText: report(Q1.id) };
}
const X = build();
const PRIOR = { reading: 'R_135_first', index: 0 };
{ // The link as the ledger stores it, and the fold that hides its prior from requestMatches (the case this view must not guess in).
  const m = RR.requestMatches(X.project), led = RR.matchLedger(X.project.readings, RR.recordTexts(X.project)).all;
  const w = m.find(x => x.replaces); assert.deepEqual(w.replaces, PRIOR);
  assert.equal(m.some(x => x.reading === PRIOR.reading && x.index === PRIOR.index), false, 'the prior is folded away from requestMatches');
  const prior = led.find(x => x.reading === PRIOR.reading && x.index === PRIOR.index); assert.equal(prior.replacedBy.reading, w.reading);
  assert.equal(X.reportText.indexOf(SAID), X.reportText.indexOf(`요약: ${SAID}`) + 4, 'the words stand first in the summary');
  assert.equal(prior.match.from, X.reportText.lastIndexOf(SAID), 'the prior quotes the second place');
  assert.equal(RR.itemReading(m, { requestId: X.Q1.id, itemId: 'I1' }).state, 'not-made'); assert.equal(RR.itemReading(m, { requestId: X.Q2.id, itemId: 'I1' }).state, 'made');
}
const mem = new Map(), kv = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: k => mem.delete(k) };
assert.equal(saveBundle(kv, X.project.id, X.bundle), null);
const entry = (entryId, project) => ({ entryId, state: 'active', lifecycle: 1, seq: 1, createdAt: new Date().toISOString(), trashedAt: null, origin: 'new', project });
const seedOf = project => ({ ...Object.fromEntries(mem), [W]: JSON.stringify({ version: 'agentflow.workspace.1', migratedFromLegacy: false, entries: [entry(MAIN, project)] }) });

/* ---------- server, page ---------- */
function start() {
  const proc = spawn(process.execPath, [`${ROOT}tests/studio-smoke-server.mjs`], { cwd: APP, env: { ...process.env, STUDIO_STUB: 'ok', PORT: '0' }, stdio: ['ignore', 'pipe', 'inherit'] });
  return new Promise((res, rej) => { proc.stdout.once('data', d => { const m = /READY (http:\/\/\S+)/.exec(String(d)); m ? res({ proc, base: m[1] }) : rej(new Error(String(d))); }); proc.once('exit', c => rej(new Error(`server exit ${c}`))); });
}
const results = [];
const ok = (name, detail = '') => { results.push(name); console.log(`ok - ${name}${detail ? ` · ${detail}` : ''}`); };
async function context(browser, base, size = [1280, 720], project = X.project) {
  const ctx = await browser.newContext({ viewport: { width: size[0], height: size[1] } });
  const page = await ctx.newPage(), errors = [], sent = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('request', r => { if (r.method() !== 'GET') sent.push(`${r.method()} ${r.url()}`); });
  await page.goto(`${base}/`);
  await page.evaluate(x => { localStorage.clear(); sessionStorage.clear(); for (const [k, v] of Object.entries(x)) localStorage.setItem(k, v); }, seedOf(project));
  await page.evaluate(h => history.replaceState(null, '', h), `#/p/${MAIN}`); await page.reload();
  await page.locator('#world .node').first().waitFor();
  await page.waitForFunction(() => document.getElementById('ai-pill')?.dataset.state !== 'checking');
  return { ctx, page, errors, sent };
}
const stores = page => page.evaluate(([a, b]) => [localStorage.getItem(a), localStorage.getItem(b)], [W, PLANS]);
const saved = page => page.evaluate(([w, k]) => JSON.parse(localStorage.getItem(w)).entries.find(e => e.entryId === k).project, [W, MAIN]);
const activeKey = page => page.evaluate(() => { const a = document.activeElement; return a?.dataset.requestFocus ?? a?.dataset.rwFocus ?? null; });
/** The focused control lies wholly inside its scrolling column (the lens body or the wide reading's column). */
const inView = page => page.evaluate(() => { const a = document.activeElement, m = a?.closest('.lens-body, .rw-main'); if (!a || !m) return false;
  const r = a.getBoundingClientRect(), b = m.getBoundingClientRect(); return r.height > 0 && r.top >= b.top && r.bottom <= b.bottom; });
const sideways = (page, sel) => page.evaluate(s => { const d = document.scrollingElement, b = document.querySelector(s); return [d.scrollWidth - d.clientWidth, b ? b.scrollWidth - b.clientWidth : null]; }, sel);
/** Where a mark stands in its quote block's text: the number of characters before it. */
const markAt = (page, scope) => page.evaluate(s => { const m = document.querySelector(`${s} .rr-mark`), q = m?.closest('blockquote, pre'); if (!m || !q) return null;
  const r = document.createRange(); r.setStart(q, 0); r.setEndBefore(m); return { at: r.toString().length, text: m.textContent }; }, scope);
const wideOpen = page => page.locator('#request-wide:not([hidden])');
const itemOf = (page, q, id) => page.locator('#lens .request-item').filter({ has: page.locator(`summary[data-request-focus='${JSON.stringify([q.id, q.planId, q.planRevision, id])}']`) });
async function pane(page) { await page.locator('#return-entry').click(); await page.locator('#lens .rr-map .request-results').waitFor(); }
async function openItem(page, q, id) { const it = itemOf(page, q, id); if ((await it.getAttribute('open')) === null) await it.locator(':scope > summary').click(); return it; }

/* ---------- K: the narrow list ---------- */
async function narrow(browser, base) {
  const { ctx, page, errors, sent } = await context(browser, base);
  const before = await stores(page);
  await pane(page);
  const it = await openItem(page, X.Q1, 'I1'), line = it.locator('.request-target');
  assert.equal(await line.count(), 1, 'one line, under the withdrawing passage');
  const text = await line.locator('p').first().textContent();
  assert.ok(text.startsWith('철회 대상작업 보고 · 변경 · [스텁] 폴더 입력을 구현했다고 보고함 · 조건: feature/folder 브랜치 · commit abc1234 — 요청 '), text);
  assert.ok(text.includes('· 판 1 · ‘폴더 입력’'), text);
  assert.equal(await it.locator('.cl-replaces').count(), 0, 'the general mark gives way to the named target');
  // Both sides: the withdrawn report in this item's history names the passage that took it back.
  assert.ok((await it.locator('.request-history').textContent()).includes('이후 원문이 이 보고를 철회·정정했어요: [스텁] 폴더 입력 구현 주장을 철회'));
  // RQ2's same-titled item: its own report stands, nothing withdrawn there.
  const other = await openItem(page, X.Q2, 'I1');
  assert.equal(await other.locator('.request-target, .request-history').count(), 0); assert.ok((await other.locator('summary').first().textContent()).includes('변경 보고'));
  // The report's original, at its own (second) place, then back to the very button, in view.
  const b = line.getByRole('button', { name: '철회한 보고 원문' }); await b.scrollIntoViewIfNeeded(); await b.focus();
  const key = await b.getAttribute('data-request-focus'), body = page.locator('#lens .lens-body'), at = await body.evaluate(e => e.scrollTop);
  assert.deepEqual(JSON.parse(key).slice(1), ['withdrew', 'R_135_fix', 0, PRIOR.reading, PRIOR.index]);
  await b.click(); await page.locator('#lens .rr-mark').waitFor();
  const mark = await markAt(page, '#lens'); assert.equal(mark.text, SAID); assert.equal(mark.at, X.reportText.lastIndexOf(SAID), 'marked at the second place');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/k-original.png` });
  await page.keyboard.press('Escape');
  assert.equal(await activeKey(page), key); assert.ok(await inView(page)); assert.ok(Math.abs(await body.evaluate(e => e.scrollTop) - at) <= 1);
  assert.equal(await itemOf(page, X.Q1, 'I1').getAttribute('open'), '');
  assert.deepEqual(await sideways(page, '#lens .lens-body'), [0, 0]);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/k-list.png` });
  assert.deepEqual(await stores(page), before); assert.deepEqual(sent, []); assert.deepEqual(errors, []);
  ok('K narrow: the withdrawing passage names the report, scope, request and revision; its original at the second place; back to the button, in view; RQ2 untouched', text.length + ' chars');
  await ctx.close();
}

/* ---------- W: the wide reading ---------- */
async function wide(browser, base) {
  const { ctx, page, errors, sent } = await context(browser, base);
  const before = await stores(page);
  await pane(page);
  const it = await openItem(page, X.Q1, 'I1'); await it.locator('.request-wide.item').click(); await wideOpen(page).waitFor();
  const card = page.locator('.rw-card.lead'), target = card.locator('.rw-target');
  const rows = await target.locator('.rw-by').allTextContents();
  assert.equal(rows[0], '철회 대상작업 보고 · 변경 [스텁] 폴더 입력을 구현했다고 보고함 · 조건: feature/folder 브랜치 · commit abc1234');
  assert.ok(/^철회한 항목폴더 입력 · 요청 \d · .+ · 판 1$/.test(rows[1]), rows[1]); assert.equal(rows.length, 2, 'no today row while it answers the same item');
  const hist = page.locator('.rw-history'); await hist.locator(':scope > summary').click();
  assert.ok((await hist.locator('.rw-card.withdrawn').textContent()).includes('[스텁] 폴더 입력 구현 주장을 철회'));
  const b = target.locator('.rw-src-prior'), key = await b.getAttribute('data-rw-focus'), main = page.locator('.rw-main');
  await b.scrollIntoViewIfNeeded(); const at = await main.evaluate(e => e.scrollTop);
  await b.click(); await page.locator('.rw-source').waitFor();
  const mark = await markAt(page, '.rw-main'); assert.equal(mark.text, SAID); assert.equal(mark.at, X.reportText.lastIndexOf(SAID));
  assert.equal(await page.locator('.rw-reading .rw-tag.off').textContent(), '이후 철회·정정됨');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/w-original.png` });
  await page.keyboard.press('Escape');
  assert.equal(await activeKey(page), key); assert.ok(await inView(page)); assert.ok(Math.abs(await main.evaluate(e => e.scrollTop) - at) <= 1);
  const m = await page.evaluate(() => { const t = document.querySelector('.rw-target .rw-by span:last-child'), w = document.querySelector('.rw-main'), card = document.querySelector('.rw-card.lead');
    return { row: t.getBoundingClientRect().width, side: w.scrollWidth - w.clientWidth, card: card.getBoundingClientRect().height }; });
  assert.equal(m.side, 0); assert.deepEqual(await sideways(page, '.rw-main'), [0, 0]);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/w-card.png` });
  await page.keyboard.press('Escape');
  assert.deepEqual(await stores(page), before); assert.deepEqual(sent, []); assert.deepEqual(errors, []);
  ok('W wide: the card names the report and the item/revision; its original by the full ledger at the second place; back to the button, in view', `row ${Math.round(m.row)}px · lead card ${Math.round(m.card)}px tall · no sideways`);
  await ctx.close();
}

/* ---------- C: the person's corrections of the withdrawing passage, then unlinking ---------- */
async function corrections(browser, base) {
  const { ctx, page, errors, sent } = await context(browser, base);
  await pane(page);
  const fix = async (select) => {
    const it = await openItem(page, X.Q1, 'I1'), box = it.locator('.request-passage', { has: page.locator('.request-target') }).locator('.request-fix');
    await box.locator(':scope > summary').click(); await select(box.locator('select')); await box.getByRole('button', { name: '저장' }).click(); await page.waitForTimeout(250);
  };
  // Retarget to RQ1 · 실패 후 계속: the passage now reads there, still naming the item it was withdrawn for.
  await fix(async s => { const o = (await s.locator('option').allTextContents()).find(t => t.startsWith(`${T2} ·`)); await s.selectOption({ label: o }); });
  let p = await saved(page), last = p.readings.at(-1);
  assert.equal(last.version, 'request-correction.1'); assert.deepEqual(last.target, { requestId: X.Q1.id, itemId: 'I2' });
  const i2 = await openItem(page, X.Q1, 'I2'), line = i2.locator('.request-target');
  assert.equal(await line.count(), 1);
  assert.ok((await line.locator('p').first().textContent()).includes('‘폴더 입력’'), 'still the item it was withdrawn for');
  assert.ok((await line.locator('p.fine').textContent()).startsWith('지금은 이 구절을 요청 ') && (await line.locator('p.fine').textContent()).includes('‘실패 후 계속’ 대응으로 고쳤어요. 철회 연결은 그대로예요.'));
  assert.equal(await itemOf(page, X.Q1, 'I1').locator('.request-history .request-withdrawn').count(), 1, 'the withdrawn report stays history');
  // The wide card says today's correspondence apart.
  await i2.locator('.request-wide.item').click(); await wideOpen(page).waitFor();
  const rows = await page.locator('.rw-card .rw-target .rw-by').allTextContents();
  assert.ok(rows[1].startsWith('철회한 항목폴더 입력 · 요청 ') && rows[2].startsWith('지금 대응실패 후 계속 · 요청 ') && rows[2].endsWith('(철회 연결은 그대로)'), rows.join(' | '));
  await page.keyboard.press('Escape');
  // Exclude: it reads in the excluded fold, still naming the item.
  const box = (await openItem(page, X.Q1, 'I2')).locator('.request-passage', { has: page.locator('.request-target') }).locator('.request-fix');
  await box.locator(':scope > summary').click(); await box.locator('select').selectOption(''); await box.getByRole('button', { name: '저장' }).click(); await page.waitForTimeout(250);
  const ex = page.locator('#lens .request-excluded'); if ((await ex.getAttribute('open')) === null) await ex.locator(':scope > summary').click();
  assert.equal(await ex.locator('.request-target').count(), 1);
  assert.equal(await ex.locator('.request-target p.fine').textContent(), '지금은 이 구절을 요청 대응에서 제외했어요. 철회 연결은 그대로예요.');
  assert.equal(RR.itemReading(RR.requestMatches(await saved(page)), { requestId: X.Q1.id, itemId: 'I1' }).history.length, 1, 'excluding never brings the old report back');
  // Unlink (the person's own act, from the withdrawn report): nothing is named any more; the old report reads current again.
  const i1 = await openItem(page, X.Q1, 'I1'); const h = i1.locator('.request-history'); if ((await h.getAttribute('open')) === null) await h.locator(':scope > summary').click();
  await h.getByRole('button', { name: '철회 연결 풀기' }).click(); await page.waitForTimeout(250);
  p = await saved(page); assert.equal(p.readings.at(-1).version, 'replace-correction.1');
  assert.equal(await page.locator('#lens .request-target').count(), 0, 'no link, nothing named');
  assert.equal(RR.itemReading(RR.requestMatches(p), { requestId: X.Q1.id, itemId: 'I1' }).state, 'made');
  assert.equal(p.readings.filter(r => r.version.startsWith('request-correction') || r.version.startsWith('replace-correction')).length, 3, 'only the three acts were written');
  assert.deepEqual(sent, []); assert.deepEqual(errors, []);
  ok('C retarget → today read apart, the original item still named; exclude → same, history kept; unlink → nothing named; three acts written, nothing else');
  await ctx.close();
}

/* ---------- U: a reading of this visit lands while the withdrawn report's original is open ---------- */
async function landing(browser, base) {
  const { ctx, page, errors, sent } = await context(browser, base, [1280, 720], X.later);
  let answer; const gate = new Promise(r => { answer = r; });
  await page.route('**/api/studio/map', async route => { const body = route.request().postData(), ask = JSON.parse(body); await gate; await route.fulfill(reply(ask, body)); });
  await pane(page);
  await page.locator('#lens .rr-map').getByRole('button', { name: '기록 읽고 지도 갱신' }).click();
  await page.waitForFunction(() => !!document.querySelector('#lens .rr-map .pending'));
  const it = await openItem(page, X.Q1, 'I1'); await it.locator('.request-wide.item').click(); await wideOpen(page).waitFor();
  const b = page.locator('.rw-card.lead .rw-src-prior'), key = await b.getAttribute('data-rw-focus');
  await b.click(); await page.locator('.rw-source').waitFor();
  answer(); await page.waitForFunction(() => !!document.querySelector('.rw-notice')); await page.waitForTimeout(300);
  assert.equal(await page.locator('.rw-source').count(), 1, 'the original stays open');
  assert.equal((await markAt(page, '.rw-main')).at, X.reportText.lastIndexOf(SAID));
  await page.keyboard.press('Escape');
  assert.equal(await activeKey(page), key); assert.ok(await inView(page));
  // The late correction withdrew 실패 후 계속 (I2) only: I1 still names its own report.
  const p = await saved(page), m = RR.requestMatches(p);
  assert.equal(RR.itemReading(m, { requestId: X.Q1.id, itemId: 'I2' }).state, 'not-made'); assert.equal(RR.itemReading(m, { requestId: X.Q2.id, itemId: 'I1' }).state, 'made');
  await page.locator('.rw-pick[data-rw-section="item:I2"]').click();
  assert.ok((await page.locator('.rw-card.lead .rw-target .rw-by').first().textContent()).includes('실패 후 계속 처리로 바꿨다고 보고함'));
  assert.deepEqual(sent.filter(x => !x.includes('/api/studio/map')), []); assert.deepEqual(errors, []);
  ok('U a map reading lands while the withdrawn original is open: it stays, back to the exact button in view; the new withdrawal names its own (I2) report only');
  await ctx.close();
}
function reply(ask, body) {
  const rec = ask.records.find(r => r.spans.some(x => x.t.includes('늦은 정정'))), at = rec.spans.find(x => x.t.trimStart().startsWith('늦은 정정')).s;
  const prior = ask.priors.find(x => x.quote.startsWith('한 파일이 실패해도')); assert.ok(prior);
  const seven = ask.schemaVersion === 'studio.map.7';
  const match = { at, text: '[스텁] 실패 후 계속 보고를 철회하고 미구현이라고 정정함', kind: 'reported', stance: 'not-made', ...(seven ? { aboutAt: null } : { about: null }),
    targets: [{ requestId: X.Q1.id, itemId: 'I2' }], why: '[스텁] 같은 항목의 앞 보고를 철회', replaces: prior.key };
  return { status: 200, contentType: 'application/json', body: JSON.stringify({ model: 'stub-135', evidence: { index: 'span.2', ask: textDigest(body) }, reply: { summary: '[스텁] 늦은 정정', parts: [], relations: [], candidates: [], gaps: [], matches: [match], material: [] } }) };
}

/* ---------- P: the change plan's results rail (no quote pane there: the original reads in its fold) ---------- */
async function rail(browser, base) {
  const { ctx, page, errors, sent } = await context(browser, base);
  const before = await stores(page);
  await page.locator('#plan-entry').click(); await page.waitForTimeout(200);
  if (!(await page.locator('#plan-panel.work').count())) await page.locator('.ps-more').click();
  await page.getByRole('button', { name: /^돌아온 기록 · 요청문/ }).click();
  const r = page.locator('#plan-panel .pw-rail-body'); await r.locator('.request-results').waitFor();
  const line = r.locator('.request-target'); assert.equal(await line.count(), 1);
  assert.ok((await line.locator('p').first().textContent()).includes('‘폴더 입력’'));
  const fold = line.locator('details.request-quote'); await fold.locator('summary').click();
  assert.equal(await fold.locator('summary').textContent(), '철회한 보고 원문');
  const m = await page.evaluate(() => { const k = document.querySelector('#plan-panel .request-target details.request-quote mark'), pre = k.closest('pre'), g = document.createRange(); g.setStart(pre, 0); g.setEndBefore(k); return { at: g.toString().length, text: k.textContent }; });
  assert.deepEqual(m, { at: X.reportText.lastIndexOf(SAID), text: SAID });
  assert.deepEqual(await sideways(page, '#plan-panel .pw-rail-body'), [0, 0]);
  assert.deepEqual(await stores(page), before); assert.deepEqual(sent, []); assert.deepEqual(errors, []);
  ok('P plan rail: the same named line; the report\'s original in its fold, marked at the second place; no sideways');
  await ctx.close();
}

/* ---------- N: narrow window ---------- */
async function small(browser, base) {
  const { ctx, page, errors, sent } = await context(browser, base, [390, 844]);
  await pane(page); await openItem(page, X.Q1, 'I1');
  assert.deepEqual(await sideways(page, '#lens .lens-body'), [0, 0]);
  const h = await page.locator('#lens .request-target p').first().evaluate(e => e.getBoundingClientRect().height); assert.ok(h < 140, `the line stays short (${h}px)`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/n-narrow.png` });
  await itemOf(page, X.Q1, 'I1').locator('.request-wide.item').click(); await wideOpen(page).waitFor();
  assert.deepEqual(await sideways(page, '.rw-main'), [0, 0]);
  assert.deepEqual(sent, []); assert.deepEqual(errors, []);
  ok('N 390×844: the named target wraps in the list and the wide card, no sideways scroll', `${Math.round(h)}px`);
  await ctx.close();
}

const { proc, base } = await start();
const browser = await chromium.launch();
try {
  await narrow(browser, base); await wide(browser, base); await corrections(browser, base); await landing(browser, base); await rail(browser, base); await small(browser, base);
  console.log(`# ${results.length} checks passed`);
} finally { await browser.close(); proc.kill(); }
