// AF97: a map reading keeps its result when the person reads another project meanwhile. One request per entry (reserved before
// anything is awaited); a reply that comes back while the person is elsewhere is kept ready for that entry and applied on return
// without asking again; cancel and discard end the attempt so a late reply or an old finally touches nothing; saving cannot be
// cancelled; a failed save keeps the same checked result for another save. The provider is a stub behind the real server handler
// (replies written for the test); nothing here calls a model or reads a key.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import { studioView } from '../dist/public/shared/studio.js';
import { isMapReading } from '../dist/public/shared/types.js';
import { createMapRun } from '../dist/public/client/map-run.js';
import { createStudioHandler, mapPromptId } from '../server/studio.mjs';

const KEY = 'test-97-not-real';
const ask6 = p => M.buildMapAsk(p, studioView(p), [], undefined, M.MAP6_SCHEMA).ask;
const reply = (ask, name) => ({ summary: `${name} 정리`, parts: [{ ref: 'new:x', name, parent: null, role: `${name} 역할`, roleAbout: null, roleReplaces: null, basis: [ask.records[0].spans[0].s],
  claims: [{ kind: 'want', text: `${name}을 원한다`, at: ask.records[0].spans[0].s, about: null, replaces: null, key: 's1' }] }], relations: [], candidates: [], gaps: [], matches: [], material: [] });
/** A project whose map already has one reading ('문서 변환'), then a follow-up record not read yet. */
function base(text = '후속 보고: 폴더 입력을 나중에 구현하기로 했습니다.') {
  let p = D.pasteRecord(D.createProject(), '요구: 폴더 안의 마크다운 문서를 한 번에 변환한다.\n변환은 문서마다 PDF 하나를 만든다.', null).project;
  const a = ask6(p);
  p = M.applyReading(p, M.buildMapAsk(p, studioView(p), [], undefined, M.MAP6_SCHEMA), M.validateMapReply(reply(a, '문서 변환'), a), { id: 'R_first97', at: new Date().toISOString(), model: 'stub', prompt: 'm6-000000000000', hash: 'a'.repeat(64) }).project;
  return D.pasteRecord(p, text, null).project;
}
const deferred = () => { let open; const promise = new Promise(r => { open = r; }); return { promise, open }; };
const tick = () => new Promise(r => setTimeout(r, 0));
const until = async (f, why) => { for (let i = 0; i < 200; i++) { if (f()) return; await tick(); } assert.fail(`timed out: ${why}`); };

/** A workspace in memory: entries by entryId, each with its lifecycle; every open() is a new visit (a new object), as in the app. */
async function world({ ignoreAbort = false } = {}) {
  const prompt = await mapPromptId(), w = { entries: new Map(), cur: null, commits: [], done: [], changed: [], calls: 0, sent: [], gates: [], commitImpl: null,
    status: { ai: 'deepseek', model: 'm', access: 'open', map: { model: 'm', prompt } } };
  const handle = createStudioHandler({ env: { DEEPSEEK_API_KEY: KEY }, fetchImpl: async () => {
    w.calls++; const gate = deferred(); w.gates.push(gate); await gate.promise;
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(w.replyFor()) } }] }));
  } });
  w.replyFor = () => { throw new Error('set replyFor'); };
  globalThis.fetch = async (url, o) => { w.sent.push(JSON.parse(o.body)); return handle(new Request(`https://studio.example${url}`, ignoreAbort ? { ...o, signal: undefined } : o)); };
  w.add = (key, project, lifecycle = 1) => w.entries.set(key, { project, lifecycle });
  w.open = key => { const e = w.entries.get(key); w.cur = e ? { key, kind: 'saved', project: e.project, view: studioView(e.project), ref: { lifecycle: e.lifecycle } } : null; return w.cur; };
  w.home = () => { w.cur = null; };
  w.run = createMapRun({ current: () => w.cur, visit: () => w.cur, status: () => w.status, accessCode: () => '',
    commit: async next => {
      const o = w.cur; w.commits.push({ key: o.key, next });
      const failed = w.commitImpl ? await w.commitImpl(next, o) : null; if (failed) return failed;
      o.project = next; o.view = studioView(next); w.entries.get(o.key).project = next; return null;
    },
    done: applied => { w.done.push({ key: w.cur?.key, applied }); }, changed: key => { w.changed.push(key); } });
  return w;
}
// The stub answers from the ask the client builds for this project (the same request the run sends).
const answer = (w, p, name) => { const a = ask6(p); w.replyFor = () => reply(a, name); };
const names = p => p.space.areas.filter(a => !a.archived).map(a => a.name);
let saved;
test.before(() => { saved = globalThis.fetch; });
test.afterEach(() => { globalThis.fetch = saved; });

test('97-1 two clicks and another reading of the same entry send one request; one save', async () => {
  const w = await world(), p = base(); w.add('E_A0000001', p); w.open('E_A0000001'); answer(w, p, '폴더 입력');
  const first = w.run.run(); void w.run.run(); void w.run.run('RQ_other'); void w.run.runMapOnly();
  assert.ok(w.run.state().pending, 'pending from the first click, before any await');
  await until(() => w.gates.length, 'request sent'); await tick(); await tick();
  assert.equal(w.calls, 1); assert.equal(w.sent.length, 1);
  w.gates[0].open(); await first;
  assert.equal(w.commits.length, 1); assert.equal(w.done.length, 1); assert.ok(names(w.cur.project).includes('폴더 입력'));
  assert.deepEqual(w.run.state(), { pending: null, committing: false, ready: false, error: null });
});

test('97-2 before it leaves: a cancel, a failed hash or a move to another entry sends nothing and lets the entry go', async () => {
  const w = await world(), p = base(), q = base('다른 프로젝트 보고: 이 원문은 B의 것입니다.'); w.add('E_A0000002', p); w.add('E_B0000002', q);
  w.open('E_A0000002');
  // Cancel while the request is still being prepared (the hash).
  let r = w.run.run(); assert.ok(w.run.state().pending); w.run.cancel(); await r;
  assert.equal(w.calls, 0); assert.deepEqual(w.run.state(), { pending: null, committing: false, ready: false, error: null });
  // The hash fails: said plainly, nothing sent, the entry free for another try.
  const digest = crypto.subtle.digest; crypto.subtle.digest = async () => { throw new Error('no'); };
  try { await w.run.run(); } finally { crypto.subtle.digest = digest; }
  assert.equal(w.calls, 0); assert.equal(w.run.state().pending, null); assert.match(w.run.state().error, /준비하지 못해 보내지 않았어요/);
  // The person goes to B before it leaves: nothing goes, under A or B; B's own state stays empty.
  r = w.run.run(); w.open('E_B0000002'); await r;
  assert.equal(w.calls, 0); assert.equal(w.sent.length, 0);
  assert.deepEqual(w.run.state(), { pending: null, committing: false, ready: false, error: null }, 'B owns nothing of A');
  w.open('E_A0000002'); assert.equal(w.run.state().pending, null, 'A is free again');
  answer(w, p, '폴더 입력'); r = w.run.run(); await until(() => w.gates.length, 'sent'); w.gates[0].open(); await r;
  assert.equal(w.calls, 1); assert.equal(w.commits.length, 1);
});

test('97-3 a reply that comes while B is open waits for A: B and its view untouched, A applies it on return without asking again', async () => {
  const w = await world(), p = base(), q = base('B 보고: B만의 기록.'); w.add('E_A0000003', p); w.add('E_B0000003', q); answer(w, p, '폴더 입력');
  w.open('E_A0000003'); const r = w.run.run(); await until(() => w.gates.length, 'sent');
  const b = w.open('E_B0000003'), bProject = b.project; w.changed = []; w.gates[0].open(); await r; await until(() => w.run.stateOf('E_A0000003').ready, 'ready for A');
  assert.deepEqual([...new Set(w.changed)], ['E_A0000003'], 'the change is told as A\'s own: the host leaves B (open now) as it is');
  assert.equal(w.commits.length, 0, 'nothing saved while B is open'); assert.equal(w.done.length, 0, 'B is never focused or moved');
  assert.deepEqual(w.run.state(), { pending: null, committing: false, ready: false, error: null }, 'B shows nothing of A');
  assert.equal(b.project, bProject); assert.equal(w.entries.get('E_A0000003').project, p, 'A is not saved yet');
  w.home(); assert.equal(w.run.stateOf('E_A0000003').ready, true, 'the home card can say so');
  // Back to A, a new visit. The server says AI is off now: applying needs no network.
  w.status = { ai: 'off', model: null, access: 'open', map: null }; w.open('E_A0000003');
  assert.equal(w.run.state().ready, true);
  await w.run.run(); assert.equal(w.calls, 1, 'the ordinary reading button asks nothing while a result is ready');
  const applying = w.run.applyReady(); void w.run.applyReady(); assert.equal(w.run.state().committing, true, 'reserved before the save is awaited');
  await applying; await tick();
  assert.equal(w.calls, 1); assert.equal(w.commits.length, 1); assert.equal(w.done.length, 1); assert.equal(w.done[0].key, 'E_A0000003');
  const saved = w.entries.get('E_A0000003').project, last = saved.readings.filter(isMapReading).at(-1);
  assert.ok(names(saved).includes('폴더 입력')); assert.equal(last.prompt, (await mapPromptId()), 'the prompt it was asked with');
  assert.equal(w.run.state().ready, false);
});

test('97-4 back on A before the reply: it shows as ready on A (a new visit), never applied by itself', async () => {
  const w = await world(), p = base(); w.add('E_A0000004', p); w.add('E_B0000004', base('B 보고.')); answer(w, p, '폴더 입력');
  w.open('E_A0000004'); const r = w.run.run(); await until(() => w.gates.length, 'sent');
  w.open('E_B0000004'); w.open('E_A0000004');
  assert.ok(w.run.state().pending, 'still on its way, shown on A'); w.gates[0].open(); await r;
  assert.equal(w.run.state().ready, true); assert.equal(w.commits.length, 0); assert.equal(w.done.length, 0);
  await w.run.applyReady(); assert.equal(w.commits.length, 1); assert.equal(w.done.length, 1); assert.equal(w.calls, 1);
});

test('97-5 cancel, then a reply let through anyway: nothing saved; an old attempt never ends a new one; discard lets a result go', async () => {
  const w = await world({ ignoreAbort: true }), p = base(); w.add('E_A0000005', p); w.open('E_A0000005'); answer(w, p, '폴더 입력');
  const old = w.run.run(); await until(() => w.gates.length === 1, 'first sent'); w.run.cancel();
  assert.equal(w.run.state().pending, null);
  const next = w.run.run(); await until(() => w.gates.length === 2, 'second sent');
  w.gates[0].open(); await old; await tick();
  assert.equal(w.commits.length, 0, 'the cancelled reply is not saved'); assert.ok(w.run.state().pending, 'the new attempt is still pending');
  // The new one comes back while A is open in the same visit: applied once.
  w.gates[1].open(); await next; assert.equal(w.commits.length, 1); assert.equal(w.done.length, 1);
  // A ready result discarded: nothing saved, and a later reading asks again (the discarded one never comes back).
  w.entries.get('E_A0000005').project = D.pasteRecord(w.cur.project, '세 번째 보고: 변환 결과를 폴더로 모은다.', null).project; w.open('E_A0000005'); answer(w, w.cur.project, '결과 모음');
  const third = w.run.run(); await until(() => w.gates.length === 3, 'third sent'); w.home(); w.gates[2].open(); await third;
  w.open('E_A0000005'); assert.equal(w.run.state().ready, true); w.run.discard();
  assert.deepEqual(w.run.state(), { pending: null, committing: false, ready: false, error: null }); await w.run.applyReady();
  assert.equal(w.commits.length, 1, 'nothing applied after discard');
  const fourth = w.run.run(); await until(() => w.gates.length === 4, 'asked again'); w.gates[3].open(); await fourth; assert.equal(w.commits.length, 2);
});

test('97-6 while away the person renames a part and adds one by hand: the ready result is applied on top, keeping both', async () => {
  const w = await world(), p = base(); w.add('E_A0000006', p); answer(w, p, '폴더 입력');
  w.open('E_A0000006'); const r = w.run.run(); await until(() => w.gates.length, 'sent'); w.home(); w.gates[0].open(); await r;
  const id = p.space.areas[0].id; let edited = D.editArea(p, id, '변환 엔진', p.space.areas[0].note); edited = D.addArea(edited, '직접 추가한 부분');
  w.entries.get('E_A0000006').project = edited; w.open('E_A0000006'); await w.run.applyReady();
  const now = w.entries.get('E_A0000006').project;
  assert.equal(w.commits.length, 1); assert.ok(names(now).includes('변환 엔진') && names(now).includes('직접 추가한 부분') && names(now).includes('폴더 입력'));
  assert.ok(!names(now).includes('문서 변환'), 'the rename stays');
});

test('97-7 a ready result is refused, not forced: another reading, an archived part, another lifecycle, a copy with the same project id', async () => {
  const ready = async (w, key, p) => { answer(w, p, '폴더 입력'); w.open(key); const r = w.run.run(); await until(() => w.gates.length, 'sent'); w.home(); w.gates.at(-1).open(); await r; assert.equal(w.run.stateOf(key).ready, true); };
  // Another reading came into A meanwhile (as if from this tab's earlier reply or another way): MAP_CHANGED, nothing saved.
  let w = await world(), p = base(); w.add('E_A0000007', p); await ready(w, 'E_A0000007', p);
  const a2 = ask6(p); w.entries.get('E_A0000007').project = M.applyReading(p, M.buildMapAsk(p, studioView(p), [], undefined, M.MAP6_SCHEMA), M.validateMapReply(reply(a2, '다른 정리'), a2), { id: 'R_other97', at: new Date().toISOString(), model: 'stub', prompt: 'm6-000000000000', hash: 'b'.repeat(64) }).project;
  w.open('E_A0000007'); await w.run.applyReady();
  assert.equal(w.commits.length, 0); assert.match(w.run.state().error, /지도가 바뀌어/); assert.equal(w.run.state().ready, false);
  // A part the request named was archived.
  w = await world(); p = base(); w.add('E_A0000008', p); await ready(w, 'E_A0000008', p);
  w.entries.get('E_A0000008').project = D.setAreaArchived(p, p.space.areas[0].id, true); w.open('E_A0000008'); await w.run.applyReady();
  assert.equal(w.commits.length, 0); assert.match(w.run.state().error, /지도가 바뀌어/);
  // Archived and restored: the same content, another lifecycle. Let go when shown, never applied.
  w = await world(); p = base(); w.add('E_A0000009', p); await ready(w, 'E_A0000009', p);
  w.entries.get('E_A0000009').lifecycle = 3; w.open('E_A0000009');
  const st = w.run.state(); assert.equal(st.ready, false); assert.match(st.error, /보관되었다가 다시 열려/);
  await w.run.applyReady(); assert.equal(w.commits.length, 0);
  // An imported copy holds the same Project.id under another entryId: it owns nothing of the original's result.
  w = await world(); p = base(); w.add('E_A0000010', p); w.add('E_C0000010', p); await ready(w, 'E_A0000010', p);
  w.open('E_C0000010'); assert.deepEqual(w.run.state(), { pending: null, committing: false, ready: false, error: null });
  await w.run.applyReady(); assert.equal(w.commits.length, 0);
  w.open('E_A0000010'); assert.equal(w.run.state().ready, true, 'still ready for its own entry');
});

test('97-8 saving: no cancel, no second save, no new request; a move away and back during it leaves the new visit unmoved', async () => {
  const w = await world(), p = base(); w.add('E_A0000011', p); w.add('E_B0000011', base('B 보고.')); answer(w, p, '폴더 입력');
  const hold = deferred(); w.commitImpl = () => hold.promise;
  w.open('E_A0000011'); const r = w.run.run(); await until(() => w.gates.length, 'sent'); w.gates[0].open();
  await until(() => w.run.state().committing, 'saving');
  assert.equal(w.run.state().pending, null, 'nothing to cancel once saving'); w.run.cancel(); w.run.discard(); await w.run.applyReady(); await w.run.run();
  assert.equal(w.commits.length, 1); assert.equal(w.calls, 1); assert.equal(w.run.state().committing, true);
  const first = w.cur; w.open('E_B0000011'); w.open('E_A0000011'); const again = w.cur;
  hold.open(null); await r;
  assert.equal(w.done.length, 0, 'the visit it was applied from is gone: the new one is not focused or moved');
  assert.ok(names(first.project).includes('폴더 입력'), 'saved'); assert.deepEqual(w.run.state(), { pending: null, committing: false, ready: false, error: null });
  assert.equal(again.project, p, 'this in-memory host does not adopt; the app does (browser flow)');
});

test('97-9 a failed save says nothing is done and keeps the same checked result: saving again asks nothing; a conflict stays refused', async () => {
  const w = await world(), p = base(); w.add('E_A0000012', p); answer(w, p, '폴더 입력');
  w.commitImpl = async () => '저장하지 못했어요. 바뀐 내용은 적용하지 않았어요.';
  w.open('E_A0000012'); await (async () => { const r = w.run.run(); await until(() => w.gates.length, 'sent'); w.gates[0].open(); await r; })();
  let st = w.run.state(); assert.equal(st.ready, true); assert.match(st.error, /저장하지 못했어요/); assert.equal(w.done.length, 0);
  assert.equal(w.entries.get('E_A0000012').project, p, 'records and map kept');
  w.commitImpl = async () => '다른 탭에서 이 프로젝트가 바뀌어 저장하지 않았어요. 새로고침한 뒤 다시 해 주세요.';
  await w.run.applyReady(); st = w.run.state(); assert.equal(st.ready, true); assert.match(st.error, /다른 탭/); assert.equal(w.entries.get('E_A0000012').project, p);
  w.commitImpl = null; await w.run.applyReady();
  assert.equal(w.calls, 1, 'only the save was tried again'); assert.equal(w.commits.length, 3); assert.equal(w.done.length, 1);
  const ids = w.commits.map(c => c.next.readings.filter(isMapReading).at(-1).id); assert.equal(new Set(ids).size, 1, 'the same result each time');
  assert.deepEqual(w.run.state(), { pending: null, committing: false, ready: false, error: null });
});
