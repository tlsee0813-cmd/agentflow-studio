// AF100: map readings kept as durable jobs by the local Node server. The provider is a stub behind the real studio handler (replies
// written for the test from the very request); nothing here calls a model or reads a key. What is checked: the input codec against
// the same applyReading, the job store's states and limits, and the browser's reservation, recovery and explicit apply.
// Real separate processes (restart, two owners, a damaged journal) are in durable100-process.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as J from '../dist/public/shared/map-job.js';
import * as C from '../dist/public/shared/change-plan.js';
import * as R from '../dist/public/shared/request-return.js';
import { studioView } from '../dist/public/shared/studio.js';
import { isMapReading } from '../dist/public/shared/types.js';
import { createMapRun } from '../dist/public/client/map-run.js';
import { JobReservations, JOBS_KEY } from '../dist/public/client/map-jobs.js';
import { createStudioHandler, mapPromptId } from '../server/studio.mjs';
import { openMapJobs, fileIo } from '../server/map-jobs.mjs';

const KEY = 'test-100-not-real-key';
const SEQ = JSON.parse(readFileSync(new URL('../../../docs/cycles/2026-10-26-visual-experience-59/request72-sequential-sample.json', import.meta.url), 'utf8'));
const SAMPLE_RQ = 'RQ_efb368df-baa4-4668-ab7c-8e4f156daea8', REPORT71 = SEQ.pasted[1].text, CORRECTION72 = SEQ.pasted[2].text;
const tick = () => new Promise(r => setTimeout(r, 1));
const until = async (f, why, n = 3000) => { for (let i = 0; i < n; i++) { if (await f()) return; await tick(); } assert.fail(`timed out: ${why}`); };
const deferred = () => { let open, fail; const promise = new Promise((r, j) => { open = r; fail = j; }); return { promise, open, fail }; };
const newCap = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
/** applyReading with the same ids each time (new parts and corrections take random ids), so two applies can be compared whole. */
function seeded(fn) {
  const orig = crypto.randomUUID; let i = 0; crypto.randomUUID = () => `00000000-0000-4000-8000-${String(++i).padStart(12, '0')}`;
  try { return fn(); } finally { crypto.randomUUID = orig; }
}
const viaWire = inp => J.decodeMapInput(JSON.parse(JSON.stringify(J.encodeMapInput(inp))));
const META = { id: 'R_00000000-0000-4000-8000-0000000000aa', at: '2026-10-29T00:00:00.000Z', model: 'stub', prompt: 'm6-000000000000', hash: 'f'.repeat(64) };
const piece = (inp, words, rec = 'N01') => { const x = inp.ask.records.find(r => r.id === rec).spans.find(s => s.t.trimStart().startsWith(words)); assert.ok(x, words); return x.s; };
function plan(p, area, titles = ['폴더 안 마크다운 문서 일괄 변환', '파일 하나가 실패해도 나머지 계속 처리', '마지막에 파일별 성공·실패 요약 표시']) {
  const evidence = [{ id: 'INTENT', kind: 'user', title: '원함', text: titles.join(' / '), basis: '사용자 초안' }];
  const analysis = { summary: '폴더', items: titles.map((title, i) => ({ id: `change_${i + 1}`, title, description: `${title}을 원함`, partIds: [area], refs: ['INTENT'], dependsOn: [] })), impacts: [], preserve: [], unknowns: [] };
  return C.requestSnapshot(C.createPlan(p.id, '기준', evidence[0].text, evidence, analysis));
}
const reply4 = o => ({ summary: '', parts: [], relations: [], candidates: [], gaps: [], matches: [], material: [], ...o });
const part = (ref, o = {}) => ({ ref, name: null, parent: null, role: null, roleAbout: null, roleReplaces: null, basis: [], claims: [], ...o });

/** 71 then 72 on the anchored wire (the 74 sequence): a part with a current claim (C), priors with their targets (M), the full
 * frozen request with its sources, and a map that already has a reading (after). */
function sequence() {
  let s = D.addArea(D.createProject(), '폴더 일괄 처리', ''); const area = s.space.areas[0].id, q = plan(s, area).scope;
  s = D.pasteRecord(s, REPORT71.replace(SAMPLE_RQ, q.id), area).project;
  const a71 = M.buildMapAsk(s, studioView(s), [q], undefined, true), t = id => [{ requestId: q.id, itemId: id }];
  const mm = (at, item, o = {}) => ({ at, text: '범위', kind: 'reported', stance: 'made', about: null, targets: item ? t(item) : [], why: '스텁', replaces: null, ...o });
  const at71 = piece(a71, 'feature/folder 브랜치에서');
  s = M.applyReading(s, a71, M.validateMapReply(reply4({ parts: [part('P01', { claims: [{ kind: 'reported', text: '폴더 입력 보고', at: at71, about: null, replaces: null }] })],
    matches: [mm(at71, 'change_1', { about: 'feature/folder 브랜치' }), mm(piece(a71, 'main에는'), 'change_1', { stance: 'unclear' })] }), a71.ask), { ...META, id: 'R_71', hash: '7'.repeat(64) }).project;
  s = D.pasteRecord(s, CORRECTION72.replace(SAMPLE_RQ, q.id), null).project;
  const a72 = M.buildMapAsk(s, studioView(s), [q], undefined, true), key = a72.ask.priors.find(x => x.quote.startsWith('feature/folder 브랜치에서')).key;
  const at72 = `${piece(a72, '실제로는').split('.')[0]}.${piece(a72, '실제로는').split('.')[1]}-${piece(a72, 'feature/folder의').split('.')[1]}`;
  const r72 = reply4({ parts: [part('P01', { claims: [{ kind: 'reported', text: '폴더 입력 미구현', at: at72, about: null, replaces: 'C01' }] })],
    matches: [mm(at72, 'change_1', { stance: 'not-made', about: 'feature/folder', replaces: key })] });
  return { s, q, a72, r72, key };
}

/* ---------- A: map-input.1 ---------- */
test('100-A1 composite input (P, C, M prior with its correction, full request sources, after) applies the same through the codec', () => {
  const { s, q, a72, r72 } = sequence();
  assert.ok(a72.ask.parts[0].current.length && a72.priors.size && a72.fullRequests[0].items.some(i => i.sources.length) && a72.after === 'R_71');
  const back = viaWire(a72);
  assert.deepEqual([...back.parts], [...a72.parts]); assert.deepEqual([...back.claims], [...a72.claims]); assert.deepEqual([...back.records], [...a72.records]);
  assert.deepEqual([...back.priors], [...a72.priors]); assert.deepEqual(back.fullRequests, a72.fullRequests, 'sources travel; ask.requests has none');
  assert.ok(!JSON.stringify(a72.ask.requests).includes('"sources"'));
  const reply = M.validateMapReply(r72, a72.ask);
  const one = seeded(() => M.applyReading(s, a72, reply, META)), two = seeded(() => M.applyReading(s, back, reply, META));
  assert.deepEqual(two, one);
  const lead = R.itemReading(R.requestMatches(two.project), { requestId: q.id, itemId: 'change_1' });
  assert.equal(lead.state, 'not-made'); assert.ok(two.reading.matches[0].replaces, 'the withdrawal holds');
  assert.ok(two.reading.parts[0].claims[0].replaces, 'the claim replaces C01 by its reading and index');
});

test('100-A2 a prior corrected while the job waited: the body is kept and only its replacement link goes, the same through the codec', () => {
  const { s, q, a72, r72 } = sequence(), back = viaWire(a72);
  const x = R.requestMatches(s).find(x => x.match.quote.startsWith('feature/folder 브랜치에서'));
  const during = seeded(() => R.correctRequestMatch(s, x.reading, x.index, { requestId: q.id, itemId: 'change_2' }));
  const reply = M.validateMapReply(r72, a72.ask);
  const one = seeded(() => M.applyReading(during, a72, reply, META)), two = seeded(() => M.applyReading(during, back, reply, META));
  assert.deepEqual(two, one, 'never a whole failure');
  assert.equal(two.reading.matches.length, 1); assert.equal(two.reading.matches[0].replaces, null);
  assert.equal(two.reading.matches[0].quote.startsWith('실제로는 그 입력 처리를'), true);
});

test('100-A3 a later reading of a long record (sent from its original offset) with existing parts; an unreferenced claim alias is kept', () => {
  const long = Array.from({ length: 420 }, (_, i) => `요구: 항목 ${i + 1}은 폴더 안의 문서 ${i + 1}을 한 번에 변환한다.`).join('\n');
  let p = D.pasteRecord(D.createProject(), long, null).project;
  const first = M.buildMapAsk(p, studioView(p), [], undefined, M.MAP6_SCHEMA), s1 = first.ask.records[0].spans[0].s;
  assert.ok([...first.records.values()][0].to < long.length, 'the first reading reads only part of it');
  p = M.applyReading(p, first, M.validateMapReply(reply4({ summary: 'x', parts: [part('new:a', { name: '문서 변환', role: '역할', basis: [s1], claims: [{ kind: 'want', text: '변환을 원한다', at: s1, about: null, replaces: null, key: 's1' }] })] }), first.ask),
    { ...META, id: 'R_first', hash: '1'.repeat(64) }).project;
  const next = M.buildMapAsk(p, studioView(p), [], undefined, M.MAP6_SCHEMA), rec = [...next.records.values()][0];
  assert.ok(rec.from > 0 && next.ask.parts.length === 1 && next.ask.parts[0].current.length === 1);
  next.claims.set('C99', { reading: 'R_first', index: 0 }); // as buildMapAsk leaves it when it trims ask.parts[].current
  const back = viaWire(next);
  assert.deepEqual([...back.claims], [...next.claims]); assert.equal(back.records.get('N01').from, rec.from);
  const s2 = next.ask.records[0].spans[0].s, reply = M.validateMapReply(reply4({ summary: 'y', parts: [part('P01', { claims: [{ kind: 'want', text: '다음 항목', at: s2, about: null, replaces: 'C01', key: 's1' }] })] }), next.ask);
  const one = seeded(() => M.applyReading(p, next, reply, META)), two = seeded(() => M.applyReading(p, back, reply, META));
  assert.deepEqual(two, one); assert.equal(two.reading.records[0].from, rec.from);
});

test('100-A4 a wire that does not stand for what was sent is refused before anything goes', () => {
  const { a72 } = sequence(), w = () => JSON.parse(JSON.stringify(J.encodeMapInput(a72)));
  const refused = (change, why) => { const x = w(); change(x); assert.throws(() => J.decodeMapInput(x), /INVALID_INPUT|UNSUPPORTED_VERSION|INPUT_TOO_LARGE/, why); };
  assert.doesNotThrow(() => J.decodeMapInput(w()));
  refused(x => { x.records[0][1].text = `${x.records[0][1].text.slice(0, -1)}!`; }, 'excerpt text');
  refused(x => { x.records[0][1].from += 1; x.records[0][1].to += 1; x.records[0][1].text = x.records[0][1].text; x.records[0][1].total -= 0; x.records[0][1].to = x.records[0][1].from + x.records[0][1].text.length; x.records[0][1].total = x.records[0][1].to - 1; }, 'coordinates');
  refused(x => { x.claims = x.claims.filter(([k]) => k !== 'C01'); }, 'a referenced claim alias');
  refused(x => { x.priors[0][1].target.itemId = 'change_3'; }, 'a prior target');
  refused(x => { x.fullRequests[0].items[0].title = '다른 제목'; }, 'the full request against ask.requests');
  refused(x => { x.parts.push(['P99', 'A_extra']); }, 'an extra part alias');
  refused(x => { x.ask.schemaVersion = 'studio.map.3'; }, 'only anchored wires go as jobs');
  refused(x => { x.version = 'map-input.0'; }, 'version');
  refused(x => { x.fullRequests = null; }, 'requests without their full scopes');
});

/* ---------- B: the job store behind the real handler ---------- */
const stubReply = ask => {
  const s = ask.records[0].spans[0].s, six = ask.schemaVersion === 'studio.map.6';
  const claims = [{ kind: 'want', text: '[스텁] 원한다', at: s, about: null, replaces: null, ...(six ? { key: 's1' } : {}) }];
  return reply4({ summary: '[스텁]', parts: ask.parts.length ? [part(ask.parts[0].id, { claims })] : [part('new:a', { name: '스텁 부분', role: '[스텁] 역할', basis: [s], claims })] });
};
async function service({ io, limits, env = {}, dir = mkdtempSync(join(tmpdir(), 'af100-')) } = {}) {
  const jobs = await openMapJobs({ dir, ...(io ? { io } : {}), ...(limits ? { limits } : {}) });
  const prov = { calls: 0, gates: [], aborted: [], ignoreAbort: false };
  const fetchImpl = async (url, init) => {
    const n = prov.calls++, g = deferred(); prov.gates.push(g);
    const ask = JSON.parse(JSON.parse(init.body).messages[1].content.replace(/^[^\n]*\n/, ''));
    init.signal.addEventListener('abort', () => { prov.aborted.push(n); if (!prov.ignoreAbort) g.fail(new DOMException('aborted', 'AbortError')); }, { once: true });
    await g.promise;
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(stubReply(ask)) } }] }));
  };
  const handle = createStudioHandler({ env: { DEEPSEEK_API_KEY: KEY, ...env }, jobs, fetchImpl });
  return { dir, jobs, prov, handle, fetchImpl };
}
const project = (text = '요구: 폴더 안의 문서를 한 번에 변환한다.\n작업 보고: 변환기는 문서마다 PDF 하나를 만든다.') => D.pasteRecord(D.createProject(), text, null).project;
async function submission(p, { entryId = 'E_test0000-01', lifecycle = 1, seq = 1 } = {}) {
  const inp = M.buildMapAsk(p, studioView(p), [], undefined, M.MAP6_SCHEMA), wire = J.encodeMapInput(inp);
  const binding = { entryId, projectId: p.id, lifecycle, seq, after: inp.after, schemaVersion: inp.ask.schemaVersion, prompt: await mapPromptId(), model: 'deepseek-flash', askHash: await J.jobHash(inp.ask), inputHash: await J.jobHash(wire) };
  const id = `MJ_${crypto.randomUUID()}`;
  return { id, cap: newCap(), binding, inp, body: JSON.stringify({ version: 'map-job.1', id, binding, input: wire }) };
}
const jcall = async (h, method, path, cap, body, extra = {}) => {
  const res = await h(new Request(`http://127.0.0.1/api/studio/jobs${path}`, { method, headers: { 'x-agentflow-request': '1', 'x-studio-operation': cap, ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...extra }, ...(body !== undefined ? { body } : {}) }));
  return { status: res.status, ...(await res.json()) };
};
const opFile = (dir, id) => JSON.parse(readFileSync(join(dir, 'ops', `${id}.json`), 'utf8'));

test('100-B1 receipt lost: the same id and body again is the same job (one call); another body 409; another capability is told nothing', async () => {
  const { handle, prov, jobs } = await service(), x = await submission(project());
  const first = await jcall(handle, 'POST', '', x.cap, x.body); assert.equal(first.status, 202);
  await until(() => prov.calls === 1, 'called');
  const again = await jcall(handle, 'POST', '', x.cap, x.body); assert.equal(again.status, 200); assert.equal(again.state, 'running');
  const other = await submission(project('요구: 다른 원문이다.'));
  const changed = JSON.stringify({ ...JSON.parse(other.body), id: x.id });
  assert.equal((await jcall(handle, 'POST', '', x.cap, changed)).error.code, 'OPERATION_CONFLICT');
  for (const r of [await jcall(handle, 'POST', '', newCap(), x.body), await jcall(handle, 'GET', `/${x.id}`, newCap()), await jcall(handle, 'POST', `/${x.id}/cancel`, newCap(), '{}'), await jcall(handle, 'POST', `/${x.id}/ack`, newCap(), '{"outcome":"seen"}')])
    assert.deepEqual([r.status, r.error.code], [404, 'OPERATION_NOT_FOUND']);
  assert.equal((await jcall(handle, 'GET', `/${x.id}`, 'not a capability')).status, 404);
  prov.gates[0].open(); await until(async () => (await jcall(handle, 'GET', `/${x.id}`, x.cap)).state === 'ready', 'ready');
  assert.equal(prov.calls, 1); await jobs.close();
});

test('100-B2 while a submission is being recorded, only its own capability hears it is being accepted; two ids of one entry never both start', async () => {
  const hold = deferred(); let held = 0;
  const io = { async writeAtomic(dir, name, text) { if (name.startsWith('MJ_') && held++ === 0) await hold.promise; return fileIo.writeAtomic(dir, name, text); } };
  const { handle, prov, jobs } = await service({ io }), p = project();
  const a = await submission(p), b = await submission(p);
  const pa = jcall(handle, 'POST', '', a.cap, a.body), pb = jcall(handle, 'POST', '', b.cap, b.body);
  await until(() => held === 1, 'first write held');
  assert.equal((await jcall(handle, 'GET', `/${a.id}`, a.cap)).error.code, 'OPERATION_ACCEPTING');
  assert.equal((await jcall(handle, 'GET', `/${a.id}`, newCap())).error.code, 'OPERATION_NOT_FOUND');
  hold.open(); const [ra, rb] = await Promise.all([pa, pb]);
  assert.deepEqual([ra.status, rb.status, rb.error?.code], [202, 409, 'ENTRY_BUSY']);
  await until(() => prov.calls === 1, 'one call'); assert.equal(prov.calls, 1);
  assert.ok(!existsSync(join(jobs.dir, 'ops', `${b.id}.json`)), 'the refused one left nothing');
  prov.gates[0].open(); await until(() => jobs.held().running === 0, 'ended'); await jobs.close();
});

test('100-B3 cancel is recorded before the call is stopped; a late reply never becomes a result; the limiter and the entry are free once', async () => {
  const { handle, prov, jobs, dir } = await service({ env: { STUDIO_MAX_CONCURRENT: '1' } }), p = project(), x = await submission(p);
  prov.ignoreAbort = true; // the provider answers after the abort, as a late reply would
  assert.equal((await jcall(handle, 'POST', '', x.cap, x.body)).status, 202); await until(() => prov.calls === 1, 'called');
  const c = await jcall(handle, 'POST', `/${x.id}/cancel`, x.cap, '{}');
  assert.deepEqual([c.state, c.remote], ['cancelled', 'unknown']); assert.deepEqual(prov.aborted, [0]);
  assert.equal(opFile(dir, x.id).body.state, 'cancelled'); assert.equal(opFile(dir, x.id).body.input, undefined, 'its material is gone');
  prov.gates[0].open(); await until(() => jobs.held().running === 0 && jobs.held().executing === 0, 'the late call ended');
  assert.equal((await jcall(handle, 'GET', `/${x.id}`, x.cap)).state, 'cancelled');
  // The same entry starts again, with the one-call limiter given back exactly once.
  const y = await submission(p); assert.equal((await jcall(handle, 'POST', '', y.cap, y.body)).status, 202);
  const z = await submission(project('요구: 다른 항목.'), { entryId: 'E_test0000-02' });
  assert.equal((await jcall(handle, 'POST', '', z.cap, z.body)).error.code, 'AI_BUSY', 'one at a time, not two');
  prov.gates[1].open(); await until(() => jobs.held().running === 0, 'ended');
  assert.equal((await jcall(handle, 'POST', `/${x.id}/ack`, x.cap, '{"outcome":"seen"}')).acked, 'seen');
  // A tombstone is never a new job: the same id again is its end, with no call.
  assert.equal((await jcall(handle, 'POST', '', x.cap, x.body)).state, 'cancelled'); assert.equal(prov.calls, 2);
  await jobs.close();
});

test('100-B4 room is held for jobs still running: ready places and bytes never go past their limits when they end', async () => {
  const limits = { readyUnacked: 2, materialBytes: 64 * 1024 * 1024, fileBytes: 640 * 1024, inputBytes: 448 * 1024, records: 10000, body: 512 * 1024 };
  const { handle, prov, jobs } = await service({ limits, env: { STUDIO_MAX_CONCURRENT: '8' } });
  const xs = []; for (let i = 0; i < 3; i++) xs.push(await submission(project(`요구: 항목 ${i}을 변환한다.`), { entryId: `E_test0000-1${i}` }));
  assert.equal((await jcall(handle, 'POST', '', xs[0].cap, xs[0].body)).status, 202);
  assert.equal((await jcall(handle, 'POST', '', xs[1].cap, xs[1].body)).status, 202);
  assert.equal((await jcall(handle, 'POST', '', xs[2].cap, xs[2].body)).error.code, 'JOB_STORE_FULL', 'two running already hold both places');
  prov.gates[0].open(); prov.gates[1].open(); await until(() => jobs.held().running === 0, 'ended');
  for (const x of xs.slice(0, 2)) assert.equal((await jcall(handle, 'GET', `/${x.id}`, x.cap)).state, 'ready');
  assert.equal((await jcall(handle, 'POST', '', xs[2].cap, xs[2].body)).error.code, 'JOB_STORE_FULL', 'unconfirmed results are never evicted for a new job');
  assert.equal((await jcall(handle, 'POST', `/${xs[0].id}/ack`, xs[0].cap, '{"outcome":"discarded"}')).acked, 'discarded');
  assert.equal((await jcall(handle, 'POST', '', xs[2].cap, xs[2].body)).status, 202);
  prov.gates[2].open(); await until(() => jobs.held().running === 0, 'ended'); await jobs.close();
  // Bytes: an active job holds a whole file (input and reply), so a store with room for one finished file takes one job.
  const tight = await service({ limits: { ...limits, readyUnacked: 50, materialBytes: 700 * 1024 } });
  const a = await submission(project('요구: 하나.'), { entryId: 'E_test0000-20' }), b = await submission(project('요구: 둘.'), { entryId: 'E_test0000-21' });
  assert.equal((await jcall(tight.handle, 'POST', '', a.cap, a.body)).status, 202);
  assert.equal((await jcall(tight.handle, 'POST', '', b.cap, b.body)).error.code, 'JOB_STORE_FULL');
  tight.prov.gates[0].open(); await until(() => tight.jobs.held().running === 0, 'ended'); await tight.jobs.close();
});

test('100-B5 a refused write: nothing accepted and no call; a result that cannot be kept is never shown', async () => {
  let fail = name => name.startsWith('MJ_');
  const io = { async writeAtomic(dir, name, text) { if (fail(name)) throw Object.assign(new Error('disk'), { code: 'EIO' }); return fileIo.writeAtomic(dir, name, text); } };
  const { handle, prov, jobs, dir } = await service({ io }), x = await submission(project());
  const r = await jcall(handle, 'POST', '', x.cap, x.body);
  assert.deepEqual([r.status, r.error.code, prov.calls], [507, 'JOB_STORE_FAILED', 0]);
  assert.equal(readdirSync(join(dir, 'ops')).filter(f => f.startsWith('MJ_')).length, 0);
  // Accepted; then its ready write fails (and the failed one after it): said as failed here, never ready.
  fail = () => false; const y = await submission(project());
  assert.equal((await jcall(handle, 'POST', '', y.cap, y.body)).status, 202); await until(() => prov.calls === 1, 'called');
  fail = name => name === `${y.id}.json`; prov.gates[0].open();
  await until(() => jobs.held().running === 0, 'ended');
  const v = await jcall(handle, 'GET', `/${y.id}`, y.cap);
  assert.deepEqual([v.state, v.error.code, v.result], ['failed', 'JOB_STORE_FAILED', undefined]);
  assert.equal(opFile(dir, y.id).body.state, 'accepted', 'on disk it is still the accepted job: a restart reads it as interrupted');
  await jobs.close();
});

test('100-B6 cancel before acceptance (the receipt never came): a tombstone under that capability keeps a late submission from calling', async () => {
  const { handle, prov, jobs } = await service(), x = await submission(project());
  const c = await jcall(handle, 'POST', `/${x.id}/cancel`, x.cap, '{}'); assert.deepEqual([c.state, c.remote], ['cancelled', 'not-sent']);
  const late = await jcall(handle, 'POST', '', x.cap, x.body); assert.deepEqual([late.status, late.state], [200, 'cancelled']);
  assert.equal((await jcall(handle, 'POST', '', newCap(), x.body)).error.code, 'OPERATION_NOT_FOUND');
  assert.equal(prov.calls, 0); await jobs.close();
});

test('100-B7 closing fences the store first: a call that ends after it writes nothing, and the next owner opens it', async () => {
  const { handle, prov, jobs, dir } = await service(), x = await submission(project());
  prov.ignoreAbort = true;
  assert.equal((await jcall(handle, 'POST', '', x.cap, x.body)).status, 202); await until(() => prov.calls === 1, 'called');
  const before = readFileSync(join(dir, 'ops', `${x.id}.json`), 'utf8');
  await jobs.close({ graceMs: 20 });
  const next = await openMapJobs({ dir, log: m => console.log('LOG', m) }); assert.deepEqual(next.describe(), { version: 'map-job.1', durable: true }, 'ownership was let go');
  prov.gates[0].open(); await until(() => jobs.held().executing === 0, 'the old call ended');
  const after = JSON.parse(readFileSync(join(dir, 'ops', `${x.id}.json`), 'utf8'));
  assert.notEqual(readFileSync(join(dir, 'ops', `${x.id}.json`), 'utf8'), before, 'the new owner recorded it');
  assert.deepEqual([after.body.state, after.body.result], ['interrupted', undefined], 'the old process wrote nothing after close');
  await next.close();
});

test('100-B8 applied and discarded results shrink to tombstones; a ready result is fetched without an AI key; jobs keep the access code', async () => {
  const { handle, prov, jobs, dir, fetchImpl } = await service({ env: { STUDIO_ACCESS_CODE: 'code-100' } }), x = await submission(project());
  const code = { 'x-studio-access': 'code-100' };
  assert.equal((await jcall(handle, 'POST', '', x.cap, x.body)).error.code, 'ACCESS_CODE_REQUIRED');
  assert.equal((await jcall(handle, 'POST', '', x.cap, x.body, code)).status, 202); prov.gates[0].open();
  await until(async () => (await jcall(handle, 'GET', `/${x.id}`, x.cap, undefined, code)).state === 'ready', 'ready');
  const keyless = createStudioHandler({ env: { STUDIO_ACCESS_CODE: 'code-100' }, jobs, fetchImpl });
  const v = await jcall(keyless, 'GET', `/${x.id}`, x.cap, undefined, code);
  assert.equal(v.state, 'ready'); assert.ok(v.result.reading.id.startsWith('R_') && v.input.ask);
  const y = await submission(project());
  assert.equal((await jcall(keyless, 'POST', '', y.cap, y.body, code)).error.code, 'AI_NOT_CONFIGURED', 'no new job without a key');
  assert.equal((await jcall(keyless, 'POST', `/${x.id}/ack`, x.cap, '{"outcome":"applied"}', code)).acked, 'applied');
  const t = opFile(dir, x.id).body; assert.ok(t.tomb && !t.input && !t.result && !t.binding);
  assert.equal((await jcall(handle, 'POST', `/${x.id}/ack`, x.cap, '{"outcome":"discarded"}', code)).error.code, 'OPERATION_CONFLICT');
  const again = await jcall(handle, 'POST', '', x.cap, x.body, code);
  assert.deepEqual([again.state, again.acked, again.result], ['ready', 'applied', undefined]); assert.equal(prov.calls, 1);
  const status = await (await handle(new Request('http://127.0.0.1/api/studio/status'))).json();
  assert.deepEqual(status.jobs, { version: 'map-job.1', durable: true });
  await jobs.close();
});

/* ---------- D: the browser's reservations, recovery and explicit apply (createMapRun over the real handler) ---------- */
function locks() { const chains = new Map(); return { request(name, cb) { const prev = chains.get(name) ?? Promise.resolve(), next = prev.then(() => cb()); chains.set(name, next.catch(() => {})); return next; } }; }
function memoryKv() { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => { if (m.failNext?.(k)) throw new Error('quota'); m.set(k, v); }, map: m }; }
const reservations = kv => { const v = kv.getItem(JOBS_KEY); return v ? JSON.parse(v).ops : []; };
async function browser(svc) {
  const net = { drop: null, fail: null, sent: [] };
  globalThis.fetch = async (url, o = {}) => {
    net.sent.push(`${o.method ?? 'GET'} ${url}`);
    if (net.fail?.(url, o)) throw new TypeError('network');
    const res = await svc.handle(new Request(`http://127.0.0.1${url}`, o));
    if (net.drop?.(url, o)) throw new TypeError('connection lost after the server answered');
    return res;
  };
  const prompt = await mapPromptId(), entries = new Map(), shared = { kv: memoryKv(), locks: locks() };
  const tab = () => {
    const w = { cur: null, commits: 0, done: [], commitImpl: null, status: { ai: 'deepseek', model: 'm', access: 'open', map: { model: 'deepseek-flash', prompt }, jobs: { durable: true, problem: null } } };
    const store = new JobReservations(shared.kv, shared.locks);
    w.run = createMapRun({ current: () => w.cur, visit: () => w.cur, status: () => w.status, accessCode: () => '', jobs: () => store, pollMs: 2,
      stored: key => { const e = entries.get(key); return e ? { project: e.project, lifecycle: e.lifecycle } : null; },
      commit: async next => {
        const o = w.cur, e = entries.get(o.key); w.commits++; const failed = w.commitImpl ? await w.commitImpl(next, o) : null; if (failed) return failed;
        // The workspace's own check: a save only on the save this page read.
        if (e.seq !== o.ref.seq || e.lifecycle !== o.ref.lifecycle) return '다른 탭에서 바뀌어 저장하지 않았어요.';
        o.project = next; o.view = studioView(next); e.project = next; e.seq++; o.ref = { ...o.ref, seq: e.seq }; return null;
      },
      done: a => w.done.push(a), changed: () => {} });
    w.open = key => { const e = entries.get(key); w.cur = { key, kind: 'saved', project: e.project, view: studioView(e.project), ref: { lifecycle: e.lifecycle, seq: e.seq } }; return w.cur; };
    /** The person's own edit in this page, saved (another tab's save is edit() on the entries directly). */
    w.edit = change => { const e = entries.get(w.cur.key); const next = change(w.cur.project); e.project = next; e.seq++; Object.assign(w.cur, { project: next, view: studioView(next), ref: { ...w.cur.ref, seq: e.seq } }); };
    return w;
  };
  return { net, entries, shared, tab, add: (key, p, lifecycle = 1) => entries.set(key, { project: p, lifecycle, seq: 1 }),
    /** Another tab's save of an entry. */
    saveElsewhere: (key, change) => { const e = entries.get(key); e.project = change(e.project); e.seq++; } };
}
const readings = p => p.readings.filter(isMapReading).length;
let savedFetch;
test.before(() => { savedFetch = globalThis.fetch; });
test.afterEach(() => { globalThis.fetch = savedFetch; });

test('100-D1 two tabs and a double click: one reservation, one job, one call; the asking visit applies, the other tab lets it go', async () => {
  const svc = await service(), b = await browser(svc), A = 'E_tab00000-0A';
  b.add(A, project()); const t1 = b.tab(), t2 = b.tab(); t1.open(A); t2.open(A);
  const r1 = t1.run.run(); void t1.run.run(); const r2 = t2.run.run(); await Promise.all([r1, r2]);
  await until(() => svc.prov.calls === 1, 'called');
  assert.equal(reservations(b.shared.kv).length, 1); assert.equal(b.net.sent.filter(x => x === 'POST /api/studio/jobs').length, 1);
  assert.ok(t1.run.state().pending && t2.run.state().pending && t2.run.detail().durable);
  svc.prov.gates[0].open();
  await until(() => readings(b.entries.get(A).project) === 1 && reservations(b.shared.kv).length === 0, 'applied and acknowledged');
  await until(() => !t2.run.state().pending && !t2.run.state().ready, 'the other tab let it go');
  assert.equal(t1.done.length, 1); assert.equal(t2.commits, 0); assert.equal(svc.prov.calls, 1);
  assert.equal(readings(b.entries.get(A).project), 1); await svc.jobs.close();
});

test('100-D2 the receipt is lost on the way back: the same id is sent again, the job is one, and its result is the one applied', async () => {
  const svc = await service(), b = await browser(svc), A = 'E_tab00000-0B';
  b.add(A, project()); const t = b.tab(); t.open(A);
  let dropped = 0; b.net.drop = (url, o) => o.method === 'POST' && url === '/api/studio/jobs' && dropped++ === 0;
  await t.run.run(); await until(() => svc.prov.calls === 1, 'called');
  assert.equal(b.net.sent.filter(x => x === 'POST /api/studio/jobs').length, 2, 'sent again with the same id');
  svc.prov.gates[0].open(); await until(() => readings(b.entries.get(A).project) === 1, 'applied');
  assert.equal(svc.prov.calls, 1); await svc.jobs.close();
});

test('100-D3 after a reload the result waits for its entry: another open project is untouched, applied only when asked, with the kept id and time', async () => {
  const svc = await service(), b = await browser(svc), A = 'E_tab00000-0C', B = 'E_tab00000-0D';
  b.add(A, project()); b.add(B, project('요구: B는 일정표를 보여 준다.'));
  const first = b.tab(); first.open(A); await first.run.run(); await until(() => svc.prov.calls === 1, 'called');
  const page = b.tab(); page.open(B); const bBefore = page.cur.project; page.run.resume();
  await until(() => page.run.stateOf(A).pending, 'found again');
  first.run.dispose(); // the first page is gone
  svc.prov.gates[0].open();
  await until(() => page.run.stateOf(A).ready, 'ready for A');
  assert.equal(page.cur.key, B); assert.equal(page.cur.project, bBefore, 'B untouched'); assert.equal(readings(b.entries.get(A).project), 0, 'nothing applied while away');
  assert.equal(page.commits, 0);
  page.open(A); await page.run.applyReady();
  const p = b.entries.get(A).project, r = p.readings.filter(isMapReading).at(-1);
  assert.equal(readings(p), 1); assert.match(r.id, /^R_[0-9a-f-]{36}$/); assert.equal(svc.prov.calls, 1);
  await until(() => reservations(b.shared.kv).length === 0, 'acknowledged'); await svc.jobs.close();
});

test('100-D4 saved but the acknowledgement lost: on the next page it is told by its reading id and hash, acknowledged, never applied twice', async () => {
  const svc = await service(), b = await browser(svc), A = 'E_tab00000-0E';
  b.add(A, project()); const t = b.tab(); t.open(A);
  b.net.fail = url => url.endsWith('/ack');
  await t.run.run(); await until(() => svc.prov.calls === 1, 'called'); svc.prov.gates[0].open();
  await until(() => readings(b.entries.get(A).project) === 1, 'saved');
  await until(() => reservations(b.shared.kv)[0]?.applied, 'the reading id noted');
  const { id, cap } = reservations(b.shared.kv)[0];
  assert.equal((await jcall(svc.handle, 'GET', `/${id}`, cap)).state, 'ready', 'the server still holds it');
  t.run.dispose();
  // The note of the saved reading id is lost too (the crash came before it): only the reading id and hash in the project tell.
  const env = JSON.parse(b.shared.kv.getItem(JOBS_KEY)); env.ops[0].applied = null; b.shared.kv.setItem(JOBS_KEY, JSON.stringify(env));
  // A reading under that id with another hash is a conflict: nothing is applied or acknowledged.
  const saved = b.entries.get(A).project, mine = saved.readings.find(isMapReading);
  b.entries.get(A).project = { ...saved, readings: saved.readings.map(r => r === mine ? { ...r, hash: '0'.repeat(64) } : r) };
  const odd = b.tab(); odd.open(A); b.net.fail = null; odd.run.resume();
  await until(() => odd.run.state().ready, 'ready'); await odd.run.applyReady();
  assert.match(odd.run.state().error, /이미 지도에 있어 반영하지 않았어요/); assert.equal(odd.commits, 0); assert.equal(reservations(b.shared.kv).length, 1);
  odd.run.dispose(); b.entries.get(A).project = saved;
  const next = b.tab(); next.open(A); next.run.resume();
  await until(() => reservations(b.shared.kv).length === 0, 'acknowledged without applying');
  assert.equal(readings(b.entries.get(A).project), 1); assert.equal(next.commits, 0); assert.equal(svc.prov.calls, 1);
  assert.equal(next.run.state().error, null); assert.equal((await jcall(svc.handle, 'GET', `/${id}`, cap)).acked, 'applied'); await svc.jobs.close();
});

test('100-D5 a failed save keeps the result ready (saving again needs no call); another lifecycle refuses it and lets the job go', async () => {
  const svc = await service(), b = await browser(svc), A = 'E_tab00000-0F';
  b.add(A, project()); const t = b.tab(); t.open(A);
  t.commitImpl = async () => '다른 탭에서 바뀌어 저장하지 않았어요.';
  await t.run.run(); await until(() => svc.prov.calls === 1, 'called'); svc.prov.gates[0].open();
  await until(() => t.run.state().ready && t.run.state().error, 'save refused, still ready');
  t.commitImpl = null; await t.run.applyReady();
  assert.equal(readings(b.entries.get(A).project), 1); assert.equal(svc.prov.calls, 1);
  // Another reading in the same entry, then the entry is trashed and restored (lifecycle 2) before it is applied.
  b.saveElsewhere(A, p => D.pasteRecord(p, '작업 보고: 폴더 입력은 다음 판에서.', null).project); t.open(A);
  await t.run.run(); await until(() => svc.prov.calls === 2, 'called'); t.cur = null; svc.prov.gates[1].open();
  const id = () => reservations(b.shared.kv)[0]?.id;
  await until(() => t.run.stateOf(A).ready, 'ready'); const cap = reservations(b.shared.kv)[0].cap, jid = id();
  b.entries.get(A).lifecycle = 2; t.open(A); assert.match(t.run.state().error, /보관되었다가 다시 열려/);
  await until(async () => (await jcall(svc.handle, 'GET', `/${jid}`, cap)).acked === 'discarded', 'let go on the server');
  assert.equal(readings(b.entries.get(A).project), 1); await svc.jobs.close();
});

test('100-D6 cancel: recorded by the server, said with what it cannot promise; the late reply applies nothing', async () => {
  const svc = await service(), b = await browser(svc), A = 'E_tab00000-10';
  svc.prov.ignoreAbort = true;
  b.add(A, project()); const t = b.tab(); t.open(A);
  await t.run.run(); await until(() => svc.prov.calls === 1, 'called');
  t.run.cancel(); assert.ok(t.run.detail().cancelling);
  await until(() => !t.run.state().pending, 'cancelled');
  assert.match(t.run.detail().notice, /요금까지 멈췄는지는 알 수 없어요/);
  svc.prov.gates[0].open(); await until(() => svc.jobs.held().executing === 0, 'late call ended');
  await until(() => reservations(b.shared.kv).length === 0, 'closed');
  assert.equal(readings(b.entries.get(A).project), 0); assert.equal(t.run.state().ready, false); await svc.jobs.close();
});

test('100-D7 the server restarts during a job: the page says it stopped and sends nothing again; a reservation that cannot be written sends nothing', async () => {
  const svc = await service(), b = await browser(svc), A = 'E_tab00000-11';
  b.add(A, project()); const t = b.tab(); t.open(A);
  await t.run.run(); await until(() => svc.prov.calls === 1, 'called');
  svc.prov.ignoreAbort = true; await svc.jobs.close({ graceMs: 5 });
  const again = await service({ dir: svc.dir }); await browser(again); // the page's address now reaches the restarted server
  await until(() => !t.run.state().pending, 'told');
  assert.match(t.run.state().error, /중단됐어요/); assert.equal(again.prov.calls, 0, 'nothing sent again');
  await until(() => reservations(b.shared.kv).length === 0, 'seen');
  // Storage refuses the reservation: nothing goes.
  b.shared.kv.map.failNext = k => k === JOBS_KEY;
  await t.run.run(); assert.match(t.run.state().error, /기록하지 못해 보내지 않았어요/); assert.equal(again.prov.calls, 0);
  svc.prov.gates[0]?.open(); await again.jobs.close();
});

test('100-D8 a reservation whose receipt never came (reload): the job is closed with a cancel under its capability before it is forgotten', async () => {
  const svc = await service(), b = await browser(svc), A = 'E_tab00000-12';
  b.add(A, project()); const t = b.tab(); t.open(A);
  b.net.fail = (url, o) => o.method === 'POST' && url === '/api/studio/jobs'; // never arrives
  void t.run.run(); await until(() => reservations(b.shared.kv).length === 1 && b.net.sent.filter(x => x === 'POST /api/studio/jobs').length === 3, 'tried with the same id');
  const r = reservations(b.shared.kv)[0], body = (await submission(project())).body; t.run.dispose();
  const page = b.tab(); page.open(A); b.net.fail = null; page.run.resume();
  await until(() => reservations(b.shared.kv).length === 0, 'closed and forgotten');
  assert.match(page.run.state().error, /접수되지 않았어요/);
  // The original submission arriving late (same id and capability) starts nothing.
  const late = await jcall(svc.handle, 'POST', '', r.cap, JSON.stringify({ ...JSON.parse(body), id: r.id }));
  assert.equal(late.state, 'cancelled'); assert.equal(svc.prov.calls, 0); await svc.jobs.close();
});

test('100-D9 a found-again result applies only on the save it was asked from; this page\'s own edits while it runs are still its own', async () => {
  const svc = await service(), b = await browser(svc), A = 'E_tab00000-13';
  b.add(A, project()); const t = b.tab(); t.open(A);
  // Owned, same page: the person renames the project while it runs; the result applies on top of that (as in 97).
  await t.run.run(); await until(() => svc.prov.calls === 1, 'called');
  t.edit(p => D.rename(p, '이름을 바꾼 A'));
  svc.prov.gates[0].open(); await until(() => readings(b.entries.get(A).project) === 1, 'applied over its own edit');
  assert.equal(b.entries.get(A).project.name, '이름을 바꾼 A');
  await until(() => reservations(b.shared.kv).length === 0, 'acknowledged');
  // Found again after a reload, while another tab saved the entry meanwhile (an edit applyReading would let through): refused.
  b.saveElsewhere(A, p => D.pasteRecord(p, '작업 보고: 결과 파일은 한 폴더에 모은다.', null).project); t.open(A);
  await t.run.run(); await until(() => svc.prov.calls === 2, 'called'); t.run.dispose();
  b.saveElsewhere(A, p => D.rename(p, '다른 탭이 바꾼 이름'));
  svc.prov.gates[1].open();
  const page = b.tab(); page.open(A); page.run.resume();
  await until(() => page.run.state().ready, 'ready'); const { id, cap } = reservations(b.shared.kv)[0];
  await page.run.applyReady();
  assert.match(page.run.state().error, /다른 화면에서 저장되어 이번 결과는 반영하지 않았어요/); assert.equal(page.commits, 0);
  assert.equal(readings(b.entries.get(A).project), 1, 'nothing rebased');
  await until(async () => (await jcall(svc.handle, 'GET', `/${id}`, cap)).acked === 'discarded', 'let go'); assert.equal(svc.prov.calls, 2);
  // Found again on the very save it was asked from: applied when asked.
  b.saveElsewhere(A, p => D.pasteRecord(p, '작업 보고: 변환 실패는 이름과 함께 알린다.', null).project); page.open(A);
  await page.run.run(); await until(() => svc.prov.calls === 3, 'called'); page.run.dispose(); svc.prov.gates[2].open();
  const third = b.tab(); third.open(A); third.run.resume(); await until(() => third.run.state().ready, 'ready'); await third.run.applyReady();
  assert.equal(readings(b.entries.get(A).project), 2); assert.equal(third.run.state().error, null);
  await until(() => reservations(b.shared.kv).length === 0, 'acknowledged'); await svc.jobs.close();
});

test('100-D10 an applied reading is recognised only in its own entry, project and lifecycle', async () => {
  const svc = await service(), b = await browser(svc), A = 'E_tab00000-14';
  b.add(A, project()); const t = b.tab(); t.open(A);
  b.net.fail = url => url.endsWith('/ack');
  await t.run.run(); await until(() => svc.prov.calls === 1, 'called'); svc.prov.gates[0].open();
  await until(() => reservations(b.shared.kv)[0]?.applied, 'saved, acknowledgement owed'); t.run.dispose();
  const env = JSON.parse(b.shared.kv.getItem(JOBS_KEY)); env.ops[0].applied = null; b.shared.kv.setItem(JOBS_KEY, JSON.stringify(env));
  // Trashed and restored since: the same reading in a later lifecycle is not this job's acknowledgement.
  b.entries.get(A).lifecycle = 2; b.net.fail = null;
  const page = b.tab(); page.open(A); page.run.resume();
  await until(() => page.run.state().error, 'told');
  assert.match(page.run.state().error, /보관되었다가 다시 열려/); assert.equal(page.commits, 0);
  const { id, cap } = env.ops[0]; await until(async () => (await jcall(svc.handle, 'GET', `/${id}`, cap)).acked === 'discarded', 'let go, not acknowledged as applied');
  await svc.jobs.close();
});

test('100-D11 a reservation re-bound to another entry (same id, capability and input) is refused before anything is loaded or acknowledged', async () => {
  const svc = await service(), b = await browser(svc), A = 'E_tab00000-15', COPY = 'E_tab00000-16';
  const p = project(); b.add(A, p); b.add(COPY, p); // an import copy: the same project, sources and part ids
  const t = b.tab(); t.open(A); await t.run.run(); await until(() => svc.prov.calls === 1, 'called'); t.run.dispose();
  svc.prov.gates[0].open();
  const env = JSON.parse(b.shared.kv.getItem(JOBS_KEY)), { id, cap } = env.ops[0];
  await until(async () => (await jcall(svc.handle, 'GET', `/${id}`, cap)).state === 'ready', 'ready');
  env.ops[0].binding = { ...env.ops[0].binding, entryId: COPY }; b.shared.kv.setItem(JOBS_KEY, JSON.stringify(env));
  const page = b.tab(); page.open(COPY); page.run.resume();
  await until(() => page.run.state().error, 'refused');
  assert.match(page.run.state().error, /맞지 않아 반영하지 않았어요/); assert.equal(page.run.state().ready, false);
  assert.equal(readings(b.entries.get(COPY).project) + readings(b.entries.get(A).project), 0); assert.equal(page.commits, 0);
  const v = await jcall(svc.handle, 'GET', `/${id}`, cap); assert.deepEqual([v.state, v.acked, v.binding.entryId], ['ready', null, A], 'the job is untouched');
  // A forged applied note is not taken as an acknowledgement either.
  env.ops[0].binding = { ...env.ops[0].binding, entryId: A }; env.ops[0].applied = 'R_00000000-0000-4000-8000-000000000000'; b.shared.kv.setItem(JOBS_KEY, JSON.stringify(env));
  page.run.dispose(); const again = b.tab(); again.open(A); again.run.resume();
  await until(() => again.run.state().ready, 'shown as the ready result it is'); assert.equal((await jcall(svc.handle, 'GET', `/${id}`, cap)).acked, null);
  await again.run.applyReady(); assert.equal(readings(b.entries.get(A).project), 1);
  await until(() => reservations(b.shared.kv).length === 0, 'acknowledged'); await svc.jobs.close();
});

test('100-D12 no persistent storage for reservations: nothing is reserved or sent, and the page says why; a failing read never reads as empty', async () => {
  const svc = await service(), b = await browser(svc), A = 'E_tab00000-17';
  b.add(A, project()); const prompt = await mapPromptId();
  const host = (store) => { const w = { cur: null }; w.run = createMapRun({ current: () => w.cur, status: () => ({ ai: 'deepseek', model: 'm', access: 'open', map: { model: 'deepseek-flash', prompt }, jobs: { durable: true, problem: null } }),
    accessCode: () => '', jobs: () => store, pollMs: 2, commit: async () => null, done: () => {}, changed: () => {} });
    const e = b.entries.get(A); w.cur = { key: A, kind: 'saved', project: e.project, view: studioView(e.project), ref: { lifecycle: 1, seq: 1 } }; return w; };
  const memoryOnly = host(new JobReservations(memoryKv(), locks(), false));
  assert.equal(memoryOnly.run.can(), false); assert.match(memoryOnly.run.blocked(), /예약할 수 없어/);
  await memoryOnly.run.run(); assert.equal(memoryOnly.run.state().pending, null);
  // Storage that refuses reads (a privacy setting): the reservation fails, nothing goes, nothing is overwritten.
  const writes = []; const refusing = { getItem: () => { throw new Error('SecurityError'); }, setItem: (k, v) => writes.push([k, v]) };
  const store = new JobReservations(refusing, locks());
  assert.throws(() => store.list()); await assert.rejects(store.reserve({}));
  const w = host(store); await w.run.run();
  assert.match(w.run.state().error, /기록하지 못해 보내지 않았어요/); assert.deepEqual(writes, []);
  assert.equal(svc.prov.calls, 0); assert.ok(!b.net.sent.some(x => x.startsWith('POST /api/studio/jobs')));
  await svc.jobs.close();
});
