// Node HTTP plumbing of the localhost-only continuity server (app.mjs): response headers, body limits, the localhost Host check,
// the POST boundary and the error body, each written once. The same rules as server/app.mjs, which keeps its own inline copy
// because that tree is frozen by the historic evaluation gates. Errors are ApiError codes only, never raw exceptions or requests.
import { ApiError, safeError } from '../../server/errors.mjs';

export const SECURITY_HEADERS = Object.freeze({
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'; form-action 'self'; base-uri 'none'; object-src 'none'"
});
export const STATIC_TYPES = Object.freeze({ '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' });

export function setSecurityHeaders(res) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);
}
export function sendJson(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(value));
}
/** Writes the safe error body ({ error: { code } }) unless the response is already gone or started. */
export function sendError(res, e, map = safeError) {
  const error = map(e);
  if (res.destroyed || res.headersSent) return;
  if (error.retryAfter) res.setHeader('Retry-After', String(error.retryAfter));
  sendJson(res, error.status, { error: { code: error.code } });
}

/** The request body as one Buffer, at most maxBytes (by Content-Length up front, then by what actually arrives). */
export async function readBody(req, maxBytes) {
  if (Number(req.headers['content-length'] ?? 0) > maxBytes) throw new ApiError('INPUT_TOO_LARGE', 413);
  let size = 0; const chunks = [];
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > maxBytes) { req.resume(); throw new ApiError('INPUT_TOO_LARGE', 413); }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
/** readBody parsed as JSON; anything that is not JSON is INVALID_INPUT. */
export async function readJson(req, maxBytes) {
  const data = await readBody(req, maxBytes);
  try { return JSON.parse(data.toString('utf8')); } catch { throw new ApiError('INVALID_INPUT', 400); }
}

/** The two Host values a localhost server answers to on its own port; any other Host is refused (DNS rebinding). */
export function assertLocalHost(req) {
  const port = req.socket.localPort, hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
  if (!hosts.includes(req.headers.host)) throw new ApiError('FORBIDDEN_ORIGIN', 403);
  return hosts;
}
/** The POST boundary of the localhost AI routes: same origin, not cross-site, the custom header, and a JSON body. */
export function assertLocalPost(req, hosts) {
  if (!hosts.some(h => `http://${h}` === req.headers.origin) || req.headers['sec-fetch-site'] === 'cross-site' || req.headers['x-agentflow-request'] !== '1') {
    throw new ApiError('FORBIDDEN_ORIGIN', 403);
  }
  if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') throw new ApiError('INVALID_CONTENT_TYPE', 415);
}
/** Ends the request when the response closes first, so an abandoned AI call is cancelled. Returns the cleanup. */
export function abortOnClose(res, controller) {
  const closed = () => { if (!res.writableEnded) controller.abort(); };
  res.on('close', closed);
  return () => res.off('close', closed);
}
export function setLocalTimeouts(server) {
  server.requestTimeout = 10000; server.headersTimeout = 5000; server.keepAliveTimeout = 5000;
  return server;
}
