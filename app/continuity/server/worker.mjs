// Hosting adapter for Worker-style platforms (standard Request/Response, no node: imports).
// Serves only /api/studio/*; the static site (continuity/static-dist) is hosted separately or by the platform's asset binding.
// Env set by the operator on the host: DEEPSEEK_API_KEY (secret), STUDIO_ALLOWED_ORIGINS, optional STUDIO_ACCESS_CODE,
// DEEPSEEK_MODEL, STUDIO_* limits. Nothing here is bundled into the browser build.
import { createStudioHandler } from './studio.mjs';
let cached = null;
export default {
  async fetch(request, env) {
    cached ??= createStudioHandler({ env: env ?? {} });
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/studio/')) return cached(request);
    if (env?.ASSETS?.fetch) return env.ASSETS.fetch(request);
    return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
};
