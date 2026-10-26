/* POST /api/studio/plan and /api/studio/scope with the same rules as the part question: same-origin credentials only, the
 * X-AgentFlow-Request header, the person's access code when the server asks for one, and an AbortController the panel can
 * cancel. No key in the browser. */
import type { PlanAsk } from '../shared/plan-api.js';
import type { ScopeAsk } from '../shared/scope-api.js';
import { RUNTIME } from './runtime.js';
import { AskError } from './studio-api.js';

const url = (path: string) => `${RUNTIME.apiBase ?? ''}${path}`;

async function post(path: string, body: unknown, signal: AbortSignal, accessCode: string): Promise<{ model: string; reply: unknown }> {
  if (RUNTIME.apiBase === null) throw new AskError('NO_SERVER');
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-AgentFlow-Request': '1' };
  if (accessCode) headers['X-Studio-Access'] = accessCode;
  let res: Response;
  try { res = await fetch(url(path), { method: 'POST', headers, body: JSON.stringify(body), signal, credentials: 'same-origin' }); }
  catch { throw new AskError(signal.aborted ? 'CANCELLED' : 'NETWORK'); }
  let data: { error?: { code?: unknown }; model?: unknown; reply?: unknown } | null = null;
  try { data = await res.json(); } catch { /* handled below */ }
  if (!res.ok) throw new AskError(typeof data?.error?.code === 'string' ? data.error.code : 'REQUEST_FAILED');
  if (!data?.reply || typeof data.model !== 'string') throw new AskError('INVALID_RESPONSE');
  return { model: data.model, reply: data.reply };
}
export const requestPlan = (ask: PlanAsk, signal: AbortSignal, accessCode: string) => post('/api/studio/plan', ask, signal, accessCode);
/** One review of the chosen request scope, made when a request document is generated from an AI analysis. */
export const requestScope = (ask: ScopeAsk, signal: AbortSignal, accessCode: string) => post('/api/studio/scope', ask, signal, accessCode);
