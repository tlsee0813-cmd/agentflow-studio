// AF126 the returned results of one request read wide. Auxiliary Node Playwright flow (like reading123-flow.mjs), not part of CI:
//   node continuity/tests/connected126-flow.mjs [shots-dir]        (from app/, after the continuity build)
// Real local app (studio-smoke-server, no key: nothing can be sent). The project is author-written in the 121 shape, never a
// model's reading: two frozen requests whose items share a title (the earlier one with no return), a report naming the later
// request with a long run condition, two provided code files and a check log, a later correction withdrawing one report, a
// passage left between two items, one excluded by the person and unrelated ones. Replies are labelled '[스텁]'.
//   W. Map return pane → an item's '넓게 읽기' → every passage at a paragraph's width (lead, kinds, full condition, quote) →
//      typed code and long-condition originals in the same dialog → back to the same button and scroll; withdrawn history,
//      ambiguous, excluded and unrelated sections and their originals; the other same-titled request shows nothing of it;
//      Esc/close back to the opener with the pane's items, scroll, camera and address as left; stores byte for byte.
//   R. The pane re-renders underneath (a late status): closing restores the same item, scroll and button by identity.
//   N. The narrow pane's excluded fold and an ambiguous quote come back open and focused (exact keys).
//   P. A part's lens and the change plan's results rail open the very request chosen there (the plan's select), and come back.
//   X. Another address or project while it is open: it closes, nothing restored there. Narrow window: no sideways scroll.
//   D. The no-digest line: scoped to the summary where a map reading exists, unchanged where none does.
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
const RR = await import(`${ROOT}dist/public/shared/request-return.js`);
const { studioView } = await import(`${ROOT}dist/public/shared/studio.js`), { emptyBundle, saveBundle } = await import(`${ROOT}dist/public/client/plan-store.js`);
const W = 'agentflow.idea015.workspace', PLANS = 'agentflow.studio.plans.1', MAIN = 'E_conn126-aaaa-0001', OTHER = 'E_conn126-bbbb-0002';
const CAMERA = () => document.getElementById('world').style.transform;

/* ---------- the project (author-written) ---------- */
const T1 = '리본 라벨 입력 시 빌드 대상·절전 제한 안내 도구';
const D1 = 'HINK-E0213은 SSD1673/ssd16xx/reel_board, HINK-E0213A22는 SSD1675A/ssd16xx/reel_board@2 대응을 함께 표시하는 PC용 도구를 새로 만든다. 라벨이 비거나 모르는 값이면 대상을 추정하지 않고 확인 필요를 알리며, PCB 버전만으로 고르지 않는다. 빌드·플래싱은 실행하지 않고 Low Power 절전 불가 제한을 안내에 유지한다.';
const T2 = '안내 도구 검사 기록', D2 = '도구의 대응 규칙과 화면 동작이 검사로 확인된다.';
export const COND = '조건: commit 6d9c2abc8c10f1aaddecd0f9bc7934153dfcc230 · examples/reel-label-guide/만 추가 · Node v22.22.0 · Windows 11 · Chromium headless(Playwright 1.63.0) 1280×720 · 127.0.0.1 http · 다크 테마·file:// 포함';
const report = rq => [`작업 보고: 리본 라벨 안내 도구 (요청 ${rq})`, COND,
  'examples/reel-label-guide/에 리본 라벨을 입력하면 빌드 대상과 Low Power 절전 제한을 안내하는 도구를 추가했습니다.',
  '| 6d9c2ab 깨끗한 사본 · Node v22.22.0 기본 test | `node --test` 2개 파일 | 20/20 통과, exit 0 |',
  '| 6d9c2ab · Chromium headless(Playwright 1.63.0) 1280×720 · 127.0.0.1 http | 키보드 입력, 정상↔미상 전환, Esc, Tab, Enter, HTML 입력 | 두 라벨 정확 대응, 미상 시 값 비움, HTML 미실행, console 오류 0, 외부 요청 0, 정상 입력 상태 17/17 세로 스크롤 없음 |',
  '| 같은 흐름 · 다크 테마 · `file://` 직접 열기 | 동일 | 오류 0, 같은 결과 |',
  '| 원 reel board 빌드·flash·전력 측정 | 실행 안 함 | 해당 없음 |',
  '| root 독립 실행·1280 확인 | 아직 회수 전 | 미확인 |',
  '검사 기록: 대응 규칙 검사 결과를 tests/label-lookup.test.js에 남겼습니다.',
  '이 보고는 AgentFlow 앱(app/**)을 바꾸거나 배포하지 않은 별도 시제품에 대한 것입니다.'].join('\n');
const LOOKUP = ['// label-lookup.js', 'const ENTRIES = [',
  "  { label: 'HINK-E0213', panel: 'GDEH0213B1', controller: 'SSD1673', driver: 'ssd16xx', board: 'reel_board' },",
  "  { label: 'HINK-E0213A22', panel: 'GDEH0213B72', controller: 'SSD1675A', driver: 'ssd16xx', board: 'reel_board@2' },", '];', '',
  'function normalizeInput(raw) {', "  if (typeof raw !== 'string') return '';", '  return raw.trim();', '}', '',
  'function findEntry(raw) {', '  const label = normalizeInput(raw);', "  if (label === '') return null;", '  for (const entry of ENTRIES) {',
  '    if (entry.label === label) return entry;', '  }', '  return null;', '}', ''].join('\n');
const APPJS = ['// app.js', 'function renderState(raw) {', '  const entry = findEntry(raw);',
  "  if (!entry) return { state: 'needs-check', reason: raw.trim() === '' ? 'empty' : 'unrecognized', board: '' };",
  "  return { state: 'match', reason: 'matched', board: entry.board, note: 'Low Power 모드로 소비 전력을 줄일 수 없어요.' };", '}', ''].join('\n');
const CHECK = ['label-lookup.test.js 결과', '환경: Node v22.22.0 · Windows 11', '✓ HINK-E0213 → reel_board', '✓ HINK-E0213A22 → reel_board@2',
  '✓ 미상 라벨은 대상 없이 확인 필요', '✓ 화면 상태 17/17', '20 passed, 0 failed', ''].join('\n');
const correction = rq => `정정 보고 (요청 ${rq}): 앞 보고의 검사 기록 문장은 철회합니다. 검사 기록 파일은 아직 만들지 않았고 미구현입니다.`;
/** The earlier request's own return (it names that request): long enough to scroll, so moving between the two is a real move. */
const DB = 'HINK-E0213과 HINK-E0213A22의 빌드 대상을 안내하는 도구를 만든다. 라벨 표와 화면 문구는 반려 전 범위의 것이며, 절전 제한과 미상 라벨 처리는 이 범위에 넣지 않았다. 보드 버전·PCB 표기·드라이버 이름은 원문에 있는 그대로만 쓴다.';
const B_LINES = Array.from({ length: 6 }, (_, i) => `B 범위 확인 ${i + 1}: 반려 전 범위의 라벨 표 ${i + 1}행을 손으로 대조했습니다. 화면 문구와 보드 이름이 원문 표와 같았다고 적었습니다. 실행 환경은 기록하지 않았습니다.`);
const reportB = rq => [`반려 전 범위 보고 (요청 ${rq})`, ...B_LINES].join('\n');
/** Arrives after the visit began: a correction withdrawing the I1 change report (read only when the person asks, in the D2 check). */
const late = rq => `늦은 정정 (요청 ${rq}): examples/reel-label-guide/ 도구 추가 보고는 철회합니다. 아직 커밋되지 않아 미구현입니다.`;
const INTENT = ['리본 라벨을 넣으면 빌드 대상과 절전 제한을 안내하는 PC 도구, 그리고 그 검사 기록을 원해.',
  'HINK-E0213과 HINK-E0213A22 두 라벨만 다루고, 모르는 라벨은 추정하지 않고 확인이 필요하다고 알려 줘야 해.',
  'PCB 버전 표기만으로 대상을 고르지 말고, 빌드나 플래싱은 실행하지 않아. Low Power 모드로 전력을 줄일 수 없다는 제한은 늘 안내에 남겨 줘.',
  '검사는 대응 규칙과 화면 상태를 따로 남기고, 실제 보드에서 확인하지 않은 것은 확인하지 않았다고 적어 줘.',
  'AgentFlow 앱 자체는 바꾸지 않고 examples 아래 별도 시제품으로만 만들어.'].join(' ');

const piece = (inp, alias, words) => { const x = inp.ask.records.find(r => r.id === alias)?.spans.find(s => s.t.trimStart().startsWith(words)); if (!x) throw new Error(`no piece ${alias}: ${words}`); return x.s; };
const range = (inp, alias, a, b) => `${piece(inp, alias, a)}-${piece(inp, alias, b).split('.')[1]}`;
const aliasOf = (inp, text) => { const r = inp.ask.records.find(r => inp.records.get(r.id)?.text === text); if (!r) throw new Error('no alias'); return r.id; };
const reply6 = o => ({ summary: '', parts: [], relations: [], candidates: [], gaps: [], matches: [], material: [], ...o });
const meta = (id, n) => ({ id, at: new Date(Date.now() + n).toISOString(), model: 'stub-126', prompt: 'm6-000000000126', hash: String(n).repeat(64).slice(0, 64) });
function plan(p, area, items, intent) {
  const evidence = [{ id: 'INTENT', kind: 'user', title: '원함', text: intent, basis: '사용자 초안' }];
  const analysis = { summary: '[스텁] 라벨 안내', items: items.map(([title, description], i) => ({ id: `I${i + 1}`, title, description, partIds: [area], refs: ['INTENT'], dependsOn: [] })), impacts: [], preserve: [], unknowns: [] };
  return C.createPlan(p.id, '기준', intent, evidence, analysis);
}
function build() {
  let p = D.rename(D.createProject(), 'zephyr-reel-board · 126');
  p = D.pasteRecord(p, '요구: 리본 라벨을 입력하면 빌드 대상과 절전 제한을 안내하는 PC용 도구를 만든다.\nHINK-E0213은 reel_board, HINK-E0213A22는 reel_board@2로 안내한다.', null).project;
  const a0 = M.buildMapAsk(p, studioView(p), [], undefined, M.MAP6_SCHEMA), n1 = aliasOf(a0, p.pasted[0].text);
  p = M.applyReading(p, a0, M.validateMapReply(reply6({ summary: '[스텁] 라벨 안내 도구를 읽은 자리예요.', parts: [{ ref: 'new:lookup', name: '리본 라벨 조회', parent: null, role: '[스텁] 라벨로 빌드 대상을 찾는다.', roleAbout: null, roleReplaces: null,
    basis: [piece(a0, n1, '요구:')], claims: [{ kind: 'want', text: '[스텁] 라벨 입력으로 빌드 대상과 절전 제한을 안내받기를 원함', at: piece(a0, n1, '요구:'), about: null, replaces: null, key: 's1' }] }] }), a0.ask), meta('R_126_first', 1)).project;
  const area = p.space.areas[0].id;
  // The earlier, rejected request: the same item title, another description, no return.
  const rejected = C.requestSnapshot(plan(p, area, [[T1, DB]], '[스텁] 반려된 범위'));
  const accepted = plan(p, area, [[T1, D1], [T2, D2]], INTENT), snap = C.requestSnapshot(accepted);
  const A = snap.scope, B = rejected.scope;
  // The earlier request's own return, read first in its own reading.
  p = D.pasteRecord(p, reportB(B.id), null).project;
  const ab = M.buildMapAsk(p, studioView(p), [A, B], undefined, M.MAP6_SCHEMA), RB = aliasOf(ab, reportB(B.id));
  p = M.applyReading(p, ab, M.validateMapReply(reply6({ summary: '[스텁] 반려 전 범위 보고를 읽은 자리예요.', matches: B_LINES.map((_, i) => ({ at: piece(ab, RB, `B 범위 확인 ${i + 1}:`), text: `[스텁] 반려 전 범위 ${i + 1}행을 손으로 대조했다고 보고함 (B 범위)`,
    kind: 'checked', stance: 'unclear', about: null, targets: [{ requestId: B.id, itemId: 'I1' }], why: '[스텁] 요청 항목과 대조한 구절', replaces: null })) }), ab.ask), meta('R_126_b', 4)).project;
  p = D.pasteRecord(p, report(A.id), null).project;
  p = D.provideRecord(p, LOOKUP, { kind: 'code', name: 'label-lookup.js', version: '6d9c2abc8c10f1aaddecd0f9bc7934153dfcc230', origin: 'examples/reel-label-guide/label-lookup.js' }, null).project;
  p = D.provideRecord(p, APPJS, { kind: 'code', name: 'app.js', version: '6d9c2abc8c10f1aaddecd0f9bc7934153dfcc230', origin: 'examples/reel-label-guide/app.js' }, null).project;
  p = D.provideRecord(p, CHECK, { kind: 'test', name: 'label-lookup.test.log', version: null, origin: null }, null).project;
  const a1 = M.buildMapAsk(p, studioView(p), [A, B], undefined, M.MAP6_SCHEMA);
  const R = aliasOf(a1, report(A.id)), K1 = aliasOf(a1, LOOKUP), K2 = aliasOf(a1, APPJS), T = aliasOf(a1, CHECK);
  const t = (...ids) => ids.map(itemId => ({ requestId: A.id, itemId }));
  const mm = (at, kind, targets, text, o = {}) => ({ at, text: `[스텁] ${text}`, kind, stance: 'unclear', about: null, targets, why: '[스텁] 요청 항목과 대조한 구절', replaces: null, ...o });
  const matches = [
    mm(piece(a1, R, 'examples/reel-label-guide/에'), 'reported', t('I1'), '리본 라벨 안내 도구를 examples/reel-label-guide/에 추가했다고 보고함', { stance: 'made', about: COND }),
    mm(piece(a1, R, '| 6d9c2ab 깨끗한 사본'), 'checked', t('I1'), '깨끗한 사본에서 node --test 2개 파일 20/20 통과를 보고함'),
    mm(piece(a1, R, '| 6d9c2ab · Chromium'), 'checked', t('I1'), 'Chromium headless 1280×720에서 키보드·정상↔미상 전환·HTML 입력 흐름이 두 라벨 정확 대응, 미상 시 값 비움, console 오류 0, 외부 요청 0이라고 보고함'),
    mm(piece(a1, R, '| 같은 흐름'), 'checked', t('I1'), '다크 테마와 file:// 직접 열기에서 같은 결과를 보고함'),
    mm(piece(a1, R, '| 원 reel board'), 'open', t('I1'), '원 reel board 빌드·flash·전력 측정은 실행하지 않았다고 남김'),
    mm(piece(a1, R, '검사 기록:'), 'reported', t('I2'), '대응 규칙 검사 결과를 tests/label-lookup.test.js에 남겼다고 보고함', { stance: 'made' }),
    mm(piece(a1, R, '| root 독립'), 'open', t('I2'), 'root 독립 실행·1280 확인은 아직 회수 전이라고 남김'),
    mm(piece(a1, K1, 'const ENTRIES'), 'code', t('I1'), '두 라벨의 패널·컨트롤러·드라이버·보드 대응 표'),
    mm(range(a1, K1, 'function normalizeInput', 'return null;'), 'code', t('I1'), '앞뒤 공백만 지우고 전체 일치로 라벨을 찾으며 빈 값은 대상 없음'),
    mm(range(a1, K2, 'function renderState', "return { state: 'match'"), 'code', t('I1'), '대상이 없으면 확인 필요 상태, 있으면 보드와 절전 제한 안내'),
    mm(piece(a1, T, '✓ HINK-E0213 →'), 'test', t('I1'), 'HINK-E0213 → reel_board 검사 기록', { about: '환경: Node v22.22.0 · Windows 11' }),
    mm(piece(a1, T, '20 passed'), 'test', t('I2'), '20개 통과 검사 기록', { about: '환경: Node v22.22.0 · Windows 11' }),
    mm(piece(a1, T, '✓ 화면 상태'), 'test', t('I1', 'I2'), '화면 상태 17/17 검사 기록'),
    mm(piece(a1, T, '✓ 미상 라벨은'), 'test', [], '미상 라벨 검사 기록'),
    mm(piece(a1, R, '이 보고는 AgentFlow'), 'reported', [], 'AgentFlow 앱을 바꾸지 않은 별도 시제품이라는 설명')];
  p = M.applyReading(p, a1, M.validateMapReply(reply6({ summary: '[스텁] 라벨 안내 도구 보고와 코드·검사 자료를 요청과 대조한 자리예요.', matches }), a1.ask), meta('R_126_return', 2)).project;
  p = RR.correctRequestMatch(p, 'R_126_return', 3, null);   // the person excludes the dark-theme row
  p = D.pasteRecord(p, correction(A.id), null).project;
  const a2 = M.buildMapAsk(p, studioView(p), [A, B], undefined, M.MAP6_SCHEMA), Cn = aliasOf(a2, correction(A.id));
  const key = a2.ask.priors.find(x => x.quote.startsWith('검사 기록:')).key;
  p = M.applyReading(p, a2, M.validateMapReply(reply6({ summary: '[스텁] 정정 보고를 읽은 자리예요.', matches: [mm(piece(a2, Cn, '정정 보고'), 'reported', t('I2'), '검사 기록 문장을 철회하고 아직 미구현이라고 정정함', { stance: 'not-made', replaces: key })] }), a2.ask), meta('R_126_fix', 3)).project;
  const project = JSON.parse(S.serializeProject(p));
  const bundle = { ...emptyBundle(''), plan: accepted, by: { kind: 'ai', model: 'stub-126', at: snap.createdAt, records: { total: 1, sent: 1 } }, snapshots: [rejected, snap],
    labels: { [rejected.id]: { I1: T1 }, [snap.id]: { I1: T1, I2: T2 } }, origins: { [rejected.id]: 'ai', [snap.id]: 'ai' } };
  // D2: the same project with the late correction pasted after the last reading (unread: a map reading may be asked for it).
  const later = JSON.parse(S.serializeProject(D.pasteRecord(p, late(A.id), null).project));
  return { project, later, bundle, A, B, area };
}
const X = build();
{ // The fixture reads as meant, through the shared reading only (no assumption about the UI).
  const m = RR.requestMatches(X.project), i1 = RR.itemReading(m, { requestId: X.A.id, itemId: 'I1' }), i2 = RR.itemReading(m, { requestId: X.A.id, itemId: 'I2' });
  assert.equal(i1.current.length, 8); assert.equal(i1.state, 'made'); assert.equal(i2.history.length, 1); assert.equal(i2.state, 'not-made');
  assert.equal(RR.itemReading(m, { requestId: X.B.id, itemId: 'I1' }).current.length, 6);
  assert.equal(m.filter(x => x.excluded).length, 1); assert.ok(COND.length > 150 && COND.length <= 200);
}
const other = (() => { let p = D.rename(D.createProject(), '다른 프로젝트 · 기록만'); p = D.pasteRecord(p, '요구: 같은 제목의 다른 일. 리본 라벨 입력 시 빌드 대상·절전 제한 안내 도구.', null).project; return JSON.parse(S.serializeProject(p)); })();
const mem = new Map(), kv = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: k => mem.delete(k) };
assert.equal(saveBundle(kv, X.project.id, X.bundle), null);
const entry = (entryId, project) => ({ entryId, state: 'active', lifecycle: 1, seq: 1, createdAt: new Date().toISOString(), trashedAt: null, origin: 'new', project });
mem.set(W, JSON.stringify({ version: 'agentflow.workspace.1', migratedFromLegacy: false, entries: [entry(MAIN, X.project), entry(OTHER, other)] }));
const SEED = Object.fromEntries(mem);
const LATE = { ...SEED, [W]: JSON.stringify({ version: 'agentflow.workspace.1', migratedFromLegacy: false, entries: [entry(MAIN, X.later), entry(OTHER, other)] }) };

/* ---------- server, page ---------- */
function start() {
  // ok: the stub transport's server (a placeholder key, never a real one), so a map reading can be asked; no map request reaches
  // it here: the one in L is answered in the page by this test, the rest send nothing.
  const proc = spawn(process.execPath, [`${ROOT}tests/studio-smoke-server.mjs`], { cwd: APP, env: { ...process.env, STUDIO_STUB: 'ok', PORT: '0' }, stdio: ['ignore', 'pipe', 'inherit'] });
  return new Promise((res, rej) => { proc.stdout.once('data', d => { const m = /READY (http:\/\/\S+)/.exec(String(d)); m ? res({ proc, base: m[1] }) : rej(new Error(String(d))); }); proc.once('exit', c => rej(new Error(`server exit ${c}`))); });
}
const results = [];
const ok = (name, detail = '') => { results.push(name); console.log(`ok - ${name}${detail ? ` · ${detail}` : ''}`); };
async function context(browser, base, size = [1280, 720], hold = false, seed = SEED, release = false) {
  const ctx = await browser.newContext({ viewport: { width: size[0], height: size[1] } });
  const page = await ctx.newPage(), errors = [], sent = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('request', r => { if (r.method() !== 'GET') sent.push(`${r.method()} ${r.url()}`); });
  let open = () => {};
  if (hold) { const gate = new Promise(r => { open = r; }); await page.route('**/api/studio/status', async route => { await gate; await route.continue(); }); }
  // E: the status as the limited existing-map release Worker says it (the same server's body with its policy named).
  if (release) await page.route('**/api/studio/status', async route => { const r = await route.fetch(); await route.fulfill({ response: r, json: { ...(await r.json()), release: 'existing-map' } }); });
  await page.goto(`${base}/`);
  await page.evaluate(x => { localStorage.clear(); sessionStorage.clear(); for (const [k, v] of Object.entries(x)) localStorage.setItem(k, v); }, seed);
  await page.evaluate(h => history.replaceState(null, '', h), `#/p/${MAIN}`); await page.reload();
  await page.locator('#world .node').first().waitFor();
  return { ctx, page, errors, sent, release: () => open() };
}
const stores = page => page.evaluate(([a, b]) => [localStorage.getItem(a), localStorage.getItem(b)], [W, PLANS]);
const active = page => page.evaluate(() => { const a = document.activeElement; return { key: a?.dataset.requestFocus ?? a?.dataset.rwFocus ?? null, text: a?.textContent ?? '', cls: a?.className ?? '' }; });
/** Sideways overflow of the page and of a box (its own content, never hidden). */
const sideways = (page, sel) => page.evaluate(s => { const d = document.scrollingElement, b = s ? document.querySelector(s) : null;
  return { page: d.scrollWidth - d.clientWidth, box: b ? b.scrollWidth - b.clientWidth : null }; }, sel);
const wideOpen = page => page.locator('#request-wide:not([hidden])');
/** The focused control lies wholly inside the reading column as it is scrolled now. */
const shown = page => page.evaluate(() => { const a = document.activeElement, m = document.querySelector('#request-wide .rw-main'); if (!a || !m || !m.contains(a)) return false;
  const r = a.getBoundingClientRect(), b = m.getBoundingClientRect(); return r.height > 0 && r.top >= b.top && r.bottom <= b.bottom; });
async function openPaneItem(page) {
  await page.locator('#return-entry').click(); await page.locator('#lens .rr-map .request-results').waitFor();
  // A's first item, by its exact identity (B's same-titled item reads in its own group).
  const item = page.locator('#lens .request-item').filter({ has: page.locator(`summary[data-request-focus^='["${X.A.id}"']`) }).first();
  await item.locator(':scope > summary').click();
  const opener = item.locator('.request-wide.item');
  await opener.scrollIntoViewIfNeeded(); await opener.focus();
  return { item, opener };
}

/* ---------- W ---------- */
async function wide(browser, base) {
  const { ctx, page, errors, sent } = await context(browser, base);
  const before = await stores(page);
  const { item, opener } = await openPaneItem(page);
  const body = page.locator('#lens .lens-body'), scroll0 = await body.evaluate(e => e.scrollTop), url0 = page.url(), camera0 = await page.evaluate(CAMERA);
  const openerKey = await opener.getAttribute('data-request-focus');
  // Before: how much of the item the pane's own column gives to its text.
  const narrow = await item.locator('.request-passage p').first().evaluate(e => e.clientWidth);
  await opener.click();
  const dlg = wideOpen(page); await dlg.waitFor();
  assert.equal(await page.locator('#rw-item-title').textContent(), T1);
  assert.ok((await page.locator('.rw-req').textContent()).includes('판 1'));
  const pick = await page.locator('.rw-pick[aria-current="true"]').getAttribute('data-rw-section'); assert.equal(pick, 'item:I1');
  assert.equal((await active(page)).cls.includes('rw-pick'), true, 'focus starts on the chosen item');
  const cards = page.locator('.rw-main .rw-card'); assert.equal(await cards.count(), 8, 'lead and every standing passage of I1');
  assert.equal(await page.locator('.rw-main .rw-card.lead').count(), 1);
  assert.ok((await page.locator('.rw-want p').textContent()) === D1, 'the wish, whole');
  const cond = page.locator('.rw-cond > span:last-child').first(); assert.equal(await cond.textContent(), COND, 'the stored condition, whole');
  const metrics = await page.evaluate(() => { const t = document.querySelector('.rw-card-text'), m = document.querySelector('.rw-main'), n = document.querySelector('.rw-nav');
    return { text: t.clientWidth, main: m.clientWidth, mainSide: m.scrollWidth - m.clientWidth, nav: n.clientWidth, navSide: n.scrollWidth - n.clientWidth, height: m.scrollHeight, view: m.clientHeight }; });
  assert.ok(metrics.text >= 680 && metrics.text <= 760, JSON.stringify(metrics)); assert.equal(metrics.mainSide, 0); assert.equal(metrics.navSide, 0);
  assert.deepEqual(await sideways(page, null), { page: 0, box: null });
  ok('W wide item: wish, lead, 8 passages, full condition', `text ${metrics.text}px (pane ${narrow}px) · column ${metrics.main}px · ${metrics.height}px content in ${metrics.view}px · no sideways scroll`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/w-item.png` });

  // A typed code original, in the same dialog; Esc back to the same button and scroll.
  const codeCard = page.locator('.rw-card', { hasText: '앞뒤 공백만 지우고' });
  await codeCard.scrollIntoViewIfNeeded(); const main = page.locator('.rw-main');
  const mainScroll = await main.evaluate(e => e.scrollTop), codeKey = await codeCard.locator('.rw-src').getAttribute('data-rw-focus');
  await codeCard.locator('.rw-src').click();
  await page.locator('.rw-source').waitFor();
  assert.equal(await page.locator('.rw-source h3').textContent(), 'label-lookup.js');
  assert.ok((await page.locator('.rw-meta').textContent()).includes('6d9c2abc8c10f1aaddecd0f9bc7934153dfcc230 (사용자 기재)'));
  const mark = await page.locator('.rw-main .rr-mark').textContent(); assert.ok(mark.startsWith('function normalizeInput(raw) {') && mark.endsWith('return null;'), mark);
  assert.ok(await page.locator('.rw-main .rr-mark').evaluate(e => { const r = e.getBoundingClientRect(), b = e.closest('.rw-main').getBoundingClientRect(); return r.top >= b.top && r.top < b.bottom; }), 'the mark is in view');
  assert.ok((await active(page)).cls.includes('rw-src-back'));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/w-code.png` });
  await page.keyboard.press('Escape');
  await page.locator('.rw-item').waitFor();
  assert.equal((await active(page)).key, codeKey); assert.ok(Math.abs(await main.evaluate(e => e.scrollTop) - mainScroll) <= 1); assert.ok(await shown(page), 'an unmoved button: same scroll, in view');
  ok('W typed code original in place, Esc back to the same button and scroll');
  // The long-condition row: its original, then the back button (click).
  const rowCard = page.locator('.rw-card', { hasText: 'Chromium headless 1280×720' }), rowKey = await rowCard.locator('.rw-src').getAttribute('data-rw-focus');
  await rowCard.locator('.rw-src').click();
  assert.ok((await page.locator('.rw-main .rr-mark').textContent()).includes('정상 입력 상태 17/17 세로 스크롤 없음 |'));
  assert.equal(await page.locator('.rw-reading').textContent().then(t => t.includes('Chromium headless')), true);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/w-condition.png` });
  await page.locator('.rw-src-back').click();
  assert.equal((await active(page)).key, rowKey);
  ok('W long condition row original and back by the button');

  // I2 by keyboard: the current not-made correction, and the withdrawn report in its own fold (kept open across an original).
  await page.locator('.rw-pick[data-rw-section="item:I2"]').focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator('#rw-item-title').textContent(), T2);
  assert.ok((await page.locator('.rw-state').textContent()) === '미구현 보고');
  // AF135: the withdrawing lead names the report it took back (the general mark gives way to it).
  assert.ok((await page.locator('.rw-card.lead .rw-target').textContent()).includes('대응 규칙 검사 결과를 tests/label-lookup.test.js에 남겼다고 보고함'));
  const hist = page.locator('.rw-history'); await hist.locator(':scope > summary').click();
  const w = hist.locator('.rw-card.withdrawn'); assert.equal(await w.count(), 1);
  assert.ok((await w.textContent()).includes('이후 철회·정정됨') && (await w.textContent()).includes('검사 기록 문장을 철회'));
  const wKey = await w.locator('.rw-src').getAttribute('data-rw-focus'); await w.locator('.rw-src').click();
  assert.ok((await page.locator('.rw-main .rr-mark').textContent()).startsWith('검사 기록:'));
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.rw-history').getAttribute('open'), ''); assert.equal((await active(page)).key, wKey);
  ok('W withdrawn history: its own fold, original, back with the fold open and focus');

  // The passages outside the items: ambiguous (both candidates named), excluded (its original targets), unrelated.
  for (const [g, n, words] of [['ambiguous', 1, '어느 요청의 결과인지 남음'], ['excluded', 1, '원래 대조'], ['unrelated', 2, null]]) {
    await page.locator(`.rw-pick[data-rw-section="${g}"]`).click();
    assert.equal(await page.locator('.rw-main .rw-card').count(), n, g);
    const c = page.locator('.rw-main .rw-card').first(), text = await c.textContent();
    if (words) assert.ok(text.includes(words), `${g}: ${text}`);
    if (g === 'ambiguous') assert.ok(text.includes(T1) && text.includes(T2));
    if (g === 'excluded') assert.ok(text.includes('대응에서 제외함'));
    const k = await c.locator('.rw-src').getAttribute('data-rw-focus'); await c.locator('.rw-src').click();
    await page.locator('.rw-main .rr-mark').waitFor(); await page.keyboard.press('Escape');
    assert.equal((await active(page)).key, k, g);
  }
  ok('W ambiguous/excluded/unrelated: each in its own section, original and back to its exact button');

  // The same-titled earlier request: only its own return, from its own start (S below moves from deep places).
  await page.locator('.rw-request').selectOption({ label: (await page.locator('.rw-request option').allTextContents()).find(t => t.includes('1항목')) });
  assert.equal(await page.locator('#rw-item-title').textContent(), T1);
  assert.equal(await page.locator('.rw-want p').textContent(), DB);
  const bTexts = await page.locator('.rw-main .rw-card-text').allTextContents();
  assert.equal(bTexts.length, 6); assert.ok(bTexts.every(t => t.includes('(B 범위)')), bTexts.join('|'));
  assert.equal(await page.locator('.rw-pick[data-rw-section="ambiguous"]').count(), 0);
  await page.locator('.rw-request').selectOption({ label: (await page.locator('.rw-request option').allTextContents()).find(t => t.includes('2항목')) });
  assert.equal(await page.locator('.rw-main .rw-card').count(), 8);
  ok('W the same title in the other request reads as its own (only its 6 passages, none of the later request)');

  // Esc: back to the opener, the pane as it was.
  await page.locator('.rw-request').focus(); await page.keyboard.press('Escape');
  assert.equal(await wideOpen(page).count(), 0);
  assert.equal((await active(page)).key, openerKey);
  assert.equal(await item.getAttribute('open'), '');
  assert.ok(Math.abs(await body.evaluate(e => e.scrollTop) - scroll0) <= 1);
  assert.equal(page.url(), url0); await page.waitForTimeout(200); assert.equal(await page.evaluate(CAMERA), camera0);
  assert.deepEqual(await stores(page), before, 'reading writes nothing');
  ok('W Esc back to the opener: item open, pane scroll, address, camera, stores byte for byte');

  // D: the scoped no-digest line beside a stored map reading.
  const lead = await page.locator('#lens .rr-lead').allTextContents();
  assert.ok(lead.some(t => t.startsWith('지도 정리는 기록 ') && t.includes('따로 요약한 정리는 아직 만들지 않았어요')), lead.join('|'));
  assert.ok(!lead.includes('아직 이 자료를 정리하지 않았어요.'));
  ok('D with a stored map reading: the line names only the missing separate summary', lead.find(t => t.startsWith('지도')));
  assert.deepEqual(sent, []); assert.deepEqual(errors, []);
  await ctx.close();
}

/* ---------- R: a re-render underneath, then close ---------- */
async function rerender(browser, base) {
  const { ctx, page, errors, sent, release } = await context(browser, base, [1280, 720], true);
  const { item, opener } = await openPaneItem(page);
  const body = page.locator('#lens .lens-body'), scroll0 = await body.evaluate(e => e.scrollTop), key = await opener.getAttribute('data-request-focus'), itemKey = await item.getAttribute('data-request-item');
  await opener.evaluate(e => { e.dataset.old = '1'; });
  await opener.click(); await wideOpen(page).waitFor();
  release(); await page.waitForFunction(() => document.getElementById('ai-pill')?.dataset.state !== 'checking'); await page.waitForTimeout(300);
  assert.equal(await page.locator('#lens [data-old]').count(), 0, 'the pane re-rendered underneath');
  await page.locator('.rw-head .close').click();
  const a = await active(page); assert.equal(a.key, key);
  assert.equal(await page.locator('#lens .request-item[open]').count(), 1);
  assert.equal(await page.locator('#lens .request-item[open]').getAttribute('data-request-item'), itemKey);
  assert.ok(Math.abs(await body.evaluate(e => e.scrollTop) - scroll0) <= 1);
  assert.deepEqual(sent, []); assert.deepEqual(errors, []);
  ok('R a late render underneath: close restores the same item, scroll and button by identity');
  await ctx.close();
}

/* ---------- N: the narrow pane's exact keys ---------- */
async function narrowKeys(browser, base) {
  const { ctx, page, errors, sent } = await context(browser, base);
  await page.locator('#return-entry').click(); await page.locator('#lens .request-results').waitFor();
  const fold = page.locator('#lens .request-excluded'); await fold.locator(':scope > summary').click();
  const cite = fold.locator('.cl-cite').first(); await cite.scrollIntoViewIfNeeded(); await cite.focus();
  const key = await cite.getAttribute('data-request-focus'); assert.ok(key.startsWith('["excluded"'));
  await cite.click(); await page.locator('#lens .rr-mark').waitFor(); await page.locator('#lens .rr-back').click();
  assert.equal(await page.locator('#lens .request-excluded').getAttribute('open'), ''); assert.equal((await active(page)).key, key);
  const amb = page.locator('#lens .request-ambiguous .cl-cite').first(), akey = await amb.getAttribute('data-request-focus');
  await amb.scrollIntoViewIfNeeded(); await amb.focus(); await amb.click(); await page.locator('#lens .rr-mark').waitFor(); await page.keyboard.press('Escape');
  assert.equal((await active(page)).key, akey);
  assert.deepEqual(sent, []); assert.deepEqual(errors, []);
  ok('N narrow pane: excluded fold and ambiguous quote come back open and focused by their exact keys');
  await ctx.close();
}

/* ---------- P: a part's lens and the plan's results rail ---------- */
async function partAndPlan(browser, base) {
  const { ctx, page, errors, sent } = await context(browser, base);
  const before = await stores(page);
  await page.locator(`#world [data-part="${X.area}"]`).first().click();
  await page.locator('#lens .request-results').waitFor();
  const item = page.locator('#lens .request-item').filter({ has: page.locator(`summary[data-request-focus^='["${X.A.id}"']`) }).first(); await item.locator(':scope > summary').click();
  const opener = item.locator('.request-wide.item'); await opener.focus(); const key = await opener.getAttribute('data-request-focus');
  await opener.click(); await wideOpen(page).waitFor();
  assert.equal((await page.locator('.rw-back').textContent()).trim(), '‹ 리본 라벨 조회');
  await page.keyboard.press('Escape'); assert.equal((await active(page)).key, key);
  ok('P a part lens opens the request at its item and comes back to it (named by the part)');
  await page.keyboard.press('Escape');
  // The plan's wide comparison, its results rail: the select's request, explicitly.
  await page.locator('#plan-entry').click(); await page.waitForTimeout(200);
  if (!(await page.locator('#plan-panel.work').count())) await page.locator('.ps-more').click();
  await page.getByRole('button', { name: /^돌아온 기록 · 요청문/ }).click();
  const rail = page.locator('#plan-panel .pw-rail-body'); await rail.locator('.request-results').waitFor();
  const railSide = await sideways(page, '#plan-panel .pw-rail-body'); assert.deepEqual(railSide, { page: 0, box: 0 }, 'no sideways scroll in the rail');
  const railH = await rail.evaluate(e => [e.clientWidth, e.scrollHeight]);
  for (const which of ['last', 'earlier']) {
    if (which === 'earlier') { await rail.locator('select[aria-label="대조할 요청문"]').selectOption(X.bundle.snapshots[0].id); await rail.locator('.request-results').waitFor(); }
    const b = rail.locator('.request-wide').first(); await b.scrollIntoViewIfNeeded(); await b.focus(); const k = await b.getAttribute('data-request-focus');
    const at = await rail.evaluate(e => e.scrollTop);
    await b.click(); await wideOpen(page).waitFor();
    assert.equal((await page.locator('.rw-back').textContent()).trim(), '‹ 변경 구상');
    assert.equal(JSON.parse(k)[1], which === 'last' ? X.A.id : X.B.id);
    assert.equal(await page.locator('.rw-req option:checked').textContent().then(t => t.includes(which === 'last' ? '2항목' : '1항목')), true, 'the very request chosen in the plan');
    assert.equal(await page.locator('.rw-main .rw-card').count(), which === 'last' ? 8 : 6);
    if (SHOTS && which === 'last') await page.screenshot({ path: `${SHOTS}/p-plan.png` });
    await page.locator('.rw-back').click();
    assert.equal((await active(page)).key, k); assert.ok(Math.abs(await rail.evaluate(e => e.scrollTop) - at) <= 1);
  }
  assert.deepEqual(await stores(page), before);
  assert.deepEqual(sent, []); assert.deepEqual(errors, []);
  ok('P plan rail: the selected request (last, then the earlier one) exactly, back to the opener and rail scroll', `rail ${railH[0]}px wide, ${railH[1]}px tall, no sideways scroll`);
  await ctx.close();
}

/* ---------- X: address/project changes, narrow window ---------- */
async function elsewhere(browser, base) {
  const { ctx, page, errors, sent } = await context(browser, base);
  const { opener } = await openPaneItem(page); await opener.click(); await wideOpen(page).waitFor();
  await page.evaluate(h => { location.hash = h; }, `#/p/${OTHER}`);
  await page.locator('#space-empty:not([hidden])').waitFor(); await page.waitForTimeout(200);
  assert.equal(await wideOpen(page).count(), 0, 'another project: it closes');
  await page.locator('#return-entry').click(); await page.waitForTimeout(200);
  assert.equal(await page.locator('#lens .request-results').count(), 0, 'no request of the other project shows here');
  const lead = await page.locator('#lens .rr-lead').allTextContents();
  assert.ok(lead.includes('아직 이 자료를 정리하지 않았어요.'), `no map reading: the line as before (${lead})`);
  assert.equal(await page.locator('#lens .rr-map').count(), 1, 'the map row is there (records to read), yet nothing was read');
  ok('D without a map reading (records waiting): the line as before, though the map row shows');
  await page.goBack(); await page.locator('#world .node').first().waitFor();
  const again = await openPaneItem(page); await again.opener.click(); await wideOpen(page).waitFor();
  await page.goBack(); await page.waitForTimeout(300);
  assert.equal(await wideOpen(page).count(), 0, 'another address: it closes');
  assert.deepEqual(sent, []); assert.deepEqual(errors, []);
  ok('X another project or address while open: closed, nothing restored there, no stale request');
  await ctx.close();
  const n = await context(browser, base, [390, 844]);
  await n.page.locator('#return-entry').click(); await n.page.locator('#lens .request-results').waitFor();
  const b = n.page.locator('#lens .request-wide').first(); await b.scrollIntoViewIfNeeded(); await b.click(); await wideOpen(n.page).waitFor();
  const s1 = await sideways(n.page, '.rw-main'); assert.deepEqual(s1, { page: 0, box: 0 });
  await n.page.locator('.rw-main .rw-src').first().click(); await n.page.locator('.rw-main .rr-mark').waitFor();
  assert.deepEqual(await sideways(n.page, '.rw-main'), { page: 0, box: 0 });
  if (SHOTS) await n.page.screenshot({ path: `${SHOTS}/x-narrow.png` });
  await n.page.keyboard.press('Escape'); await n.page.keyboard.press('Escape'); assert.equal(await wideOpen(n.page).count(), 0);
  assert.deepEqual(n.sent, []); assert.deepEqual(n.errors, []);
  ok('X 390×844: stacked, no sideways scroll in the item or an original; Esc twice closes');
  await n.ctx.close();
}

/* ---------- S: another request starts at its own top; V: the list keeps its scroll over an original ---------- */
async function switching(browser, base) {
  const { ctx, page, errors, sent } = await context(browser, base, [1280, 600]);
  const { opener } = await openPaneItem(page); await opener.click(); await wideOpen(page).waitFor();
  const main = page.locator('.rw-main'), nav = page.locator('.rw-nav'), pick = label => page.locator('.rw-request').selectOption({ label: label });
  const labels = await page.locator('.rw-request option').allTextContents(), toB = labels.find(t => t.includes('1항목')), toA = labels.find(t => t.includes('2항목'));
  // A deep in its item, then B.
  await main.evaluate(e => { e.scrollTop = e.scrollHeight; }); const deepA = await main.evaluate(e => e.scrollTop); assert.ok(deepA > 600, `A is long (${deepA})`);
  await pick(toB);
  assert.equal(await main.evaluate(e => e.scrollTop), 0, 'B starts at its top, not at A\'s place');
  const bLong = await main.evaluate(e => e.scrollHeight - e.clientHeight); assert.ok(bLong > 300, `B is long (${bLong})`);
  // B deep, then A: A starts at its top too.
  await main.evaluate(e => { e.scrollTop = e.scrollHeight; }); await pick(toA);
  assert.equal(await main.evaluate(e => e.scrollTop), 0, 'A starts at its top, not at B\'s place');
  // From deep inside an original of A, then B: B's item at its top (no original carried over).
  const card = page.locator('.rw-card', { hasText: 'Chromium headless 1280×720' }); await card.locator('.rw-src').click(); await page.locator('.rw-source').waitFor();
  await main.evaluate(e => { e.scrollTop = e.scrollHeight; }); const deepSrc = await main.evaluate(e => e.scrollTop); assert.ok(deepSrc > 40, `the original scrolled (${deepSrc})`);
  await pick(toB);
  assert.equal(await page.locator('.rw-source').count(), 0); assert.equal(await main.evaluate(e => e.scrollTop), 0);
  assert.equal(await page.locator('.rw-want p').textContent(), DB);
  ok('S another request (A↔B, same title) starts at its own top, also from deep in an original', `A ${deepA}px deep, B ${bLong}px long, original ${deepSrc}px deep`);
  // V: the list, scrolled to its end (the request's sentence open), keeps its place over an original and back.
  await pick(toA); await page.locator('.rw-said > summary').click();
  const navRoom = await nav.evaluate(e => e.scrollHeight - e.clientHeight); assert.ok(navRoom > 40, `the list scrolls (${navRoom})`);
  await nav.evaluate(e => { e.scrollTop = e.scrollHeight; }); const navAt = await nav.evaluate(e => e.scrollTop);
  await page.locator('.rw-pick[data-rw-section="unrelated"]').click();
  assert.ok(Math.abs(await nav.evaluate(e => e.scrollTop) - navAt) <= 1, 'picking keeps the list');
  const c = page.locator('.rw-main .rw-card').first(), k = await c.locator('.rw-src').getAttribute('data-rw-focus');
  await c.locator('.rw-src').click(); await page.locator('.rw-main .rr-mark').waitFor();
  assert.ok(Math.abs(await nav.evaluate(e => e.scrollTop) - navAt) <= 1, 'an original keeps the list');
  await page.keyboard.press('Escape');
  assert.ok(Math.abs(await nav.evaluate(e => e.scrollTop) - navAt) <= 1, 'back keeps the list'); assert.equal((await active(page)).key, k);
  assert.equal(await page.locator('.rw-said').getAttribute('open'), '');
  assert.deepEqual(sent, []); assert.deepEqual(errors, []);
  ok('V the list keeps its scroll (and the open sentence) over a pick, an original and back', `list ${navRoom}px of scroll, at ${navAt}`);
  await ctx.close();
}

/* ---------- L: a map reading of this visit lands while it is open (a reply the test writes; no model) ---------- */
async function landing(browser, base) {
  const { ctx, page, errors, sent } = await context(browser, base, [1280, 720], false, LATE);
  const before = await page.evaluate(k => localStorage.getItem(k), PLANS);
  let ask = null, body = null, answer = null; const gate = new Promise(r => { answer = r; });
  await page.route('**/api/studio/map', async route => { body = route.request().postData(); ask = JSON.parse(body); await gate; await route.fulfill(await replyFor(ask, body)); });
  await page.locator('#return-entry').click(); await page.locator('#lens .rr-map').waitFor();
  await page.locator('#lens .rr-map').getByRole('button', { name: '기록 읽고 지도 갱신' }).click();
  await page.waitForFunction(() => !!document.querySelector('#lens .rr-map .pending'));
  const item = page.locator('#lens .request-item').filter({ has: page.locator(`summary[data-request-focus^='["${X.A.id}"']`) }).first(); await item.locator(':scope > summary').click();
  const opener = item.locator('.request-wide.item'); await opener.click(); await wideOpen(page).waitFor();
  const lead = page.locator('.rw-card.lead'); assert.ok((await lead.textContent()).includes('examples/reel-label-guide/에 추가했다고 보고함'));
  const key = await lead.locator('.rw-src').getAttribute('data-rw-focus');
  await lead.locator('.rw-src').click(); await page.locator('.rw-source').waitFor();
  assert.equal(await page.locator('.rw-reading .rw-tag.off').count(), 0);
  answer(); await page.waitForFunction(() => !!document.querySelector('.rw-notice'));
  await page.waitForTimeout(300);
  // The original being read stays, now said to be withdrawn; the pane it was opened from closed with the applied reading.
  assert.equal(await page.locator('.rw-source').count(), 1);
  assert.equal(await page.locator('.rw-reading .rw-tag.off').textContent(), '이후 철회·정정됨');
  const notice = await page.locator('.rw-notice').textContent();
  assert.ok(notice.includes('지금 저장된 내용으로 다시 읽었어요') && notice.includes('화면은 그 사이 닫혔어요'), notice);
  assert.equal((await page.locator('.rw-back').textContent()).trim(), '‹ 지도');
  assert.equal(await page.locator('#lens:not([hidden]).return-read').count(), 0, 'the return pane closed (mapApplied)');
  // Back: the same passage's button, now inside the opened history fold (and in view there: it moved below the old place); the
  // new correction leads.
  await page.keyboard.press('Escape');
  assert.equal((await active(page)).key, key);
  assert.ok(await shown(page), 'the button it comes back to is in view in the column');
  assert.equal(await page.locator('.rw-history').getAttribute('open'), '');
  assert.ok((await page.locator('.rw-card.lead').textContent()).includes('[스텁] 늦은 정정'));
  assert.equal(await page.locator('.rw-state').textContent(), '미구현 보고');
  assert.equal(await page.locator('.rw-history .rw-card.withdrawn').count(), 1);
  assert.equal(await page.locator('.rw-main > .rw-item > .rw-sec .rw-card').count(), 8, 'lead + 7 standing (the withdrawn one left them)');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/l-landed.png` });
  // Close: the opener's reading is gone, so the map (never another reading in its place).
  await page.locator('.rw-head .close').click();
  assert.equal(await wideOpen(page).count(), 0); assert.equal(await page.evaluate(() => document.activeElement?.id), 'viewport');
  const saved = await page.evaluate(([w, k]) => JSON.parse(localStorage.getItem(w)).entries.find(e => e.entryId === k).project, [W, MAIN]);
  const m = RR.requestMatches(saved), i1 = RR.itemReading(m, { requestId: X.A.id, itemId: 'I1' });
  assert.equal(i1.history.length, 1); assert.ok(i1.history[0].match.text.includes('examples/reel-label-guide/에 추가'));
  assert.equal(await page.evaluate(k => localStorage.getItem(k), PLANS), before, 'the plan is untouched');
  assert.deepEqual(sent.filter(x => !x.includes('/api/studio/map')), []); assert.equal(sent.length, 1, 'one map request, answered by this test');
  assert.deepEqual(errors, []);
  ok('L a reading of this visit lands while open: notice, original said withdrawn, back into the opened history, close to the map', `schema ${ask.schemaVersion}`);
  await ctx.close();
}
/** The reply for the very ask sent: the late correction withdraws the I1 change report (its prior), nothing else. */
async function replyFor(ask, body) {
  const { textDigest } = await import(`${ROOT}dist/public/shared/evidence-span.js`);
  const rec = ask.records.find(r => r.spans.some(x => x.t.includes('늦은 정정'))), at = rec.spans.find(x => x.t.trimStart().startsWith('늦은 정정')).s;
  const prior = ask.priors.find(x => x.quote.startsWith('examples/reel-label-guide/에')); assert.ok(prior, 'the I1 report is a prior');
  const seven = ask.schemaVersion === 'studio.map.7';
  const match = { at, text: '[스텁] 늦은 정정: 도구 추가 보고를 철회하고 미구현이라고 정정함', kind: 'reported', stance: 'not-made', ...(seven ? { aboutAt: null } : { about: null }),
    targets: [{ requestId: X.A.id, itemId: 'I1' }], why: '[스텁] 같은 항목의 앞 보고를 철회', replaces: prior.key };
  const reply = { summary: '[스텁] 늦은 정정을 읽은 자리예요.', parts: [], relations: [], candidates: [], gaps: [], matches: [match], material: [] };
  return { status: 200, contentType: 'application/json', body: JSON.stringify({ model: 'stub-126', evidence: { index: 'span.2', ask: textDigest(body) }, reply }) };
}

/* ---------- E: the limited release (existing-map): the same reading, nothing offered to start ---------- */
async function limited(browser, base) {
  const { ctx, page, errors, sent } = await context(browser, base, [1280, 720], false, SEED, true);
  const before = await stores(page);
  await page.waitForFunction(() => document.getElementById('ai-pill')?.dataset.state !== 'checking');
  const { opener } = await openPaneItem(page), key = await opener.getAttribute('data-request-focus');
  assert.equal(await page.locator('#lens .rr-map').getByRole('button', { name: /지도 갱신|지도 정리/ }).count(), 0, 'the release offers no map reading');
  await opener.click(); await wideOpen(page).waitFor();
  assert.equal(await page.locator('.rw-main .rw-card').count(), 8);
  const c = page.locator('.rw-card', { hasText: '앞뒤 공백만 지우고' }), k = await c.locator('.rw-src').getAttribute('data-rw-focus');
  await c.locator('.rw-src').click(); assert.equal(await page.locator('.rw-source h3').textContent(), 'label-lookup.js');
  await page.keyboard.press('Escape'); assert.equal((await active(page)).key, k);
  await page.keyboard.press('Escape'); assert.equal(await wideOpen(page).count(), 0); assert.equal((await active(page)).key, key);
  assert.deepEqual(await stores(page), before); assert.deepEqual(sent, []); assert.deepEqual(errors, []);
  ok('E limited release status: the same wide reading, original and way back; no map reading offered, nothing sent or written');
  await ctx.close();
}

const { proc, base } = await start();
const browser = await chromium.launch();
try {
  await wide(browser, base); await rerender(browser, base); await narrowKeys(browser, base); await partAndPlan(browser, base); await elsewhere(browser, base);
  await switching(browser, base); await landing(browser, base); await limited(browser, base);
  console.log(`# ${results.length} checks passed`);
} finally { await browser.close(); proc.kill(); }
