import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';
import { validateRequest } from '../dist/public/shared/validation.js';
import { readConfig } from './config.mjs';
import { ApiError, safeError } from './errors.mjs';
import { callDeepSeek } from './providers/deepseek.mjs';
import { mockInterview } from './providers/mock.mjs';
import { readPublicFile } from './static-files.mjs';
import { createLimiter } from './limiter.mjs';
const publicRoot = resolve(fileURLToPath(new URL('../dist/public/', import.meta.url)));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
function headers(res) {
  res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer'); res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'; form-action 'self'; base-uri 'none'; object-src 'none'");
}
function json(res, status, data) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); }
async function body(req) {
  if (Number(req.headers['content-length'] ?? 0) > 32768) throw new ApiError('INPUT_TOO_LARGE',413);
  let size = 0; const chunks = [];
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > 32768) { req.resume(); throw new ApiError('INPUT_TOO_LARGE',413); }
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new ApiError('INVALID_INPUT',400); }
}
export function createApp({ config = readConfig(), fetchImpl = globalThis.fetch, onDiagnostic, onTelemetry } = {}) {
  const limiter = createLimiter(config);
  const server = createServer(async (req, res) => {
    headers(res);
    try {
      const port = req.socket.localPort;
      const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
      if (!hosts.includes(req.headers.host)) throw new ApiError('FORBIDDEN_ORIGIN',403);
      const path = new URL(req.url, `http://127.0.0.1:${port}`).pathname;
      if (req.method === 'GET' && path === '/api/config') {
        json(res,200,{ mode: config.mode, configured: config.mode === 'mock' || Boolean(config.apiKey),
          paidEnabled: config.mode === 'deepseek' && config.allowPaid, scope: 'local-development-only' }); return;
      }
      if (req.method === 'POST' && path === '/api/interview') {
        if (!hosts.map(h => `http://${h}`).includes(req.headers.origin) || req.headers['sec-fetch-site'] === 'cross-site' || req.headers['x-agentflow-request'] !== '1') {
          throw new ApiError('FORBIDDEN_ORIGIN',403);
        }
        if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') throw new ApiError('INVALID_CONTENT_TYPE',415);
        let request;
        try { request = validateRequest(await body(req)); }
        catch (e) { if (e instanceof ApiError) throw e; throw new ApiError('INVALID_INPUT',400); }
        if (config.mode === 'deepseek' && !config.apiKey) throw new ApiError('AI_NOT_CONFIGURED',503);
        if (config.mode === 'deepseek' && !config.allowPaid) throw new ApiError('PAID_CALLS_DISABLED',503);
        const release = limiter.acquire(request.requestId);
        const controller = new AbortController();
        const disconnected = () => { if (!res.writableEnded) controller.abort(); };
        res.on('close',disconnected);
        try {
          const result = config.mode === 'mock' ? mockInterview(request)
            : await callDeepSeek(request,config,{fetchImpl,signal:controller.signal,onDiagnostic,onTelemetry});
          if (!res.destroyed) json(res,200,{mode:config.mode,result});
        } finally { release(); res.off('close',disconnected); }
        return;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') throw new ApiError('METHOD_NOT_ALLOWED',405);
      // Use the raw pathname: URL normalization would erase traversal segments.
      const { file, data } = await readPublicFile(publicRoot, (req.url ?? '').split('?')[0]);
      res.writeHead(200, {'Content-Type': types[extname(file)], 'Content-Length': data.length});
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch (e) {
      const error = safeError(e);
      if (!res.destroyed && !res.headersSent) {
        if (error.retryAfter) res.setHeader('Retry-After',String(error.retryAfter));
        json(res,error.status,{error:{code:error.code}});
      }
    }
  });
  server.requestTimeout = 10000; server.headersTimeout = 5000; server.keepAliveTimeout = 5000;
  return server;
}
