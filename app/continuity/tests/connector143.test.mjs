// AgentFlow connector: the local server's mailbox (server/connector.mjs), its routes in the Studio handler, and the MCP server
// (connector/agentflow-mcp.mjs) spoken to over stdio as a client would, against a real local Studio. No provider is called.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStudioHandler } from '../server/studio.mjs';
import { openConnector, readRecordInput, recordText, toolOfClient, CONNECTOR_LIMITS } from '../server/connector.mjs';
import { createContinuityApp } from '../server/app.mjs';
import { readConfig } from '../../server/config.mjs';
import { createConnector, TOOLS } from '../connector/agentflow-mcp.mjs';
import { sessionOrigin } from '../dist/public/shared/handover.js';

const ROOT = process.platform === 'win32' ? 'C:\\work\\salon' : '/work/salon';
const INNER = process.platform === 'win32' ? 'C:\\work\\salon\\app' : '/work/salon/app';
const KEY = 'sk-abcdefghijklmnopqrstuvwxyz123456';
const tmp = () => mkdtemp(join(tmpdir(), 'af-connector-'));

test('CONN-1 a record is kept as a session record the page reads, attributed to the client, with keys hidden', async t => {
  const dir = await tmp(); t.after(() => rm(dir, { recursive: true, force: true }));
  const c = await openConnector({ dir, now: () => new Date('2026-10-31T10:00:00Z') });
  const got = await c.add({ client: 'claude-code', folder: INNER, branch: 'main', title: '예약 문자', request: `예약 확정 문자 보내 줘. 키는 ${KEY}`, answer: '문자 발송을 붙였어요.', files: ['src/sms.ts'] });
  assert.equal(got.seq, 1); assert.equal(got.redacted, 1);
  const { records, last, more } = c.since(0, { folders: [ROOT] });
  assert.equal(last, 1); assert.equal(more, false); assert.equal(records.length, 1);
  const text = records[0].text;
  assert.ok(!text.includes(KEY) && text.includes('[가려진 비밀값]'));
  assert.match(text, /^\[Claude Code 세션 기록 · 예약 문자 · 작업 폴더 .+ · 브랜치 main\]/);
  assert.match(text, /── 사용자 요청 · \d\d:\d\d ──\n예약 확정 문자 보내 줘/);
  assert.match(text, /── Claude Code 답변 · \d\d:\d\d ──\n문자 발송을 붙였어요\.\n\(바꾼 파일: src\/sms\.ts\)/);
  const o = sessionOrigin(text);
  assert.deepEqual([o.tool, o.title, o.cwd, o.branch], ['claude', '예약 문자', INNER, 'main']);
  // Another folder, or nothing after the last one taken, gives nothing; a restart keeps what was kept.
  assert.equal(c.since(0, { folders: [process.platform === 'win32' ? 'C:\\work\\other' : '/work/other'] }).records.length, 0);
  assert.equal(c.since(1, { folders: [ROOT] }).records.length, 0);
  await c.flush();
  const again = await openConnector({ dir, now: () => new Date('2026-10-31T10:05:00Z') });
  assert.equal(again.since(0, { folders: [ROOT] }).records.length, 1);
  assert.ok(!(await readFile(join(dir, 'connector.json'), 'utf8')).includes(KEY), 'the key is never written to disk');
});

test('CONN-2 what a client sends is checked; the header cannot be shaped by it', () => {
  assert.equal(toolOfClient('claude-code'), 'claude'); assert.equal(toolOfClient('codex-mcp-client'), 'codex'); assert.equal(toolOfClient('claude-ai'), 'web'); assert.equal(toolOfClient(undefined), 'web');
  const ok = { folder: ROOT, request: 'r', answer: 'a' };
  assert.doesNotThrow(() => readRecordInput(ok));
  for (const bad of [null, [], { ...ok, folder: 'relative/path' }, { request: 'r', answer: 'a' }, { ...ok, request: '  ' }, { ...ok, answer: 3 }, { ...ok, files: 'x' }, { ...ok, project: 'a b' }])
    assert.throws(() => readRecordInput(bad), e => e.code === 'INVALID_INPUT', JSON.stringify(bad));
  assert.throws(() => readRecordInput({ ...ok, answer: 'x'.repeat(CONNECTOR_LIMITS.answer + 1) }), e => e.code === 'INPUT_TOO_LARGE');
  // A title with a line break or a fake header stays one header line.
  const r = readRecordInput({ ...ok, title: '제목]\n[Codex 세션 기록', client: 'claude-code' });
  const text = recordText({ ...r, at: null });
  assert.equal(text.split('\n')[0], `[Claude Code 세션 기록 · 제목] [Codex 세션 기록 · 작업 폴더 ${ROOT}]`);
  // A change request named by its id goes into the answer, so the map reads the record as that request's report.
  const rq = 'RQ_1e369d5f-0000-4000-8000-000000000001';
  assert.ok(recordText({ ...readRecordInput({ ...ok, request_id: rq }), at: null }).endsWith(`답변 ──\na\n(맡긴 변경 요청: ${rq})`));
  assert.throws(() => readRecordInput({ ...ok, request_id: 'RQ_x' }), e => e.code === 'INVALID_INPUT');
  // A title that reads like a field is put in 「」 so it stays the title.
  assert.equal(sessionOrigin(recordText({ ...readRecordInput({ ...ok, title: '브랜치 정리' }), at: null })).title, '브랜치 정리');
});

test('CONN-3 handover: the page leaves one per project; a folder inside its folder gets it', async t => {
  const dir = await tmp(); t.after(() => rm(dir, { recursive: true, force: true }));
  const c = await openConnector({ dir });
  assert.equal(c.handover({ folder: INNER }).text, null);
  await c.publish({ key: 'saved:P1', code: 'ABCDEF', name: '미용실', folders: [ROOT], text: '# 인수인계: 미용실 v1' });
  await c.publish({ key: 'saved:P1', code: 'ABCDEF', name: '미용실', folders: [ROOT], text: `# 인수인계: 미용실 v2 ${KEY}` });
  const h = c.handover({ folder: INNER });
  assert.equal(h.name, '미용실'); assert.match(h.text, /v2/); assert.ok(!h.text.includes(KEY));
  assert.equal(c.handover({ project: 'ABCDEF' }).name, '미용실');
  for (const bad of [{}, { key: 'saved:P1', code: 'abc', name: 'x', folders: [ROOT], text: 't' }, { key: 'saved:P1', code: 'ABCDEF', name: 'x', folders: ['rel'], text: 't' }])
    await assert.rejects(c.publish(bad), e => e.code === 'INVALID_INPUT');
});

const req = (path, { method = 'GET', headers = {}, body } = {}) => new Request(`http://127.0.0.1:4317${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body), duplex: 'half',
  headers: { 'x-agentflow-request': '1', ...(method === 'POST' ? { 'content-type': 'application/json' } : {}), ...headers } });

test('CONN-4 routes: same origin only, the request header, offered in status only with a mailbox', async t => {
  const dir = await tmp(); t.after(() => rm(dir, { recursive: true, force: true }));
  const handle = createStudioHandler({ env: {}, connector: await openConnector({ dir }) });
  assert.deepEqual((await (await handle(req('/api/studio/status'))).json()).connector, { version: 'connector.1' });
  assert.equal((await (await createStudioHandler({ env: {} })(req('/api/studio/status'))).json()).connector, undefined);
  assert.equal((await createStudioHandler({ env: {} })(req('/api/studio/connector/records'))).status, 404);
  const post = await handle(req('/api/studio/connector/records', { method: 'POST', body: { client: 'codex', folder: ROOT, request: '요청', answer: '답' } }));
  assert.equal(post.status, 200);
  const got = await (await handle(req(`/api/studio/connector/records?after=0&folder=${encodeURIComponent(ROOT)}`))).json();
  assert.equal(got.records.length, 1); assert.match(got.records[0].text, /^\[Codex 세션 기록/);
  assert.equal((await handle(new Request('http://127.0.0.1:4317/api/studio/connector/records?after=0'))).status, 403, 'no request header');
  const allowed = createStudioHandler({ env: { STUDIO_ALLOWED_ORIGINS: 'https://example.com' }, connector: await openConnector({ dir }) });
  assert.equal((await allowed(req('/api/studio/connector/records?after=0', { headers: { origin: 'https://example.com' } }))).status, 403, 'a listed other origin is still refused');
  assert.equal((await handle(req('/api/studio/connector/records?after=-1'))).status, 400);
  assert.equal((await handle(req('/api/studio/connector/other'))).status, 404);
  assert.throws(() => createStudioHandler({ env: {}, policy: 'existing-map', connector: {} }));
});

/** A real local Studio on a free port (no provider), and the MCP server spawned as a client spawns it. */
async function studio(t) {
  const dir = await tmp(); t.after(() => rm(dir, { recursive: true, force: true }));
  const connector = await openConnector({ dir });
  const server = createContinuityApp({ config: readConfig({ AI_MODE: 'mock', PORT: '0' }), studio: createStudioHandler({ env: {}, connector }) });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); t.after(() => new Promise(r => server.close(r)));
  return { url: `http://127.0.0.1:${server.address().port}`, connector };
}
function rpc(child) {
  let buf = '', next = 1; const waiting = new Map();
  child.stdout.on('data', d => { buf += d; for (let i; (i = buf.indexOf('\n')) >= 0;) { const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); waiting.get(m.id)?.(m); waiting.delete(m.id); } });
  return {
    call: (method, params) => new Promise(r => { const id = next++; waiting.set(id, r); child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`); }),
    notify: method => child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method })}\n`)
  };
}

test('CONN-5 the MCP server over stdio: initialize, list, record into the Studio, take the handover', async t => {
  const { url, connector } = await studio(t);
  const script = fileURLToPath(new URL('../connector/agentflow-mcp.mjs', import.meta.url));
  const child = spawn(process.execPath, [script], { env: { ...process.env, AGENTFLOW_URL: url, AGENTFLOW_FOLDER: INNER }, stdio: ['pipe', 'pipe', 'pipe'] });
  t.after(() => child.kill());
  const c = rpc(child);
  const init = await c.call('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'claude-code', version: '1' } });
  assert.equal(init.result.protocolVersion, '2025-06-18'); assert.equal(init.result.serverInfo.name, 'agentflow'); assert.ok(init.result.capabilities.tools);
  c.notify('notifications/initialized');
  assert.deepEqual((await c.call('tools/list')).result.tools.map(x => x.name), ['agentflow_handover', 'agentflow_record']);
  const none = await c.call('tools/call', { name: 'agentflow_handover', arguments: {} });
  assert.match(none.result.content[0].text, /인수인계가 아직 없어요/);
  const rec = await c.call('tools/call', { name: 'agentflow_record', arguments: { title: '시험', request: '버튼 고쳐 줘', answer: '고쳤어요.', files: ['a.ts'] } });
  assert.equal(rec.result.isError, undefined); assert.match(rec.result.content[0].text, /기록을 남겼어요/);
  const kept = connector.since(0, { folders: [ROOT] }).records;
  assert.equal(kept.length, 1); assert.match(kept[0].text, /^\[Claude Code 세션 기록 · 시험 · 작업 폴더 /);
  await connector.publish({ key: 'saved:P1', code: 'ABCDEF', name: '미용실', folders: [ROOT], text: '# 인수인계: 미용실' });
  const got = await c.call('tools/call', { name: 'agentflow_handover', arguments: {} });
  assert.match(got.result.content[0].text, /「미용실」의 인수인계예요[\s\S]*# 인수인계: 미용실/);
  assert.equal((await c.call('tools/call', { name: 'nope', arguments: {} })).error.code, -32602);
  assert.equal((await c.call('resources/list')).error.code, -32601);
  assert.deepEqual((await c.call('ping')).result, {});
});

test('CONN-6 a Studio that is not running, or refuses, is said as a tool error the AI can read', async () => {
  const down = createConnector({ env: { AGENTFLOW_URL: 'http://127.0.0.1:9' }, cwd: ROOT, fetchImpl: async () => { throw new TypeError('fetch failed'); }, branch: async () => null });
  const r = await down.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'agentflow_record', arguments: { request: 'r', answer: 'a' } } });
  assert.equal(r.result.isError, true); assert.match(r.result.content[0].text, /연결하지 못했어요/);
  const coded = createConnector({ env: {}, cwd: ROOT, branch: async () => null, fetchImpl: async () => new Response(JSON.stringify({ error: { code: 'ACCESS_CODE_REQUIRED' } }), { status: 401 }) });
  assert.match((await coded.handle({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'agentflow_handover', arguments: {} } })).result.content[0].text, /AGENTFLOW_ACCESS_CODE/);
  assert.equal(await coded.handle({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  assert.ok(TOOLS.every(x => x.inputSchema.type === 'object' && x.description.length > 40));
});
