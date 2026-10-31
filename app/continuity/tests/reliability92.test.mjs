// Four gaps an outside review found in the connector (b218453): each reproduced here first, then closed.
//   1. a subagent's late work, when only its own file changed (the session's file kept its time);
//   2. a reply written at the very time of the request a look already took;
//   3. a handover document copied without its end line, with the person's new request under it;
//   4. a map reading the person cancelled, started again by the automatic connection with nothing new.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, utimesSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import * as D from '../dist/public/shared/domain.js';
import { openSessions } from '../server/sessions.mjs';
import { newTurns, markAfter, readSessionList, readSessionDetail } from '../dist/public/shared/session-import.js';
import { sessionDetail, within } from '../dist/public/shared/session-parse.js';
import { handoverText, foldHandover, foldRecord, receivedHandovers, HANDOVER_SECTIONS } from '../dist/public/shared/handover.js';
import { studioView } from '../dist/public/shared/studio.js';

globalThis.document = { getElementById: () => null, visibilityState: 'visible', addEventListener() {} };
const { createAutoSync, AUTOSYNC_KEY } = await import('../dist/public/client/auto-sync.js');
const { createMapRun } = await import('../dist/public/client/map-run.js');

function memKv() { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; }
const settle = () => new Promise(r => setTimeout(r, 30));
const ago = min => new Date(Date.now() - min * 60000).toISOString();
const ID = 'claude-0123456789abcdef01234567';
/** One tab with an open project; `reads` counts the automatic map readings it started. */
function tab(src, { canRead = () => true } = {}) {
  const kv = memKv(), opened = { key: 'E1', kind: 'saved', project: D.createProject() };
  const t = { reads: 0, opened, kv, texts: () => opened.project.pasted.map(r => r.text), binding: () => JSON.parse(kv.getItem(AUTOSYNC_KEY))[opened.key] };
  t.sync = createAutoSync({ current: () => opened, kv, sources: { offered: () => true, current: () => src, usesServer: () => true, folderState: () => 'none', folders: () => [] },
    async save(key, texts) { for (const x of texts) opened.project = D.pasteRecord(opened.project, x, null).project; return null; },
    full: () => null, canRead, read() { t.reads++; }, readBlocked: () => null });
  return t;
}
/** Sessions in memory, read by the real sessionDetail (as the server sends them). */
function memSource(sessions) {
  return { kind: 'server',
    async list(folder) { return sessions.filter(s => within([s.cwd], folder)).map(s => ({ id: s.id, tool: 'claude', title: null, preview: 'p', cwd: s.cwd, branch: null, startedAt: null, updatedAt: s.updatedAt, bytes: 1 })); },
    async read(id, since = null) {
      const s = sessions.find(x => x.id === id), parsed = { meta: { cwd: s.cwd, cwds: [s.cwd], branch: null, startedAt: null, title: null, thread: null, parent: null }, turns: structuredClone(s.turns), changes: [] };
      return readSessionDetail(JSON.parse(JSON.stringify(sessionDetail(id, 'claude', parsed, undefined, since))));
    } };
}

/* ---------- 1. a subagent's late work ---------- */
const cu = (at, content, extra = {}) => ({ type: 'user', cwd: '/w', timestamp: at, ...extra, message: { role: 'user', content } });
const ca = (at, content, extra = {}) => ({ type: 'assistant', cwd: '/w', timestamp: at, ...extra, message: { role: 'assistant', content: typeof content === 'string' ? [{ type: 'text', text: content }] : content } });
const jl = rows => rows.map(r => JSON.stringify(r)).join('\n');
const side = { isSidechain: true, sessionId: 'main' };
const work = (at, file, n) => [cu(at, '고쳐', side), ca(at, [{ type: 'tool_use', id: `s${n}`, name: 'Write', input: { file_path: file, content: 'x' } }], side),
  cu(at, [{ type: 'tool_result', tool_use_id: `s${n}`, content: 'ok' }], side)];
const touch = (path, min) => { const t = new Date(Date.now() - min * 60000); utimesSync(path, t, t); };
/** File System Access stand-ins over a real folder (a File is a snapshot of the file, as in Chrome). */
const fsFile = path => ({ kind: 'file', name: basename(path), getFile: async () => new File([readFileSync(path)], basename(path), { lastModified: statSync(path).mtimeMs }) });
const fsFolder = path => ({ kind: 'directory', name: basename(path), queryPermission: async () => 'granted',
  async *values() { for (const d of readdirSync(path, { withFileTypes: true })) yield d.isDirectory() ? fsFolder(join(path, d.name)) : fsFile(join(path, d.name)); } });

test('REL92-1 a subagent that finishes after its session was taken: its own file changing is enough for the next look to take its work', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'af-rel92-')), had = globalThis.window;
  try {
    const roots = { claude: join(dir, '.claude'), codex: join(dir, '.codex') }, p = join(roots.claude, 'projects', '-w'), sub = join(p, 'main', 'subagents');
    mkdirSync(sub, { recursive: true });
    writeFileSync(join(p, 'main.jsonl'), jl([cu(ago(40), '알림이랑 예약 고쳐 줘'), ca(ago(39.5), [{ type: 'tool_use', id: 'k1', name: 'Task', input: { prompt: '고쳐' } }]),
      cu(ago(39), [{ type: 'tool_result', tool_use_id: 'k1', content: '맡겼어요' }]), ca(ago(38), '알림은 고쳤고, 예약은 하위 에이전트가 하고 있어요.')]));
    writeFileSync(join(sub, 'agent-a1.jsonl'), jl(work(ago(39.2), '/w/src/notify.ts', 1)));
    touch(join(sub, 'agent-a1.jsonl'), 38); touch(join(p, 'main.jsonl'), 30);
    const server = openSessions({ env: {}, roots });
    const src = { kind: 'server', list: async f => readSessionList(await server.list(f)), read: async (id, since) => readSessionDetail(await server.read(id, { since })) };
    const t = tab(src);
    t.sync.connect('/w'); await settle();
    assert.equal(t.texts().length, 1); assert.ok(t.texts()[0].includes('src/notify.ts') && !t.texts()[0].includes('src/booking.ts'), t.texts()[0]);
    const before = (await server.list('/w')).sessions[0].updatedAt;
    // The background subagent ends after the look: only its own file is written; the session's file keeps its time.
    writeFileSync(join(sub, 'agent-b2.jsonl'), jl(work(new Date().toISOString(), '/w/src/booking.ts', 2))); touch(join(sub, 'agent-b2.jsonl'), 3);
    const [row] = (await server.list('/w')).sessions;
    assert.ok(row.updatedAt > before, 'the listing dates the session by its subagents\' files too');
    assert.equal(Date.parse(row.updatedAt), Math.floor(statSync(join(sub, 'agent-b2.jsonl')).mtimeMs));
    await t.sync.tick();
    assert.equal(t.texts().length, 2, 'the late work came in as a record of its own');
    assert.ok(t.texts()[1].includes('src/booking.ts') && !t.texts()[1].includes('src/notify.ts'), t.texts()[1]);
    await t.sync.tick(true); assert.equal(t.texts().length, 2, 'taken once');
    // Older Claude Code: agent-*.jsonl beside the session, naming it. A later one dates the session too; another session's does not.
    writeFileSync(join(p, 'agent-c3.jsonl'), jl(work(new Date().toISOString(), '/w/src/hours.ts', 3))); touch(join(p, 'agent-c3.jsonl'), 2);
    writeFileSync(join(p, 'agent-d4.jsonl'), jl(work(new Date().toISOString(), '/w/src/other.ts', 4).map(r => ({ ...r, sessionId: 'other' }))));
    const [again] = (await server.list('/w')).sessions;
    assert.equal(Date.parse(again.updatedAt), Math.floor(statSync(join(p, 'agent-c3.jsonl')).mtimeMs));
    // The page reading a picked .claude folder dates it the same way.
    globalThis.window = { showDirectoryPicker: async () => fsFolder(roots.claude) };
    const { createSessionSources } = await import('../dist/public/client/session-source.js');
    const sources = createSessionSources({ status: () => ({ ai: 'none' }), accessCode: () => '' });
    await sources.load(); assert.equal(await sources.pick(), true);
    const [paged] = await sources.current().list('/w');
    assert.equal(paged.id, again.id); assert.equal(paged.updatedAt, again.updatedAt);
  } finally { globalThis.window = had; rmSync(dir, { recursive: true, force: true }); }
});

test('REL92-1b a Codex subagent\'s rollout written after its session dates that session, in the server\'s listing and the page\'s', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'af-rel92-')), had = globalThis.window;
  const PARENT = '019a0000-0000-7000-8000-000000000001';
  const meta = (id, extra = {}) => ({ timestamp: ago(40), type: 'session_meta', payload: { id, cwd: '/w', timestamp: ago(40), ...extra } });
  const say = (min, type, message) => ({ timestamp: ago(min), type: 'event_msg', payload: { type, message } });
  try {
    const roots = { claude: join(dir, '.claude'), codex: join(dir, '.codex') }, day = join(roots.codex, 'sessions', '2026', '10', '31'); mkdirSync(day, { recursive: true });
    const parent = join(day, 'rollout-2026-10-31T10-00-00-parent.jsonl'), child = join(day, 'rollout-2026-10-31T10-01-00-child.jsonl');
    writeFileSync(parent, jl([meta(PARENT), say(40, 'user_message', '예약 고쳐 줘'), say(38, 'agent_message', '하위 에이전트에 맡겼어요.')]));
    writeFileSync(child, jl([meta('019a0000-0000-7000-8000-000000000002', { parent_thread_id: PARENT, source: { subagent: { thread_spawn: { parent_thread_id: PARENT, depth: 1 } } } })]));
    touch(parent, 30); touch(child, 4);
    const server = openSessions({ env: {}, roots }), [row] = (await server.list('/w')).sessions;
    assert.equal(Date.parse(row.updatedAt), Math.floor(statSync(child).mtimeMs));
    globalThis.window = { showDirectoryPicker: async () => fsFolder(roots.codex) };
    const { createSessionSources } = await import('../dist/public/client/session-source.js');
    const sources = createSessionSources({ status: () => ({ ai: 'none' }), accessCode: () => '' });
    await sources.load(); assert.equal(await sources.pick(), true);
    const [paged] = await sources.current().list('/w');
    assert.equal(paged.id, row.id); assert.equal(paged.updatedAt, row.updatedAt);
  } finally { globalThis.window = had; rmSync(dir, { recursive: true, force: true }); }
});

/* ---------- 2. a reply at the very time of its request ---------- */
test('REL92-2 a reply written at the same time as the request a look took is taken, once; so is a request at the time of a reply', async () => {
  const at = ago(40), S = { id: ID, cwd: '/w', updatedAt: ago(30), turns: [{ role: 'user', at, text: '예약 취소 마감 고쳐 줘' }] };
  const t = tab(memSource([S]), { canRead: () => false });
  t.sync.connect('/w'); await settle();
  assert.equal(t.texts().length, 1); assert.ok(t.texts()[0].includes('예약 취소 마감 고쳐 줘'));
  S.turns.push({ role: 'assistant', at, text: '마감을 하루 전으로 바꿨어요.' }); S.updatedAt = ago(20);
  await t.sync.tick();
  assert.equal(t.texts().length, 2, 'the reply came in'); assert.ok(t.texts()[1].includes('마감을 하루 전으로 바꿨어요.') && !t.texts()[1].includes('예약 취소 마감 고쳐 줘'), t.texts()[1]);
  // And the next request written at that same time too.
  S.turns.push({ role: 'user', at, text: '테스트도 추가해 줘' }); S.updatedAt = ago(10);
  await t.sync.tick();
  assert.equal(t.texts().length, 3); assert.ok(t.texts()[2].includes('테스트도 추가해 줘') && !t.texts()[2].includes('마감을 하루 전'), t.texts()[2]);
  await t.sync.tick(true); assert.equal(t.texts().length, 3, 'nothing taken twice');
  // The same at the level of one reading: the mark counts what it took at its time.
  const d = s => readSessionDetail(JSON.parse(JSON.stringify(sessionDetail(ID, 'claude', { meta: { cwd: '/w', cwds: ['/w'], branch: null, startedAt: null, title: null, thread: null, parent: null }, turns: s, changes: [] }))));
  const one = d([{ role: 'user', at, text: 'a' }]), mark = markAfter(one, null, 'u1');
  assert.deepEqual(newTurns(d([{ role: 'user', at, text: 'a' }, { role: 'assistant', at, text: 'b' }]), mark).map(x => x.text), ['b']);
  // A mark written before marks counted (lastAt only) still reads as before: every turn at its time taken.
  assert.deepEqual(newTurns(d([{ role: 'user', at, text: 'a' }, { role: 'assistant', at, text: 'b' }]), { lastAt: at, count: 1, updatedAt: 'u1' }), []);
});

/* ---------- 3. a handover document copied without its end line ---------- */
function mapped() {
  let p = D.addArea(D.createProject(), '예약 화면'); const booking = p.space.areas[0].id;
  p = D.addArea(p, '영업시간 설정');
  p = D.pasteRecord(p, '[Codex 세션 기록 · 세션 codex-111111111111111111111111]\n\n── 사용자 요청 ──\n예약 화면에 휴무일 반영\n\n── Codex 답변 ──\n반영했어요.\n(바꾼 파일: src/a.ts)', null).project;
  return { p, booking };
}
test('REL92-3 a handover copied without its end line folds the document only: the request written under it stays the person\'s', () => {
  const { p, booking } = mapped();
  for (const scope of [null, booking]) {
    const doc = handoverText(p, { scope, code: 'QW3RTY', at: '2026-10-30T05:00:00.000Z' });
    // Every section a document can have is one the fold knows.
    for (const h of doc.match(/^## .+$/gm)) assert.ok(HANDOVER_SECTIONS.some(s => h.startsWith(s)), h);
    // Cut where the end line was: the blank line before it stays, as the blank lines after a folded document always do.
    const cut = doc.split('\n').slice(0, -1).join('\n'), line = foldHandover(doc), gap = cut.slice(cut.trimEnd().length);
    assert.equal(gap, '\n');
    assert.ok(!line.includes('\n') && line.startsWith('[AgentFlow 인수인계 문서를 받아 이어감 · af-handover:QW3RTY'), line);
    for (const [under, kept] of [[`${cut}\n결제 버튼을 붙여 줘`, '\n\n결제 버튼을 붙여 줘'], [`${cut.trimEnd()}\n결제 버튼을 붙여 줘\n- 테스트도`, '\n결제 버튼을 붙여 줘\n- 테스트도'],
      [`${cut}\n- 결제 버튼을 붙여 줘\n- 테스트도`, '\n\n- 결제 버튼을 붙여 줘\n- 테스트도'], [`${cut}\n## 할 일\n결제 버튼`, '\n\n## 할 일\n결제 버튼'], [cut, gap]]) {
      assert.equal(foldHandover(under), `${line}${kept}`, under.slice(-60));
    }
    // Before it, the person's words stay too, and the takeover is still known.
    assert.equal(foldHandover(`이거 보고 이어서\n\n${cut}\n결제 버튼을 붙여 줘`), `이거 보고 이어서\n\n${line}\n\n결제 버튼을 붙여 줘`);
    const rec = foldRecord(`[웹 AI 세션 기록 · 결제]\n\n── 사용자 요청 ──\n${cut}\n결제 버튼을 붙여 줘\n\n── 웹 AI 답변 ──\n붙였어요.`);
    assert.ok(rec.includes(`${line}\n\n결제 버튼을 붙여 줘\n\n── 웹 AI 답변 ──`), rec);
    assert.deepEqual(receivedHandovers(rec), [{ code: 'QW3RTY', areaId: scope }]);
  }
});

/* ---------- 4. a cancelled map reading ---------- */
test('REL92-4 a map reading the person cancelled is not started again by the automatic connection until new records come in', async () => {
  const S = { id: ID, cwd: '/w', updatedAt: ago(30), turns: [{ role: 'user', at: ago(40), text: '예약 고쳐 줘' }, { role: 'assistant', at: ago(39), text: '고쳤어요.' }] };
  const t = tab(memSource([S]));
  t.sync.connect('/w'); await settle();
  assert.equal(t.reads, 1, 'the connection read its records into the map');
  // The person cancels that reading; time passes (past the gap between automatic readings) with nothing new.
  t.sync.hold('E1');
  const b = t.binding(); b.runs.last = ago(60); t.kv.setItem(AUTOSYNC_KEY, JSON.stringify({ E1: b }));
  for (let i = 0; i < 3; i++) await t.sync.tick();
  await t.sync.tick(true);
  assert.equal(t.reads, 1, 'no reading started again with what was cancelled');
  // A new turn comes in: the map follows again.
  S.turns.push({ role: 'user', at: ago(5), text: '취소 마감도' }, { role: 'assistant', at: ago(4), text: '바꿨어요.' }); S.updatedAt = ago(3);
  await t.sync.tick();
  assert.equal(t.texts().length, 2); assert.equal(t.reads, 2, 'new records read again');
  // A cancel, and letting a ready result go, are told to the host as the person withdrawing that reading.
  let p = D.pasteRecord(D.createProject(), '요구: 예약 취소는 하루 전까지.', null).project; const told = [];
  const oldFetch = globalThis.fetch; let release; globalThis.fetch = (_u, init) => new Promise((_r, reject) => { release = () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })); init?.signal?.addEventListener('abort', () => release()); });
  try {
    const run = createMapRun({ current: () => ({ key: 'e', kind: 'saved', project: p, view: studioView(p) }), status: () => ({ ai: 'deepseek', model: 'm', access: 'open', map: { model: 'm', prompt: 'm6-0123456789ab' } }),
      accessCode: () => '', commit: async () => null, done: () => {}, changed: () => {}, withdrawn: key => told.push(key) });
    const going = run.run(); await settle();
    assert.ok(run.state().pending, 'asking'); run.cancel(); await going;
    assert.deepEqual(told, ['e']); assert.equal(run.state().pending, null);
  } finally { globalThis.fetch = oldFetch; }
});
