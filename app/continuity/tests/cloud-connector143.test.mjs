// Web AI connector (server/cloud-connector.mjs) as Claude's connector client and a browser meet it: discovery, registration, consent,
// GitHub sign-in (a fake GitHub), the token exchange with PKCE and refresh rotation, /mcp tools, the Studio page's API, PC keys,
// and one user never seeing another's. An in-memory KV; nothing leaves the process.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createCloudConnector, CLOUD_TOOLS } from '../server/cloud-connector.mjs';
import { studioWorker } from '../server/worker.mjs';

const O = 'https://studio.example.dev';
function memoryKv() {
  const m = new Map();
  return { m,
    async get(k, type) { const v = m.get(k); if (!v || (v.exp && v.exp < Date.now())) return null; return type === 'json' ? JSON.parse(v.value) : v.value; },
    async put(k, value, o) { m.set(k, { value, exp: o?.expirationTtl ? Date.now() + o.expirationTtl * 1000 : 0 }); },
    async delete(k) { m.delete(k); },
    async list({ prefix = '', limit = 1000 } = {}) { const keys = [...m.keys()].filter(k => k.startsWith(prefix)).sort().slice(0, limit).map(name => ({ name })); return { keys, list_complete: true }; } };
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
const env = (kv, extra = {}) => ({ CONNECTOR_KV: kv, GITHUB_CLIENT_ID: 'gh-id', GITHUB_CLIENT_SECRET: 'gh-secret', ...extra });
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
