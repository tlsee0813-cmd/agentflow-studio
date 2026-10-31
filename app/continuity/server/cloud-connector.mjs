// AgentFlow web AI connector (Cloudflare Worker, no node: imports): a remote MCP server that claude.ai (web, desktop, mobile) and
// Claude Code add by URL, signed in with the person's GitHub account. Anyone with a GitHub account can sign in; everything kept is
// kept per GitHub user id and never shown to another.
//
//   OAuth 2.1 authorization server for the MCP client (what Claude's connector client expects): protected resource metadata, server
//   metadata, dynamic client registration, authorize (PKCE S256, a consent page, then GitHub sign-in), token (code and rotating
//   refresh tokens). GitHub only says who the person is; its token is used once and never kept.
//   /mcp (Streamable HTTP, JSON answers): agentflow_handover, agentflow_record.
//   /api/connector/*: the Studio page of the same site (a sign-in cookie) or a PC's Studio (a PC key) takes the records web AI
//   sessions left and leaves its projects' handover documents.
//
// Kept in the CONNECTOR_KV namespace, all per user and all with credential-like parts hidden first: records not yet taken (30 days),
// one latest handover document per project the person linked, and hashes of the sign-in tokens (never a token itself).
// Settings: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET (secret), optional ALLOWED_GITHUB_LOGINS (comma list; empty lets everyone in),
// optional CONNECTOR_REDIRECTS (more allowed OAuth redirect URIs, comma list).
import { readRecordInput, recordText, str, projectKeyOk, CONNECTOR_LIMITS } from './connector-record.mjs';
import { redactSecrets } from '../dist/public/shared/secret.js';
import { createMcpHandler, connectorTools } from '../connector/mcp-core.mjs';

export const CLOUD_PATHS = ['/mcp', '/.well-known/*', '/oauth/*', '/auth/*', '/api/connector/*'];
const TTL = { pending: 600, code: 300, access: 3600, refresh: 30 * 86400, client: 180 * 86400, session: 30 * 86400, record: 30 * 86400, handover: 30 * 86400 };
const LIMITS = { inbox: 500, handovers: 40, page: 100 };
const CLAUDE_REDIRECTS = ['https://claude.ai/api/mcp/auth_callback', 'https://claude.com/api/mcp/auth_callback'];
const SCOPES = ['agentflow', 'offline_access'];
const INSTRUCTIONS = 'AgentFlow Studio는 개발 기록을 프로젝트 지도로 보여 주는 도구예요. 새로 일을 시작할 때 agentflow_handover로 지금까지의 인수인계를 받고, 사용자의 요청 하나를 끝내면 agentflow_record로 요청 원문과 한 일을 남기세요.';
export const CLOUD_TOOLS = connectorTools('project');

const enc = new TextEncoder();
const b64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const random = (n = 32) => b64url(crypto.getRandomValues(new Uint8Array(n)));
const sha = async text => b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(text))));
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const NO_STORE = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const json = (status, value, headers = {}) => new Response(status === 204 ? null : JSON.stringify(value), { status, headers: { ...NO_STORE, 'Content-Type': 'application/json; charset=utf-8', ...headers } });
const oauthError = (status, error, description) => json(status, { error, ...(description ? { error_description: description } : {}) });
function page(status, title, body, headers = {}) {
  const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>body{font:16px/1.6 system-ui,sans-serif;margin:0;background:#f6f7f9;color:#1d2330}main{max-width:480px;margin:12vh auto;padding:28px;background:#fff;border-radius:14px;box-shadow:0 1px 3px #0002}h1{font-size:20px;margin:0 0 12px}code,pre{background:#eef1f5;border-radius:6px;padding:2px 6px;word-break:break-all}pre{padding:12px;white-space:pre-wrap}button{font:inherit;padding:10px 16px;border:0;border-radius:8px;background:#2554c7;color:#fff;cursor:pointer}.fine{color:#5b6475;font-size:14px}
@media (prefers-color-scheme:dark){body{background:#14171c;color:#e6e9ef}main{background:#1d2128}code,pre{background:#2a2f38}.fine{color:#9aa3b2}}</style>
<main><h1>${esc(title)}</h1>${body}</main></html>`;
  return new Response(html, { status, headers: { ...NO_STORE, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https://github.com; frame-ancestors 'none'", ...headers } });
}
const cookie = (name, value, maxAge) => `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
const readCookie = (request, name) => (request.headers.get('cookie') ?? '').split(/;\s*/).map(p => p.split('=')).find(([k]) => k === name)?.[1] ?? null;
const LOGIN_COOKIE = '__Host-af_login', SESSION_COOKIE = '__Host-af_session';

/** A redirect URI a client may register: Claude's hosted callback, a loopback (Claude Code, any port), or one the operator added. */
function redirectAllowed(uri, extra) {
  let u; try { u = new URL(uri); } catch { return false; }
  if (u.hash || u.username || u.password) return false;
  if (CLAUDE_REDIRECTS.includes(uri) || extra.includes(uri)) return true;
  return u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1');
}
/** A redirect URI asked for matches one registered: exactly, or a loopback one with its port left out of the match (RFC 8252). */
function redirectMatches(asked, registered) {
  if (registered.includes(asked)) return true;
  let a; try { a = new URL(asked); } catch { return false; }
  if (a.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(a.hostname)) return false;
  return registered.some(r => { try { const b = new URL(r); return b.protocol === 'http:' && b.hostname === a.hostname && b.pathname === a.pathname && b.search === a.search; } catch { return false; } });
}

export function createCloudConnector({ env = {}, fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
  const kv = env.CONNECTOR_KV;
  const configured = !!(kv && env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
  const allowed = String(env.ALLOWED_GITHUB_LOGINS ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const extraRedirects = String(env.CONNECTOR_REDIRECTS ?? '').split(',').map(s => s.trim()).filter(Boolean);
  let lastId = 0; // record ids keep the order records were left in, even within one millisecond
  const get = key => kv.get(key, 'json');
  const put = (key, value, ttl) => kv.put(key, JSON.stringify(value), ttl ? { expirationTtl: ttl } : undefined);
  const del = key => kv.delete(key);
  async function keys(prefix, limit) { const out = []; let cursor; do { const r = await kv.list({ prefix, cursor, limit: Math.min(1000, limit - out.length) }); out.push(...r.keys.map(k => k.name)); cursor = r.list_complete ? null : r.cursor; } while (cursor && out.length < limit); return out; }

  /* ---------- who is asking ---------- */
  /** The user a bearer token names: an MCP access token, or a PC key (afk_…). */
  async function bearerUser(request, { pc = false } = {}) {
    const m = /^Bearer ([\w.~+/-]{20,200}=*)$/.exec(request.headers.get('authorization') ?? ''); if (!m) return null;
    const token = m[1];
    if (token.startsWith('afk_')) return pc ? await get(`pck:${await sha(token)}`) : null;
    const at = await get(`at:${await sha(token)}`);
    return at && at.exp > now() ? at : null;
  }
  async function sessionUser(request) { const s = readCookie(request, SESSION_COOKIE); return s ? await get(`sess:${await sha(s)}`) : null; }

  /* ---------- metadata ---------- */
  const resourceMeta = origin => ({ resource: `${origin}/mcp`, authorization_servers: [origin], bearer_methods_supported: ['header'], scopes_supported: SCOPES, resource_name: 'AgentFlow Studio' });
  const serverMeta = origin => ({ issuer: origin, authorization_endpoint: `${origin}/oauth/authorize`, token_endpoint: `${origin}/oauth/token`, registration_endpoint: `${origin}/oauth/register`,
    response_types_supported: ['code'], grant_types_supported: ['authorization_code', 'refresh_token'], code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'], scopes_supported: SCOPES, service_documentation: `${origin}/` });
  const unauthorized = origin => json(401, { error: 'invalid_token', error_description: 'Sign in to AgentFlow first.' }, { 'WWW-Authenticate': `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource", scope="agentflow"` });

  /* ---------- OAuth: registration, consent, GitHub, token ---------- */
  async function register(request) {
    let v; try { v = await request.json(); } catch { return oauthError(400, 'invalid_client_metadata', 'JSON body required'); }
    const uris = v?.redirect_uris;
    if (!Array.isArray(uris) || !uris.length || uris.length > 5 || !uris.every(u => typeof u === 'string' && u.length <= 500 && redirectAllowed(u, extraRedirects))) return oauthError(400, 'invalid_redirect_uri', 'Only Claude callbacks and loopback addresses are accepted.');
    const method = v.token_endpoint_auth_method ?? 'none';
    if (!['none', 'client_secret_post', 'client_secret_basic'].includes(method)) return oauthError(400, 'invalid_client_metadata', 'Unsupported token_endpoint_auth_method');
    const id = `afc_${random(18)}`, secret = method === 'none' ? null : `afs_${random(32)}`, name = typeof v.client_name === 'string' ? v.client_name.replace(/[\u0000-\u001f]/g, '').slice(0, 100) : null;
    await put(`client:${id}`, { redirect_uris: uris, method, name, secret: secret ? await sha(secret) : null }, TTL.client);
    return json(201, { client_id: id, client_id_issued_at: Math.floor(now() / 1000), redirect_uris: uris, token_endpoint_auth_method: method, grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], ...(name ? { client_name: name } : {}), ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}) });
  }
  /** Starts a GitHub sign-in for one purpose (kind), bound to this browser by a cookie; GitHub comes back to /oauth/github/callback. */
  async function toGitHub(origin, pending) {
    const nonce = random(24);
    await put(`pend:${nonce}`, pending, TTL.pending);
    const q = new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, redirect_uri: `${origin}/oauth/github/callback`, state: nonce, allow_signup: 'true' });
    return new Response(null, { status: 302, headers: { ...NO_STORE, Location: `https://github.com/login/oauth/authorize?${q}`, 'Set-Cookie': cookie(LOGIN_COOKIE, nonce, TTL.pending) } });
  }
  async function authorize(request, origin) {
    const p = new URL(request.url).searchParams, client = p.get('client_id') ? await get(`client:${p.get('client_id')}`) : null;
    if (!client) return page(400, '연결할 수 없어요', '<p>등록되지 않은 앱이 연결을 요청했어요. Claude에서 커넥터를 다시 추가해 주세요.</p>');
    const redirect = p.get('redirect_uri') ?? (client.redirect_uris.length === 1 ? client.redirect_uris[0] : null);
    if (!redirect || !redirectMatches(redirect, client.redirect_uris)) return page(400, '연결할 수 없어요', '<p>돌아갈 주소가 등록된 것과 달라요.</p>');
    const back = (error, description) => { const u = new URL(redirect); u.searchParams.set('error', error); if (description) u.searchParams.set('error_description', description); if (p.get('state')) u.searchParams.set('state', p.get('state')); return new Response(null, { status: 302, headers: { ...NO_STORE, Location: u.href } }); };
    if (p.get('response_type') !== 'code') return back('unsupported_response_type');
    const challenge = p.get('code_challenge');
    if (!challenge || p.get('code_challenge_method') !== 'S256' || !/^[\w-]{43,128}$/.test(challenge)) return back('invalid_request', 'PKCE S256 required');
    const resource = p.get('resource'); if (resource && resource !== `${origin}/mcp`) return back('invalid_target');
    const ask = { kind: 'mcp', client_id: p.get('client_id'), redirect_uri: redirect, challenge, state: p.get('state') ?? null, scope: p.get('scope') ?? 'agentflow' };
    // Consent first (the MCP authorization spec asks the server to show where the sign-in goes back to), then GitHub.
    const nonce = random(24); await put(`ask:${nonce}`, ask, TTL.pending);
    const host = new URL(redirect).host, local = /^(localhost|127\.0\.0\.1)(:|$)/.test(host);
    return page(200, 'AgentFlow에 연결할까요?', `<p><strong>${esc(client.name ?? '이름 없는 앱')}</strong>이(가) 내 AgentFlow 기록을 남기고 인수인계를 읽으려고 해요.</p>
<p class="fine">허용하면 <code>${esc(host)}</code>(으)로 돌아가요.${local ? ' 이 컴퓨터에서 도는 프로그램(Claude Code 등)이에요. 직접 시작한 연결이 아니면 허용하지 마세요.' : ''}</p>
<form method="post" action="/oauth/consent"><input type="hidden" name="ask" value="${nonce}"><button type="submit">GitHub로 로그인하고 허용</button></form>
<p class="fine">AgentFlow는 GitHub에서 계정 이름과 번호만 받아요. 저장소나 코드에는 접근하지 않아요.</p>`);
  }
  async function consent(request, origin) {
    const form = new URLSearchParams(await request.text()), nonce = form.get('ask') ?? '';
    const ask = /^[\w-]{20,64}$/.test(nonce) ? await get(`ask:${nonce}`) : null;
    if (!ask) return page(400, '연결 시간이 지났어요', '<p>Claude에서 연결을 다시 시작해 주세요.</p>');
    await del(`ask:${nonce}`);
    return toGitHub(origin, ask);
  }
  async function githubUser(code, origin) {
    const tokenRes = await fetchImpl('https://github.com/login/oauth/access_token', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: `${origin}/oauth/github/callback` }) });
    const t = await tokenRes.json().catch(() => null);
    if (!tokenRes.ok || typeof t?.access_token !== 'string') return null;
    const userRes = await fetchImpl('https://api.github.com/user', { headers: { Authorization: `Bearer ${t.access_token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'agentflow-connector' } });
    const u = await userRes.json().catch(() => null);
    return userRes.ok && Number.isSafeInteger(u?.id) && typeof u?.login === 'string' ? { uid: String(u.id), login: u.login } : null;
  }
  async function callback(request, origin) {
    const p = new URL(request.url).searchParams, nonce = p.get('state') ?? '';
    const clear = { 'Set-Cookie': cookie(LOGIN_COOKIE, '', 0) };
    if (!/^[\w-]{20,64}$/.test(nonce) || readCookie(request, LOGIN_COOKIE) !== nonce) return page(400, '로그인을 마치지 못했어요', '<p>로그인을 시작한 브라우저에서 다시 시도해 주세요.</p>', clear);
    const pending = await get(`pend:${nonce}`); await del(`pend:${nonce}`);
    if (!pending) return page(400, '로그인 시간이 지났어요', '<p>처음부터 다시 시도해 주세요.</p>', clear);
    if (p.get('error') || !p.get('code')) return page(400, '로그인하지 않았어요', '<p>GitHub 로그인을 취소했어요.</p>', clear);
    const user = await githubUser(p.get('code'), origin);
    if (!user) return page(502, '로그인을 마치지 못했어요', '<p>GitHub에서 계정을 확인하지 못했어요. 잠시 뒤 다시 시도해 주세요.</p>', clear);
    if (allowed.length && !allowed.includes(user.login.toLowerCase())) return page(403, '아직 열리지 않았어요', `<p><code>${esc(user.login)}</code> 계정은 아직 이 AgentFlow를 쓸 수 없어요.</p>`, clear);
    if (pending.kind === 'mcp') {
      const code = random(32);
      await put(`code:${await sha(code)}`, { ...pending, uid: user.uid, login: user.login }, TTL.code);
      const u = new URL(pending.redirect_uri); u.searchParams.set('code', code); if (pending.state) u.searchParams.set('state', pending.state); u.searchParams.set('iss', origin);
      return new Response(null, { status: 302, headers: { ...NO_STORE, Location: u.href, ...clear } });
    }
    if (pending.kind === 'site') {
      const s = random(32); await put(`sess:${await sha(s)}`, { uid: user.uid, login: user.login }, TTL.session);
      const h = new Headers({ ...NO_STORE, Location: pending.ret }); h.append('Set-Cookie', clear['Set-Cookie']); h.append('Set-Cookie', cookie(SESSION_COOKIE, s, TTL.session));
      return new Response(null, { status: 302, headers: h });
    }
    // A PC key for this person's own Studio: a new one replaces the one before.
    const key = `afk_${random(32)}`, hash = await sha(key), was = await get(`pckcur:${user.uid}`);
    if (was?.hash) await del(`pck:${was.hash}`);
    await put(`pck:${hash}`, { uid: user.uid, login: user.login, pc: true }); await put(`pckcur:${user.uid}`, { hash });
    return page(200, 'PC 연결 키를 만들었어요', `<p>PC Studio의 <code>app/.env</code>에 아래 두 줄을 넣고 Studio를 다시 켜면, 웹 AI가 남긴 기록이 PC의 프로젝트로도 들어와요.</p>
<pre>AGENTFLOW_CLOUD_URL=${esc(origin)}\nAGENTFLOW_CLOUD_KEY=${esc(key)}</pre><p class="fine">이 키는 지금 한 번만 보여요. 새로 만들면 이전 키는 더 쓸 수 없어요. 다른 사람에게 보이지 마세요.</p>`, clear);
  }
  async function token(request, origin) {
    const form = new URLSearchParams(await request.text());
    let clientId = form.get('client_id'), secret = form.get('client_secret');
    const basic = /^Basic (.+)$/.exec(request.headers.get('authorization') ?? '');
    if (basic) { try { const [a, b] = atob(basic[1]).split(':'); clientId = decodeURIComponent(a); secret = decodeURIComponent(b ?? ''); } catch { return oauthError(401, 'invalid_client'); } }
    const client = clientId ? await get(`client:${clientId}`) : null;
    if (!client) return oauthError(401, 'invalid_client');
    if (client.secret && (!secret || (await sha(secret)) !== client.secret)) return oauthError(401, 'invalid_client');
    let grant;
    if (form.get('grant_type') === 'authorization_code') {
      const code = form.get('code') ?? '', key = `code:${await sha(code)}`, c = code ? await get(key) : null;
      if (c) await del(key); // once only
      if (!c || c.client_id !== clientId) return oauthError(400, 'invalid_grant');
      if ((form.get('redirect_uri') ?? c.redirect_uri) !== c.redirect_uri) return oauthError(400, 'invalid_grant', 'redirect_uri mismatch');
      const verifier = form.get('code_verifier') ?? '';
      if (!/^[\w.~-]{43,128}$/.test(verifier) || (await sha(verifier)) !== c.challenge) return oauthError(400, 'invalid_grant', 'PKCE verification failed');
      grant = { uid: c.uid, login: c.login, client_id: clientId, scope: c.scope };
    } else if (form.get('grant_type') === 'refresh_token') {
      const rt = form.get('refresh_token') ?? '', key = `rt:${await sha(rt)}`, r = rt ? await get(key) : null;
      if (!r || r.client_id !== clientId) return oauthError(400, 'invalid_grant');
      await del(key); // rotated: the old one is spent
      grant = r;
    } else return oauthError(400, 'unsupported_grant_type');
    const access = random(32), refresh = random(32);
    await put(`at:${await sha(access)}`, { ...grant, exp: now() + TTL.access * 1000 }, TTL.access);
    await put(`rt:${await sha(refresh)}`, grant, TTL.refresh);
    return json(200, { access_token: access, token_type: 'Bearer', expires_in: TTL.access, refresh_token: refresh, scope: grant.scope });
  }

  /* ---------- what is kept per user ---------- */
  async function handovers(uid) {
    const list = [];
    for (const k of await keys(`ho:${uid}:`, LIMITS.handovers)) { const h = await get(k); if (h) list.push(h); }
    return list.sort((a, b) => b.at.localeCompare(a.at));
  }
  /** The project a session means: by name or key, or the only one there is. none: there is none; many: it must say which. */
  function pick(list, asked) {
    if (typeof asked === 'string' && asked.trim()) {
      const a = asked.trim().toLowerCase(), hit = list.find(h => h.key === asked.trim()) ?? list.find(h => h.name.toLowerCase() === a) ?? list.filter(h => h.name.toLowerCase().includes(a)).at(0);
      return hit ? { hit } : { missing: true };
    }
    return list.length === 1 ? { hit: list[0] } : list.length ? { many: true } : { none: true };
  }
  const names = list => list.map(h => `「${h.name}」`).join(', ');
  async function toolHandover(user, args, origin) {
    const list = await handovers(user.uid), got = pick(list, args.project);
    if (got.none) return `아직 AgentFlow에 이어 둔 프로젝트가 없어요. ${origin} 에서 같은 GitHub 계정으로 로그인하고, 프로젝트의 인수인계 창에서 "웹 AI 커넥터로 잇기"를 누르면 생겨요.`;
    if (got.missing) throw new Error(`그 이름의 프로젝트가 없어요. 이어 둔 프로젝트: ${names(list)}`);
    if (got.many) return `이어 둔 프로젝트가 여러 개예요: ${names(list)}. 어느 프로젝트인지 project에 이름을 넣어 다시 불러 주세요.`;
    return `(AgentFlow가 ${got.hit.at}에 남긴 「${got.hit.name}」의 인수인계예요. Studio에서 그 프로젝트가 열려 있는 동안 갱신돼요.)\n\n${got.hit.text}`;
  }
  async function toolRecord(user, args) {
    const list = await handovers(user.uid), got = pick(list, args.project);
    if (got.missing) throw new Error(`그 이름의 프로젝트가 없어요. 이어 둔 프로젝트: ${names(list)}`);
    if (got.many) throw new Error(`이어 둔 프로젝트가 여러 개예요: ${names(list)}. project에 이름을 넣어 다시 불러 주세요.`);
    const { project: _, folder: __, ...rest } = args ?? {};
    let r; try { r = readRecordInput({ ...rest, client: 'web', project: got.hit?.key ?? null }, { unplaced: true }); }
    catch (e) { throw new Error(e?.code === 'INPUT_TOO_LARGE' ? '기록이 너무 길어요. 답변을 줄여서 다시 남기세요.' : '기록을 받지 않았어요(빈 요청이나 답변, 잘못된 RQ_ id).'); }
    if ((await keys(`in:${user.uid}:`, LIMITS.inbox)).length >= LIMITS.inbox) throw new Error('아직 가져가지 않은 기록이 너무 많아요. AgentFlow Studio에서 프로젝트를 열어 기록을 가져간 뒤 다시 남기세요.');
    const made = redactSecrets(recordText({ ...r, folder: null, branch: null, at: null }));
    lastId = Math.max(now(), lastId + 1);
    const at = new Date(now()).toISOString(), id = `${String(lastId).padStart(13, '0')}-${random(6)}`;
    await put(`in:${user.uid}:${id}`, { id, at, project: got.hit?.key ?? null, title: r.title, text: made.text }, TTL.record);
    return `AgentFlow에 기록을 남겼어요${got.hit ? ` (「${got.hit.name}」)` : ' (아직 이어 둔 프로젝트가 없어서, 다음에 잇는 프로젝트로 들어가요)'}${made.count ? `. 비밀값처럼 보이는 곳 ${made.count}개는 가렸어요` : ''}. Studio에서 그 프로젝트를 열면 들어가요.`;
  }
  async function mcp(request, origin) {
    if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' }, { Allow: 'POST' });
    const user = await bearerUser(request); if (!user) return unauthorized(origin);
    let body; try { body = await request.json(); } catch { return json(400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); }
    const handle = createMcpHandler({ tools: CLOUD_TOOLS, instructions: INSTRUCTIONS, run: (name, args) => (name === 'agentflow_handover' ? toolHandover(user, args, origin) : toolRecord(user, args)) });
    const out = Array.isArray(body) ? (await Promise.all(body.map(handle))).filter(Boolean) : await handle(body);
    if (!out || (Array.isArray(out) && !out.length)) return new Response(null, { status: 202, headers: NO_STORE });
    return json(200, out);
  }

  /* ---------- the Studio page (sign-in cookie) or a PC's Studio (PC key) ---------- */
  async function api(request, origin, path) {
    const o = request.headers.get('origin');
    if ((o && o !== origin) || request.headers.get('x-agentflow-request') !== '1') return json(403, { error: { code: 'FORBIDDEN_ORIGIN' } });
    const user = (await bearerUser(request, { pc: true })) ?? (await sessionUser(request));
    if (path === '/api/connector/me') return user ? json(200, { login: user.login, mcp: `${origin}/mcp`, pc: `${origin}/auth/pc` }) : json(401, { error: { code: 'LOGIN_REQUIRED' }, login: `${origin}/auth/login` });
    if (!user) return json(401, { error: { code: 'LOGIN_REQUIRED' } });
    if (path === '/api/connector/records' && request.method === 'GET') {
      const q = new URL(request.url).searchParams, project = q.get('project'), unplaced = q.get('unplaced') === '1', all = q.get('all') === '1' && user.pc;
      if (project !== null && !projectKeyOk(project)) return json(400, { error: { code: 'INVALID_INPUT' } });
      const out = [];
      for (const k of await keys(`in:${user.uid}:`, LIMITS.page)) {
        const r = await get(k); if (!r) continue;
        if (all || (project && r.project === project) || (unplaced && !r.project)) out.push(r);
      }
      return json(200, { records: out });
    }
    if (request.method !== 'POST' || request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return json(405, { error: { code: 'METHOD_NOT_ALLOWED' } });
    let v; try { v = await request.json(); } catch { return json(400, { error: { code: 'INVALID_INPUT' } }); }
    if (path === '/api/connector/ack') {
      const ids = Array.isArray(v?.ids) && v.ids.length <= LIMITS.page && v.ids.every(i => typeof i === 'string' && /^\d{13}-[\w-]{8}$/.test(i)) ? v.ids : null;
      if (!ids) return json(400, { error: { code: 'INVALID_INPUT' } });
      for (const id of ids) await del(`in:${user.uid}:${id}`);
      return json(200, { removed: ids.length });
    }
    if (path === '/api/connector/handover') {
      if (!projectKeyOk(v?.key)) return json(400, { error: { code: 'INVALID_INPUT' } });
      let name, text; try { name = str(v.name, 200, { line: true }); text = redactSecrets(str(v.text, CONNECTOR_LIMITS.handoverChars)).text; } catch (e) { return json(e?.status ?? 400, { error: { code: e?.code ?? 'INVALID_INPUT' } }); }
      const k = `ho:${user.uid}:${await sha(v.key)}`;
      if (!(await get(k)) && (await keys(`ho:${user.uid}:`, LIMITS.handovers)).length >= LIMITS.handovers) return json(409, { error: { code: 'HANDOVERS_FULL' } });
      const at = new Date(now()).toISOString(); await put(k, { key: v.key, name, text, at }, TTL.handover); // a project not opened for 30 days drops out
      return json(200, { at });
    }
    if (path === '/api/connector/unlink') {
      if (!projectKeyOk(v?.key)) return json(400, { error: { code: 'INVALID_INPUT' } });
      await del(`ho:${user.uid}:${await sha(v.key)}`); return json(200, { ok: true });
    }
    if (path === '/api/connector/logout' && !user.pc) {
      const s = readCookie(request, SESSION_COOKIE); if (s) await del(`sess:${await sha(s)}`);
      return json(200, { ok: true }, { 'Set-Cookie': cookie(SESSION_COOKIE, '', 0) });
    }
    return json(404, { error: { code: 'NOT_FOUND' } });
  }

  /** The connector's answer to a request on one of its paths, or null for any other path (the Studio API and the site's assets). */
  async function handle(request) {
    const url = new URL(request.url), path = url.pathname, origin = url.origin;
    const mine = path === '/mcp' || path.startsWith('/.well-known/oauth-') || path.startsWith('/oauth/') || path.startsWith('/auth/') || path.startsWith('/api/connector/');
    if (!mine) return null;
    if (!configured) return json(404, { error: { code: 'CONNECTOR_OFF' } });
    try {
      if (path === '/.well-known/oauth-protected-resource' || path === '/.well-known/oauth-protected-resource/mcp') return json(200, resourceMeta(origin), { 'Access-Control-Allow-Origin': '*' });
      if (path === '/.well-known/oauth-authorization-server') return json(200, serverMeta(origin), { 'Access-Control-Allow-Origin': '*' });
      if (path === '/mcp') return await mcp(request, origin);
      if (path === '/oauth/register' && request.method === 'POST') return await register(request);
      if (path === '/oauth/authorize' && request.method === 'GET') return await authorize(request, origin);
      if (path === '/oauth/consent' && request.method === 'POST') return await consent(request, origin);
      if (path === '/oauth/token' && request.method === 'POST') return await token(request, origin);
      if (path === '/oauth/github/callback' && request.method === 'GET') return await callback(request, origin);
      if (path === '/auth/login' && request.method === 'GET') { const ret = url.searchParams.get('return') ?? '/'; return await toGitHub(origin, { kind: 'site', ret: /^\/(?![/\\])[\w\-./?=&#%]*$/.test(ret) ? ret : '/' }); }
      if (path === '/auth/pc' && request.method === 'GET') return await toGitHub(origin, { kind: 'pc' });
      if (path.startsWith('/api/connector/')) return await api(request, origin, path);
      return json(404, { error: { code: 'NOT_FOUND' } });
    } catch { return json(500, { error: { code: 'INTERNAL_ERROR' } }); }
  }
  return { configured, handle };
}
