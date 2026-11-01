// Web AI connector (server/cloud-connector.mjs) as Claude's connector client and a browser meet it: discovery, registration, consent,
// GitHub sign-in (a fake GitHub), the token exchange with PKCE and refresh rotation, /mcp tools, the Studio page's API, PC keys,
// and one user never seeing another's. An in-memory KV; nothing leaves the process.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createCloudConnector, CLOUD_TOOLS } from '../server/cloud-connector.mjs';
import { studioWorker } from '../server/worker.mjs';
import { durableConnectorKv, consumeOAuth, oauthMigration, assertConnectorStorage, OAUTH_CONSUME_MIGRATION } from '../server/oauth-consume.mjs';
import { memoryDurableNamespace } from './helpers/durable-storage.mjs';

const O = 'https://studio.example.dev';
function memoryKv() {
  const m = new Map();
  return { m,
    async get(k, type) { const v = m.get(k); if (!v || (v.exp && v.exp < Date.now())) return null; return type === 'json' ? JSON.parse(v.value) : v.value; },
    async put(k, value, o) { m.set(k, { value, exp: o?.expirationTtl ? Date.now() + o.expirationTtl * 1000 : 0 }); },
    async delete(k) { m.delete(k); },
    async list({ prefix = '', cursor = '', limit = 1000 } = {}) { const all = [...m.keys()].filter(k => k.startsWith(prefix) && k > cursor).sort(); const keys = all.slice(0, limit).map(name => ({ name })); return { keys, list_complete: all.length <= limit, cursor: keys.at(-1)?.name }; } };
}
/** A fake GitHub: each sign-in code names a user. */
function fakeGitHub(users) {
  const seen = [];
  return { seen, fetch: async (url, init = {}) => {
    seen.push(String(url));
    if (String(url) === 'https://github.com/login/oauth/access_token') { const { code, client_secret } = JSON.parse(init.body); assert.equal(client_secret, 'gh-secret'); return new Response(JSON.stringify(users[code] ? { access_token: `gho_${code}` } : { error: 'bad_verification_code' }), { status: 200 }); }
    if (String(url) === 'https://api.github.com/user') { const code = init.headers.Authorization.slice('Bearer gho_'.length); return new Response(JSON.stringify(users[code]), { status: 200 }); }
    throw new Error(`unexpected fetch ${url}`);
  } };
}
const env = (kv, extra = {}) => ({ CONNECTOR_KV: kv, CONNECTOR_OAUTH: memoryDurableNamespace(), GITHUB_CLIENT_ID: 'gh-id', GITHUB_CLIENT_SECRET: 'gh-secret', ...extra });
const b64 = b => b.toString('base64url');
const pkce = () => { const verifier = b64(Buffer.from('v'.repeat(48))); return { verifier, challenge: b64(createHash('sha256').update(verifier).digest()) }; };
const cookieOf = (res, name) => res.headers.getSetCookie().map(c => c.split(';')[0]).find(c => c.startsWith(`${name}=`))?.slice(name.length + 1);

/** Claude's whole sign-in: register, authorize, consent, GitHub, callback, token. Returns the tokens. */
async function signIn(c, code, { redirect = 'https://claude.ai/api/mcp/auth_callback' } = {}) {
  const reg = await c.handle(new Request(`${O}/oauth/register`, { method: 'POST', body: JSON.stringify({ client_name: 'Claude', redirect_uris: [redirect], token_endpoint_auth_method: 'none' }) }));
  assert.equal(reg.status, 201); const { client_id } = await reg.json();
  const { verifier, challenge } = pkce();
  const q = new URLSearchParams({ response_type: 'code', client_id, redirect_uri: redirect, code_challenge: challenge, code_challenge_method: 'S256', state: 'st-1', scope: 'agentflow', resource: `${O}/mcp` });
  const consentPage = await c.handle(new Request(`${O}/oauth/authorize?${q}`));
  assert.equal(consentPage.status, 200); const html = await consentPage.text();
  assert.match(html, /Claude/); assert.match(html, new RegExp(new URL(redirect).host.replace(/\./g, '\\.')));
  const ask = /name="ask" value="([^"]+)"/.exec(html)[1];
  const toGh = await c.handle(new Request(`${O}/oauth/consent`, { method: 'POST', body: new URLSearchParams({ ask }) }));
  assert.equal(toGh.status, 302); const gh = new URL(toGh.headers.get('location'));
  assert.equal(gh.origin + gh.pathname, 'https://github.com/login/oauth/authorize'); assert.equal(gh.searchParams.get('redirect_uri'), `${O}/oauth/github/callback`);
  const state = gh.searchParams.get('state'), login = cookieOf(toGh, '__Host-af_login');
  assert.equal(login, state);
  const back = await c.handle(new Request(`${O}/oauth/github/callback?code=${code}&state=${state}`, { headers: { cookie: `__Host-af_login=${login}` } }));
  assert.equal(back.status, 302); const to = new URL(back.headers.get('location'));
  assert.equal(to.origin + to.pathname, new URL(redirect).origin + new URL(redirect).pathname); assert.equal(to.searchParams.get('state'), 'st-1');
  const tok = await c.handle(new Request(`${O}/oauth/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code: to.searchParams.get('code'), redirect_uri: redirect, client_id, code_verifier: verifier }) }));
  assert.equal(tok.status, 200);
  return { client_id, ...(await tok.json()), code: to.searchParams.get('code'), verifier, redirect };
}
const rpc = (c, token, body) => c.handle(new Request(`${O}/mcp`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }));
const call = async (c, token, name, args) => (await (await rpc(c, token, { jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name, arguments: args } })).json()).result;
async function siteSession(c, code) {
  const go = await c.handle(new Request(`${O}/auth/login?return=/`)), state = new URL(go.headers.get('location')).searchParams.get('state');
  const back = await c.handle(new Request(`${O}/oauth/github/callback?code=${code}&state=${state}`, { headers: { cookie: `__Host-af_login=${state}` } }));
  assert.equal(back.headers.get('location'), '/');
  return cookieOf(back, '__Host-af_session');
}
const site = (c, session, path, body) => c.handle(new Request(`${O}${path}`, { method: body ? 'POST' : 'GET', headers: { cookie: `__Host-af_session=${session}`, 'x-agentflow-request': '1', ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }));

test('CLOUD-1 discovery: 401 points at the resource metadata, which names this server; metadata Claude needs is there', async () => {
  const c = createCloudConnector({ env: env(memoryKv()) });
  const r = await c.handle(new Request(`${O}/mcp`, { method: 'POST', body: '{}' }));
  assert.equal(r.status, 401); assert.equal(r.headers.get('www-authenticate'), `Bearer resource_metadata="${O}/.well-known/oauth-protected-resource", scope="agentflow"`);
  const prm = await (await c.handle(new Request(`${O}/.well-known/oauth-protected-resource`))).json();
  assert.deepEqual([prm.resource, prm.authorization_servers], [`${O}/mcp`, [O]]);
  const asm = await (await c.handle(new Request(`${O}/.well-known/oauth-authorization-server`))).json();
  assert.equal(asm.issuer, O); assert.deepEqual(asm.code_challenge_methods_supported, ['S256']); assert.ok(asm.token_endpoint_auth_methods_supported.includes('none'));
  assert.ok(asm.scopes_supported.includes('offline_access')); assert.equal(asm.registration_endpoint, `${O}/oauth/register`);
  assert.equal(await c.handle(new Request(`${O}/api/studio/status`)), null, 'other paths are not the connector\'s');
  assert.equal((await createCloudConnector({ env: {} }).handle(new Request(`${O}/mcp`))).status, 404, 'off without its bindings');
});

test('CLOUD-2 sign-in with PKCE, tools over /mcp, refresh rotation; codes and refresh tokens work once', async () => {
  const kv = memoryKv(), gh = fakeGitHub({ a1: { id: 101, login: 'leek' } }), c = createCloudConnector({ env: env(kv), fetchImpl: gh.fetch });
  const s = await signIn(c, 'a1');
  assert.equal(s.token_type, 'Bearer'); assert.ok(s.refresh_token);
  const init = await (await rpc(c, s.access_token, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'claude-ai', version: '1' } } })).json();
  assert.equal(init.result.serverInfo.name, 'agentflow');
  assert.equal((await rpc(c, s.access_token, { jsonrpc: '2.0', method: 'notifications/initialized' })).status, 202);
  assert.deepEqual((await (await rpc(c, s.access_token, { jsonrpc: '2.0', id: 2, method: 'tools/list' })).json()).result.tools.map(t => t.name), ['agentflow_handover', 'agentflow_record']);
  assert.ok(CLOUD_TOOLS[0].inputSchema.properties.project && !CLOUD_TOOLS[0].inputSchema.properties.folder);
  // No project yet: the handover says how to link one, a record waits unplaced.
  assert.match((await call(c, s.access_token, 'agentflow_handover', {})).content[0].text, /이어 둔 프로젝트가 없어요/);
  const rec = await call(c, s.access_token, 'agentflow_record', { title: '첫 기록', request: '로그인 붙여 줘. 키 sk-abcdefghijklmnopqrstuvwxyz123456', answer: '붙였어요.' });
  assert.equal(rec.isError, undefined); assert.match(rec.content[0].text, /다음에 잇는 프로젝트로/);
  const kept = [...kv.m].filter(([k]) => k.startsWith('in:101:'));
  assert.equal(kept.length, 1); const stored = JSON.parse(kept[0][1].value);
  assert.match(stored.text, /^\[웹 AI 세션 기록 · 첫 기록\]\n\n── 사용자 요청 ──\n로그인 붙여 줘\. 키 \[가려진 비밀값\]/); assert.equal(stored.project, null);
  assert.ok(![...kv.m.values()].some(v => v.value.includes('sk-abcdefghijklmnopqrstuvwxyz') || v.value.includes(s.access_token) || v.value.includes(s.refresh_token)), 'no key or token kept as written');
  // The code was spent; a wrong verifier fails; refresh rotates.
  const again = await c.handle(new Request(`${O}/oauth/token`, { method: 'POST', body: new URLSearchParams({ grant_type: 'authorization_code', code: s.code, redirect_uri: s.redirect, client_id: s.client_id, code_verifier: s.verifier }) }));
  assert.deepEqual([again.status, (await again.json()).error], [400, 'invalid_grant']);
  const refresh = body => c.handle(new Request(`${O}/oauth/token`, { method: 'POST', body: new URLSearchParams({ grant_type: 'refresh_token', client_id: s.client_id, ...body }) }));
  const r1 = await refresh({ refresh_token: s.refresh_token }); assert.equal(r1.status, 200); const t1 = await r1.json(); assert.notEqual(t1.refresh_token, s.refresh_token);
  assert.equal((await (await refresh({ refresh_token: s.refresh_token })).json()).error, 'invalid_grant', 'a spent refresh token');
  assert.equal((await rpc(c, t1.access_token, { jsonrpc: '2.0', id: 3, method: 'ping' })).status, 200);
});

test('CLOUD-3 registration and authorize refuse what they must: other redirects, no PKCE, a mismatched redirect, a stray login cookie', async () => {
  const c = createCloudConnector({ env: env(memoryKv()), fetchImpl: fakeGitHub({}).fetch });
  const reg = uris => c.handle(new Request(`${O}/oauth/register`, { method: 'POST', body: JSON.stringify({ redirect_uris: uris }) }));
  assert.equal((await reg(['https://evil.example/cb'])).status, 400);
  assert.equal((await reg(['http://localhost:3118/callback'])).status, 201, 'Claude Code loopback');
  const { client_id } = await (await reg(['https://claude.ai/api/mcp/auth_callback'])).json();
  const az = q => c.handle(new Request(`${O}/oauth/authorize?${new URLSearchParams({ response_type: 'code', client_id, redirect_uri: 'https://claude.ai/api/mcp/auth_callback', state: 's', ...q })}`));
  const noPkce = await az({}); assert.equal(noPkce.status, 302); assert.equal(new URL(noPkce.headers.get('location')).searchParams.get('error'), 'invalid_request');
  assert.equal((await az({ redirect_uri: 'https://claude.ai/other', code_challenge: pkce().challenge, code_challenge_method: 'S256' })).status, 400);
  assert.equal((await c.handle(new Request(`${O}/oauth/authorize?client_id=nope`))).status, 400);
  // Loopback: any port matches the registered one.
  const { client_id: cc } = await (await reg(['http://localhost/callback'])).json();
  const loop = await c.handle(new Request(`${O}/oauth/authorize?${new URLSearchParams({ response_type: 'code', client_id: cc, redirect_uri: 'http://localhost:51234/callback', code_challenge: pkce().challenge, code_challenge_method: 'S256' })}`));
  assert.equal(loop.status, 200); assert.match(await loop.text(), /이 컴퓨터에서 도는 프로그램/);
  // A callback without the browser's own login cookie is refused (login CSRF).
  const go = await c.handle(new Request(`${O}/auth/login`)), state = new URL(go.headers.get('location')).searchParams.get('state');
  assert.equal((await c.handle(new Request(`${O}/oauth/github/callback?code=x&state=${state}`))).status, 400);
  // A sign-in from the site goes back only to a path of this site.
  const users = createCloudConnector({ env: env(memoryKv()), fetchImpl: fakeGitHub({ u: { id: 5, login: 'u' } }).fetch });
  const evil = await users.handle(new Request(`${O}/auth/login?return=//evil.example`)), st = new URL(evil.headers.get('location')).searchParams.get('state');
  assert.equal((await users.handle(new Request(`${O}/oauth/github/callback?code=u&state=${st}`, { headers: { cookie: `__Host-af_login=${st}` } }))).headers.get('location'), '/');
});

test('CLOUD-4 the Studio page links a project: its handover reaches the AI, the AI\'s records reach the page once; users stay apart', async () => {
  const kv = memoryKv(), c = createCloudConnector({ env: env(kv), fetchImpl: fakeGitHub({ a1: { id: 101, login: 'leek' }, a2: { id: 101, login: 'leek' }, b1: { id: 202, login: 'other' }, b2: { id: 202, login: 'other' } }).fetch });
  const leek = await signIn(c, 'a1'), other = await signIn(c, 'b1');
  const session = await siteSession(c, 'a2'), otherSession = await siteSession(c, 'b2');
  assert.equal((await (await site(c, session, '/api/connector/me')).json()).login, 'leek');
  assert.equal((await c.handle(new Request(`${O}/api/connector/me`, { headers: { 'x-agentflow-request': '1' } }))).status, 401);
  assert.equal((await c.handle(new Request(`${O}/api/connector/me`, { headers: { cookie: `__Host-af_session=${session}` } }))).status, 403, 'request header required');
  // An unplaced record left before any project is linked goes to the first project that asks for unplaced ones.
  await call(c, leek.access_token, 'agentflow_record', { request: '먼저 남긴 요청', answer: '했어요.' });
  assert.equal((await site(c, session, '/api/connector/handover', { key: 'saved:P1', name: '미용실 예약', text: '# 인수인계: 미용실 예약' })).status, 200);
  assert.match((await call(c, leek.access_token, 'agentflow_handover', {})).content[0].text, /「미용실 예약」의 인수인계[\s\S]*# 인수인계: 미용실 예약/);
  assert.match((await call(c, leek.access_token, 'agentflow_record', { request: '예약 문자 보내 줘', answer: '보냈어요.' })).content[0].text, /「미용실 예약」/);
  // Another user sees none of it.
  assert.match((await call(c, other.access_token, 'agentflow_handover', {})).content[0].text, /이어 둔 프로젝트가 없어요/);
  assert.deepEqual((await (await site(c, otherSession, '/api/connector/records?project=saved:P1&unplaced=1')).json()).records, []);
  const got = (await (await site(c, session, '/api/connector/records?project=saved:P1&unplaced=1')).json()).records;
  assert.deepEqual(got.map(r => r.text.split('\n')[3]), ['먼저 남긴 요청', '예약 문자 보내 줘']);
  assert.equal((await site(c, session, '/api/connector/ack', { ids: got.map(r => r.id) })).status, 200);
  assert.deepEqual((await (await site(c, session, '/api/connector/records?project=saved:P1&unplaced=1')).json()).records, []);
  // Two projects: the AI must say which.
  await site(c, session, '/api/connector/handover', { key: 'saved:P2', name: '결제 서버', text: '# 인수인계: 결제 서버' });
  const many = await call(c, leek.access_token, 'agentflow_record', { request: 'r', answer: 'a' });
  assert.equal(many.isError, true); assert.match(many.content[0].text, /「결제 서버」/);
  assert.match((await call(c, leek.access_token, 'agentflow_record', { project: '결제', request: 'r', answer: 'a' })).content[0].text, /「결제 서버」/);
  assert.match((await call(c, leek.access_token, 'agentflow_handover', { project: '미용실 예약' })).content[0].text, /# 인수인계: 미용실 예약/);
  assert.equal((await c.handle(new Request(`${O}/api/connector/me`, { headers: { cookie: `__Host-af_session=${session}`, 'x-agentflow-request': '1', origin: 'https://evil.example' } }))).status, 403);
});

test('CLOUD-5 a PC key reads its owner\'s records; a new key replaces the old; an allow-list keeps others out', async () => {
  const kv = memoryKv(), c = createCloudConnector({ env: env(kv), fetchImpl: fakeGitHub({ a1: { id: 101, login: 'leek' }, p1: { id: 101, login: 'leek' }, p2: { id: 101, login: 'leek' } }).fetch });
  const leek = await signIn(c, 'a1');
  const pcKey = async code => {
    const go = await c.handle(new Request(`${O}/auth/pc`)), state = new URL(go.headers.get('location')).searchParams.get('state');
    const pageRes = await c.handle(new Request(`${O}/oauth/github/callback?code=${code}&state=${state}`, { headers: { cookie: `__Host-af_login=${state}` } }));
    return /AGENTFLOW_CLOUD_KEY=(afk_[\w-]+)/.exec(await pageRes.text())[1];
  };
  const k1 = await pcKey('p1');
  await call(c, leek.access_token, 'agentflow_record', { request: '웹에서 한 요청', answer: '했어요.' });
  const pc = (key, path = '/api/connector/records?all=1') => c.handle(new Request(`${O}${path}`, { headers: { authorization: `Bearer ${key}`, 'x-agentflow-request': '1' } }));
  assert.equal((await (await pc(k1)).json()).records.length, 1);
  assert.equal((await pc(k1, '/mcp')).status, 405);
  const k2 = await pcKey('p2');
  assert.equal((await pc(k1)).status, 401, 'the old key no longer works');
  assert.equal((await pc(k2)).status, 200);
  assert.equal((await c.handle(new Request(`${O}/mcp`, { method: 'POST', headers: { authorization: `Bearer ${k2}` }, body: '{}' }))).status, 401, 'a PC key is not an MCP token');
  const closed = createCloudConnector({ env: env(memoryKv(), { ALLOWED_GITHUB_LOGINS: 'leek' }), fetchImpl: fakeGitHub({ x: { id: 9, login: 'stranger' } }).fetch });
  const go = await closed.handle(new Request(`${O}/auth/login`)), state = new URL(go.headers.get('location')).searchParams.get('state');
  assert.equal((await closed.handle(new Request(`${O}/oauth/github/callback?code=x&state=${state}`, { headers: { cookie: `__Host-af_login=${state}` } }))).status, 403);
});

test('CLOUD-6 the Worker answers connector paths first and leaves the rest to the Studio API and assets', async () => {
  const w = studioWorker(), kv = memoryKv(), e = { ...env(kv), ASSETS: { fetch: async () => new Response('asset') } };
  assert.equal((await w.fetch(new Request(`${O}/.well-known/oauth-authorization-server`), e)).status, 200);
  assert.equal(await (await w.fetch(new Request(`${O}/index.html`), e)).text(), 'asset');
  assert.equal((await w.fetch(new Request(`${O}/api/studio/status`), e)).status, 200);
});

test('CLOUD-7 a PC Studio with a PC key takes its owner\'s web records into the local mailbox once and sends handovers up', async t => {
  const { mkdtemp, rm } = await import('node:fs/promises'), { tmpdir } = await import('node:os'), { join } = await import('node:path');
  const { openConnector } = await import('../server/connector.mjs'), { cloudPull } = await import('../server/cloud-pull.mjs');
  const dir = await mkdtemp(join(tmpdir(), 'af-pull-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const kv = memoryKv(), c = createCloudConnector({ env: env(kv), fetchImpl: fakeGitHub({ a1: { id: 101, login: 'leek' }, p1: { id: 101, login: 'leek' } }).fetch });
  const leek = await signIn(c, 'a1');
  const go = await c.handle(new Request(`${O}/auth/pc`)), state = new URL(go.headers.get('location')).searchParams.get('state');
  const key = /AGENTFLOW_CLOUD_KEY=(afk_[\w-]+)/.exec(await (await c.handle(new Request(`${O}/oauth/github/callback?code=p1&state=${state}`, { headers: { cookie: `__Host-af_login=${state}` } }))).text())[1];
  await call(c, leek.access_token, 'agentflow_record', { title: '웹 일', request: '웹에서 한 요청', answer: '했어요.' });
  const viaCloud = (url, init) => c.handle(new Request(url, init));
  let pull = null;
  const local = await openConnector({ dir, onPublish: h => pull.push(h) });
  pull = cloudPull({ env: { AGENTFLOW_CLOUD_URL: O, AGENTFLOW_CLOUD_KEY: key }, connector: local, fetchImpl: viaCloud });
  assert.deepEqual(await pull.once(), { added: 1 });
  assert.deepEqual(await pull.once(), { added: 0 }, 'taken and acknowledged: not again');
  const got = local.since(0, { unplaced: true }).records;
  assert.equal(got.length, 1); assert.match(got[0].text, /^\[웹 AI 세션 기록 · 웹 일\]/);
  assert.equal(local.since(0, { projects: ['saved:X'] }).records.length, 0, 'an unplaced record is not any project\'s until asked for');
  await local.publish({ key: 'saved:P9', code: 'ABCDEF', name: 'PC 프로젝트', folders: ['/work/pc'], text: '# 인수인계: PC 프로젝트' });
  await new Promise(r => setTimeout(r, 20));
  assert.match((await call(c, leek.access_token, 'agentflow_handover', {})).content[0].text, /# 인수인계: PC 프로젝트/);
  assert.equal(cloudPull({ env: { AGENTFLOW_CLOUD_URL: 'http://example.com', AGENTFLOW_CLOUD_KEY: key }, connector: local }), null, 'https only');
  assert.equal(cloudPull({ env: { AGENTFLOW_CLOUD_URL: O, AGENTFLOW_CLOUD_KEY: 'nope' }, connector: local }), null);
});

test('CLOUD-8 failed local commits never ACK a cloud record, including retry and overlapping polls', async t => {
  const { mkdtemp, rm, writeFile, readFile } = await import('node:fs/promises'), { tmpdir } = await import('node:os'), { join } = await import('node:path');
  const { openConnector } = await import('../server/connector.mjs'), { cloudPull } = await import('../server/cloud-pull.mjs');
  const root = await mkdtemp(join(tmpdir(), 'af-failed-pull-')); t.after(() => rm(root, { recursive: true, force: true }));
  const blocker = join(root, 'blocked'); await writeFile(blocker, 'synthetic file');
  const dir = join(blocker, 'mailbox'), local = await openConnector({ dir });
  const valid = { id: '1793484000000-abcdefgh', at: '2026-10-01T00:00:00Z', project: null, text: 'durable synthetic record' };
  const rejected = { ...valid, id: '1793484000001-abcdefgh', project: 'bad project' };
  const acked = []; let gets = 0;
  const pull = cloudPull({ env: { AGENTFLOW_CLOUD_URL: O, AGENTFLOW_CLOUD_KEY: `afk_${'k'.repeat(43)}` }, connector: local, log: () => {},
    fetchImpl: async (url, init) => {
      if (url.includes('/ack')) { acked.push(JSON.parse(init.body).ids); return new Response('{}'); }
      gets++; return Response.json({ records: [valid, rejected] });
    } });
  await pull.once(); await pull.once();
  assert.equal(acked.length, 0); assert.equal(local.since(0, { unplaced: true }).records.length, 0);
  await rm(blocker); // Repair the synthetic filesystem failure, then retry the original cloud record.
  const before = gets;
  const outcomes = await Promise.all([pull.once(), pull.once(), pull.once()]);
  assert.deepEqual(outcomes, [{ added: 1 }, { added: 1 }, { added: 1 }]); assert.equal(gets - before, 1);
  assert.deepEqual(acked, [[valid.id]], 'invalid records are never acknowledged');
  const disk = JSON.parse(await readFile(join(dir, 'connector.json'), 'utf8'));
  assert.equal(disk.records.length, 1); assert.deepEqual(disk.cloud, [valid.id]);
  assert.equal((await openConnector({ dir })).since(0, { unplaced: true }).records.length, 1, 'old cloud timestamps remain visible from receipt time');
  assert.deepEqual(await pull.once(), { added: 0 }); assert.deepEqual(acked.at(-1), [valid.id]);
});

test('CLOUD-9 code and refresh races across handlers grant once even when legacy KV keeps stale values', async () => {
  const kv = memoryKv(), e = env(kv), a = createCloudConnector({ env: e }), b = createCloudConnector({ env: e });
  const { verifier, challenge } = pkce(), hash = value => createHash('sha256').update(value).digest('base64url');
  await kv.put('client:synthetic', JSON.stringify({ method: 'none' }));
  await kv.put(`code:${hash('synthetic-code')}`, JSON.stringify({ client_id: 'synthetic', challenge, redirect_uri: 'http://localhost/cb', uid: '101', scope: 'agentflow' }));
  await kv.put(`rt:${hash('synthetic-refresh')}`, JSON.stringify({ client_id: 'synthetic', uid: '101', scope: 'agentflow' }));
  kv.delete = async () => {}; // Model indefinitely stale grant values after deletion; DO remains authoritative.
  for (const grant of [
    { grant_type: 'authorization_code', code: 'synthetic-code', code_verifier: verifier, redirect_uri: 'http://localhost/cb' },
    { grant_type: 'refresh_token', refresh_token: 'synthetic-refresh' }
  ]) {
    const exchange = handler => handler.handle(new Request(`${O}/oauth/token`, { method: 'POST', body: new URLSearchParams({ client_id: 'synthetic', ...grant }) }));
    const responses = await Promise.all(Array.from({ length: 16 }, (_, i) => exchange(i % 2 ? a : b)));
    assert.equal(responses.filter(r => r.status === 200).length, 1);
    assert.equal(responses.filter(r => r.status === 400).length, 15);
    assert.equal((await exchange(createCloudConnector({ env: e }))).status, 400, 'a new handler cannot replay a stale grant');
  }
  const unavailable = createCloudConnector({ env: { ...e, CONNECTOR_OAUTH: undefined } });
  assert.equal((await unavailable.handle(new Request(`${O}/oauth/token`, { method: 'POST', body: '' }))).status, 503);
  const broken = { idFromName: x => x, get: () => ({ fetch: async () => { throw new Error('unavailable'); } }) };
  await assert.rejects(consumeOAuth(broken, 'code', hash('grant')));
});

test('CLOUD-10 project listing scans the bounded mailbox before applying its 100 matching-record limit', async () => {
  const kv = memoryKv(), c = createCloudConnector({ env: env(kv), fetchImpl: fakeGitHub({ site: { id: 101, login: 'a' } }).fetch });
  const session = await siteSession(c, 'site');
  for (let i = 0; i < 500; i++) {
    const id = `${1793484000000 + i}-abcdefgh`;
    await kv.put(`in:101:${id}`, JSON.stringify({ id, project: i < 390 ? 'saved:Other' : 'saved:Wanted', text: `record ${i}` }));
  }
  const rows = (await (await site(c, session, '/api/connector/records?project=saved:Wanted')).json()).records;
  assert.equal(rows.length, 100); assert.equal(rows[0].text, 'record 390'); assert.equal(rows.at(-1).text, 'record 489');
});

test('CLOUD-11 SQLite namespace alone supports sign-in, records and per-user handovers; TTL and cursor survive handlers', async () => {
  const namespace = memoryDurableNamespace(), kv = durableConnectorKv(namespace);
  const e = env(undefined, { CONNECTOR_OAUTH: namespace }), gh = fakeGitHub({ ai: { id: 101, login: 'a' }, site: { id: 101, login: 'a' }, other: { id: 202, login: 'b' } });
  const c = createCloudConnector({ env: e, fetchImpl: gh.fetch });
  const ai = await signIn(c, 'ai'), session = await siteSession(c, 'site'), other = await siteSession(c, 'other');
  await site(c, session, '/api/connector/handover', { key: 'saved:P1', name: 'Project', text: '# preserved handover' });
  await call(c, ai.access_token, 'agentflow_record', { request: 'do work', answer: 'work done' });
  const fresh = createCloudConnector({ env: e, fetchImpl: gh.fetch });
  assert.equal((await (await site(fresh, session, '/api/connector/records?project=saved:P1')).json()).records.length, 1);
  assert.equal((await (await site(fresh, other, '/api/connector/records?project=saved:P1')).json()).records.length, 0);
  assert.match((await call(fresh, ai.access_token, 'agentflow_handover', {})).content[0].text, /preserved handover/);
  for (let i = 0; i < 5; i++) await kv.put(`in:303:${i}`, JSON.stringify({ i }));
  const first = await kv.list({ prefix: 'in:303:', limit: 2 }), second = await kv.list({ prefix: 'in:303:', limit: 2, cursor: first.cursor });
  assert.equal(first.list_complete, false); assert.deepEqual(second.keys.map(k => k.name), ['in:303:2', 'in:303:3']);
  const expired = namespace.get('data:in:303:');
  await expired.storage.put('i:in:303:0', { expiresAt: Date.now() - 1 });
  assert.equal(await kv.get('in:303:0', 'json'), null);
  await expired.storage.put('i:in:303:1', { expiresAt: Date.now() - 1 });
  await expired.object.alarm(); assert.equal(await kv.get('in:303:1'), null); assert.deepEqual(await kv.get('in:303:2', 'json'), { i: 2 });
  await kv.delete('in:303:2'); assert.equal(await kv.get('in:303:2'), null);
});

test('CLOUD-12 migrations are repeatable and storage compatibility never silently abandons existing data', () => {
  assert.deepEqual(oauthMigration().steps, [{ new_sqlite_classes: ['OAuthConsume'] }]);
  assert.deepEqual(oauthMigration(OAUTH_CONSUME_MIGRATION).steps, []);
  assert.throws(() => oauthMigration('another-migration'));
  assert.doesNotThrow(() => assertConnectorStorage('durable', []));
  assert.throws(() => assertConnectorStorage('durable', [{ name: 'CONNECTOR_KV' }]));
  assert.doesNotThrow(() => assertConnectorStorage('kv', [{ name: 'CONNECTOR_KV' }]));
  assert.throws(() => assertConnectorStorage('kv', [{ name: 'CONNECTOR_OAUTH' }]));
});

test('CLOUD-13 full allowed MCP fields survive cloud, PC persistence and browser project save/load without clipping', async t => {
  const { mkdtemp, rm } = await import('node:fs/promises'), { tmpdir } = await import('node:os'), { join } = await import('node:path');
  const { openConnector } = await import('../server/connector.mjs'), { cloudPull } = await import('../server/cloud-pull.mjs');
  const D = await import('../dist/public/shared/domain.js'), { parseProject } = await import('../dist/public/shared/validation.js');
  const { serializeProject } = await import('../dist/public/shared/storage.js'), { CONNECTOR_TEXT_LIMIT } = await import('../dist/public/shared/connector-limits.js');
  const namespace = memoryDurableNamespace(), kv = durableConnectorKv(namespace), c = createCloudConnector({ env: env(undefined, { CONNECTOR_OAUTH: namespace }), fetchImpl: fakeGitHub({ ai: { id: 101, login: 'a' } }).fetch });
  const ai = await signIn(c, 'ai');
  const args = { title: '제'.repeat(120), request: '가'.repeat(20000), answer: '나'.repeat(40000), files: Array.from({ length: 60 }, (_, i) => `src/${i}/${'다'.repeat(1010)}.ts`.padEnd(1024, '라')) };
  assert.ok(args.files.every(f => f.length === 1024));
  const result = await call(c, ai.access_token, 'agentflow_record', args); assert.equal(result.isError, undefined);
  const key = `afk_${'p'.repeat(43)}`, hash = createHash('sha256').update(key).digest('base64url');
  await kv.put(`pck:${hash}`, JSON.stringify({ uid: '101', login: 'a', pc: true }));
  const dir = await mkdtemp(join(tmpdir(), 'af-max-record-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const local = await openConnector({ dir }), pull = cloudPull({ env: { AGENTFLOW_CLOUD_URL: O, AGENTFLOW_CLOUD_KEY: key }, connector: local, fetchImpl: (url, init) => c.handle(new Request(url, init)) });
  assert.deepEqual(await pull.once(), { added: 1 });
  const [kept] = (await openConnector({ dir })).since(0, { unplaced: true }).records;
  assert.ok(kept.text.length > 120000 && kept.text.length <= CONNECTOR_TEXT_LIMIT);
  assert.ok(kept.text.includes(args.request) && kept.text.includes(args.answer) && args.files.every(f => kept.text.includes(f)));
  const p = D.pasteRecord(D.createProject(), kept.text, null).project;
  assert.equal(parseProject(serializeProject(p)).pasted[0].text, kept.text);
  assert.deepEqual(await pull.once(), { added: 0 }, 'ACK follows the complete durable record');
  const expanded = await call(c, ai.access_token, 'agentflow_record', { ...args, request: 'pwd=Super7\n'.repeat(1818).trim(), answer: 'pwd=Super7\n'.repeat(3636).trim() });
  assert.equal(expanded.isError, true, 'mask expansion beyond the shared cap refuses before reporting success');
  assert.equal((await kv.list({ prefix: 'in:101:' })).keys.length, 0);
  assert.throws(() => D.pasteRecord(D.createProject(), 'x'.repeat(CONNECTOR_TEXT_LIMIT + 1), null));
});

test('CLOUD-14 concurrent SQLite mailbox admission cannot exceed500 and legacy overflow remains retrievable', async () => {
  const namespace = memoryDurableNamespace(), kv = durableConnectorKv(namespace), e = env(undefined, { CONNECTOR_OAUTH: namespace });
  const a = createCloudConnector({ env: e, now: () => 1793484001000, fetchImpl: fakeGitHub({ ai: { id: 101, login: 'a' } }).fetch });
  const ai = await signIn(a, 'ai'), b = createCloudConnector({ env: e, now: () => 1793484002000 });
  for (let i = 0; i < 499; i++) await kv.put(`in:101:${1793484000000 + i}-abcdefgh`, JSON.stringify({ project: 'saved:Other', text: 'prior' }));
  const results = await Promise.all(Array.from({ length: 16 }, (_, i) => call(i % 2 ? a : b, ai.access_token, 'agentflow_record', { request: 'r', answer: 'a' })));
  assert.equal(results.filter(r => !r.isError).length, 1); assert.equal((await kv.list({ prefix: 'in:101:' })).keys.length, 500);
  const legacy = memoryKv(), c = createCloudConnector({ env: env(legacy), fetchImpl: fakeGitHub({ site: { id: 101, login: 'a' } }).fetch }), session = await siteSession(c, 'site');
  for (let i = 0; i < 501; i++) await legacy.put(`in:101:${1793484000000 + i}-abcdefgh`, JSON.stringify({ project: i === 500 ? 'saved:Wanted' : 'saved:Other', text: `record ${i}` }));
  for (let i = 0; i < 2; i++) assert.deepEqual((await (await site(c, session, '/api/connector/records?project=saved:Wanted')).json()).records.map(r => r.text), ['record 500']);
});

test('CLOUD-15 consent CSP permits only the validated callback origin across the GitHub redirect chain', async () => {
  const redirects = ['https://claude.ai/api/mcp/auth_callback', 'https://claude.com/api/mcp/auth_callback', 'http://localhost:51234/callback', 'http://127.0.0.1:29876/callback', 'https://approved.example/callback'];
  const c = createCloudConnector({ env: env(memoryKv(), { CONNECTOR_REDIRECTS: redirects.at(-1) }) });
  const reg = await c.handle(new Request(`${O}/oauth/register`, { method: 'POST', body: JSON.stringify({ redirect_uris: redirects }) }));
  const { client_id } = await reg.json(), { challenge } = pkce();
  const authorize = (redirect_uri, extra = {}) => c.handle(new Request(`${O}/oauth/authorize?${new URLSearchParams({ response_type: 'code', client_id, redirect_uri, code_challenge: challenge, code_challenge_method: 'S256', ...extra })}`));
  const actions = response => response.headers.get('content-security-policy').split(';').map(s => s.trim()).find(s => s.startsWith('form-action ')).split(/\s+/).slice(1);
  for (const redirect of redirects) {
    const consent = await authorize(redirect); assert.equal(consent.status, 200);
    assert.deepEqual(actions(consent), ["'self'", 'https://github.com', new URL(redirect).origin]);
    assert.ok(!actions(consent).some(a => a.includes('*')), 'no wildcard or unrelated client origin');
    assert.match(consent.headers.get('content-security-policy'), /default-src 'none'; style-src 'unsafe-inline';/);
    assert.match(consent.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  }
  const badRedirect = await authorize('https://evil.example/callback'); assert.equal(badRedirect.status, 400);
  assert.deepEqual(actions(badRedirect), ["'self'", 'https://github.com'], 'unregistered callback never enters the policy');
  const unknown = await authorize(redirects[0], { client_id: 'unknown' }); assert.equal(unknown.status, 400);
  assert.deepEqual(actions(unknown), ["'self'", 'https://github.com']);
  assert.equal((await authorize(redirects[0], { code_challenge: '', code_challenge_method: 'plain' })).status, 302, 'PKCE still refuses before consent');
});
