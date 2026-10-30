// Shared continuity server plumbing: provider error mapping (provider-errors.mjs) and the Node HTTP helpers (http.mjs) of the
// localhost server. Real sockets on a random port; no provider is called.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { readFile } from 'node:fs/promises';
import { ApiError } from '../../server/errors.mjs';
import { abortError, providerHttpError } from '../server/provider-errors.mjs';
import { assertLocalHost, assertLocalPost, readJson, sendError, sendJson, setSecurityHeaders, SECURITY_HEADERS } from '../server/http.mjs';

test('SHARED-E1 provider statuses map to stable codes; only a provider rate limit carries Retry-After', () => {
  const cases = [[400, 'AI_CONFIG_REJECTED', 502], [401, 'AI_AUTH_FAILED', 502], [402, 'AI_BALANCE_REQUIRED', 502], [403, 'AI_AUTH_FAILED', 502],
    [404, 'AI_CONFIG_REJECTED', 502], [422, 'AI_CONFIG_REJECTED', 502], [429, 'AI_RATE_LIMIT', 429], [500, 'AI_UNAVAILABLE', 503], [503, 'AI_UNAVAILABLE', 503]];
  for (const [status, code, http] of cases) {
    const e = providerHttpError(status, 30);
    assert.ok(e instanceof ApiError); assert.deepEqual([e.code, e.status, e.retryAfter], [code, http, status === 429 ? 30 : null], String(status));
  }
  assert.deepEqual([abortError(true).code, abortError(true).status], ['AI_TIMEOUT', 504]);
  assert.deepEqual([abortError(false).code, abortError(false).status], ['CANCELLED', 499]);
});

test('SHARED-E2 provider-errors.mjs stays Worker-safe (it is in the Worker closure through studio.mjs)', async () => {
  const src = await readFile(new URL('../server/provider-errors.mjs', import.meta.url), 'utf8');
  assert.ok(!/from\s+['"]node:|require\(|process\./.test(src.replace(/\/\/.*$/gm, '')));
});

// A one-route server built only from the shared helpers, so each rule is seen through a real request.
function helperServer(maxBytes = 64) {
  return createServer(async (req, res) => {
    setSecurityHeaders(res);
    try {
      const hosts = assertLocalHost(req);
      if (req.method === 'POST') { assertLocalPost(req, hosts); sendJson(res, 200, { got: await readJson(req, maxBytes) }); return; }
      throw new ApiError('AI_RATE_LIMIT', 429, 7);
    } catch (e) { sendError(res, e); }
  });
}
async function withServer(fn) {
  const server = helperServer(); await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  try { return await fn(port); } finally { await new Promise(r => server.close(r)); }
}
function send(port, { method = 'POST', headers = {}, chunks = [] } = {}) {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port, method, path: '/', headers: { host: `127.0.0.1:${port}`, ...headers } }, res => {
      let text = ''; res.setEncoding('utf8'); res.on('data', c => { text += c; }); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(text) }));
    });
    req.on('error', reject); for (const c of chunks) req.write(c); req.end();
  });
}
const post = port => ({ origin: `http://127.0.0.1:${port}`, 'x-agentflow-request': '1', 'content-type': 'application/json' });

test('SHARED-H1 security headers, safe error body and Retry-After come from one place', async () => withServer(async port => {
  const r = await send(port, { method: 'GET' });
  assert.equal(r.status, 429); assert.deepEqual(r.body, { error: { code: 'AI_RATE_LIMIT' } }); assert.equal(r.headers['retry-after'], '7');
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) assert.equal(r.headers[name.toLowerCase()], value, name);
}));

test('SHARED-H2 the Host check and the POST boundary refuse before the body is read', async () => withServer(async port => {
  assert.equal((await send(port, { method: 'GET', headers: { host: `evil.example:${port}` } })).status, 403);
  const ok = post(port);
  for (const [change, status] of [[{ origin: 'http://evil.example' }, 403], [{ 'sec-fetch-site': 'cross-site' }, 403], [{ 'x-agentflow-request': '0' }, 403], [{ 'content-type': 'text/plain' }, 415]]) {
    const r = await send(port, { headers: { ...ok, ...change }, chunks: ['{}'] });
    assert.equal(r.status, status, JSON.stringify(change));
  }
  assert.deepEqual((await send(port, { headers: ok, chunks: ['{"a":1}'] })).body, { got: { a: 1 } });
}));

test('SHARED-H3 body limits hold by Content-Length and by what arrives (chunked); non-JSON is INVALID_INPUT', async () => withServer(async port => {
  const big = JSON.stringify({ text: 'x'.repeat(100) });
  assert.deepEqual((await send(port, { headers: { ...post(port), 'content-length': String(Buffer.byteLength(big)) }, chunks: [big] })).body, { error: { code: 'INPUT_TOO_LARGE' } });
  const chunked = await send(port, { headers: { ...post(port), 'transfer-encoding': 'chunked' }, chunks: [big.slice(0, 50), big.slice(50)] });
  assert.deepEqual([chunked.status, chunked.body], [413, { error: { code: 'INPUT_TOO_LARGE' } }]);
  const bad = await send(port, { headers: post(port), chunks: ['{not json'] });
  assert.deepEqual([bad.status, bad.body], [400, { error: { code: 'INVALID_INPUT' } }]);
}));
