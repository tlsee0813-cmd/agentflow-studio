/* POST /api/studio/plan with the same rules as the part question: same-origin credentials only, the X-AgentFlow-Request header,
 * the person's access code when the server asks for one, and an AbortController the panel can cancel. No key in the browser. */
import type { PlanAsk } from '../shared/plan-api.js';
import { RUNTIME } from './runtime.js';
import { AskError } from './studio-api.js';

const url = (path: string) => `${RUNTIME.apiBase ?? ''}${path}`;

export async function requestPlan(ask: PlanAsk, signal: AbortSignal, accessCode: string): Promise<{ model: string; reply: unknown }> {
  if (RUNTIME.apiBase === null) throw new AskError('NO_SERVER');
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-AgentFlow-Request': '1' };
  if (accessCode) headers['X-Studio-Access'] = accessCode;
  let res: Response;
  try { res = await fetch(url('/api/studio/plan'), { method: 'POST', headers, body: JSON.stringify(ask), signal, credentials: 'same-origin' }); }
  catch { throw new AskError(signal.aborted ? 'CANCELLED' : 'NETWORK'); }
  let data: { error?: { code?: unknown }; model?: unknown; reply?: unknown } | null = null;
  try { data = await res.json(); } catch { /* handled below */ }
  if (!res.ok) throw new AskError(typeof data?.error?.code === 'string' ? data.error.code : 'REQUEST_FAILED');
  if (!data?.reply || typeof data.model !== 'string') throw new AskError('INVALID_RESPONSE');
  return { model: data.model, reply: data.reply };
}
