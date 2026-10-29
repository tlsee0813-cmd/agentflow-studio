// Hosting adapter for Worker-style platforms (standard Request/Response, no node: imports).
// Serves only /api/studio/*; the static site (continuity/static-dist) is hosted separately or by the platform's asset binding.
// Env set by the operator on the host: DEEPSEEK_API_KEY (secret), STUDIO_ALLOWED_ORIGINS, optional STUDIO_ACCESS_CODE,
// DEEPSEEK_MODEL, STUDIO_* limits. Nothing here is bundled into the browser build.
import { createStudioHandler } from './studio.mjs';
/** AF124: a release policy is chosen by the module a deployment names as its main (worker-existing-map.mjs), never by env. */
export function studioWorker(policy = null) {
  let cached = null;
  return {
    async fetch(request, env) {
      cached ??= createStudioHandler({ env: env ?? {}, policy });
      const url = new URL(request.url);
      if (url.pathname.startsWith('/api/studio/')) return cached(request);
      if (env?.ASSETS?.fetch) return env.ASSETS.fetch(request);
      return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  };
}
export default studioWorker();
