import type { StudioAsk, StudioReply } from '../shared/studio.js';
import { validateDigestReply, type DigestAsk, type DigestReply } from '../shared/digest-api.js';
import { validateMapReply, MAP4_SCHEMA, MAP5_SCHEMA, MAP6_SCHEMA, type MapAsk, type MapReply } from '../shared/map-reading.js';
import { SPAN_INDEX, textDigest } from '../shared/evidence-span.js';
import { RUNTIME } from './runtime.js';

/** digest: the model and prompt id a return reading would be made with (null when the server does not say). */
export interface AiStatus { ai: 'deepseek' | 'off' | 'none'; model: string | null; access: 'open' | 'code'; digest?: { model: string; prompt: string; record: string | null } | null;
  /** The model and prompt id a map reading would be made with (null when the server does not offer it). */
  map?: { model: string; prompt: string } | null;
  /** AF100: the server keeps map readings as durable jobs on this PC (durable), or has a job store it cannot use (problem). */
  jobs?: { durable: boolean; problem: string | null } | null }
export class AskError extends Error { constructor(readonly code: string) { super(code); } }

// same-origin: an owner-private host's own cookies go with same-origin calls; a cross-origin API still gets none.
const url = (path: string) => `${RUNTIME.apiBase ?? ''}${path}`;

/** none = this build has no server to ask; off = a server answered but has no AI key. */
export async function aiStatus(): Promise<AiStatus> {
  if (RUNTIME.apiBase === null) return { ai: 'none', model: null, access: 'open' };
  try {
    const res = await fetch(url('/api/studio/status'), { credentials: 'same-origin' });
    const v = await res.json();
    if (!res.ok || !['deepseek', 'off'].includes(v?.ai)) return { ai: 'none', model: null, access: 'open' };
    const d = v.digest, digest = d && typeof d.model === 'string' && typeof d.prompt === 'string' && /^[\w.-]{1,80}$/.test(d.model) && /^d1-[0-9a-f]{12}$/.test(d.prompt)
      ? { model: d.model, prompt: d.prompt, record: typeof d.record === 'string' && /^d2-[0-9a-f]{12}$/.test(d.record) ? d.record : null } : null;
    const m = v.map, map = m && typeof m.model === 'string' && /^[\w.-]{1,80}$/.test(m.model) && typeof m.prompt === 'string' && /^m[1-6]-[0-9a-f]{12}$/.test(m.prompt) ? { model: m.model, prompt: m.prompt } : null;
    const j = v.jobs, jobs = j && j.version === 'map-job.1' ? { durable: j.durable === true, problem: typeof j.problem === 'string' ? j.problem : null } : null;
    return { ai: v.ai, model: typeof v.model === 'string' ? v.model : null, access: v.access === 'code' ? 'code' : 'open', digest, map, jobs };
  } catch { return { ai: 'none', model: null, access: 'open' }; }
}

export async function askStudio(ask: StudioAsk, signal: AbortSignal, accessCode: string): Promise<{ model: string; reply: StudioReply }> {
  if (RUNTIME.apiBase === null) throw new AskError('NO_SERVER');
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-AgentFlow-Request': '1' };
  if (accessCode) headers['X-Studio-Access'] = accessCode;
  let res: Response;
  try { res = await fetch(url('/api/studio/ask'), { method: 'POST', headers, body: JSON.stringify(ask), signal, credentials: 'same-origin' }); }
  catch (e) { throw new AskError(signal.aborted ? 'CANCELLED' : 'NETWORK'); }
  let data: { error?: { code?: unknown }; model?: unknown; reply?: StudioReply } | null = null;
  try { data = await res.json(); } catch { /* handled below */ }
  if (!res.ok) throw new AskError(typeof data?.error?.code === 'string' ? data.error.code : 'REQUEST_FAILED');
  if (!data?.reply || typeof data.model !== 'string') throw new AskError('INVALID_RESPONSE');
  return { model: data.model, reply: data.reply };
}

/** A return reading. The reply is checked again here against the request that was sent. */
export async function askDigest(ask: DigestAsk, signal: AbortSignal, accessCode: string): Promise<{ model: string; reply: DigestReply }> {
  if (RUNTIME.apiBase === null) throw new AskError('NO_SERVER');
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-AgentFlow-Request': '1' };
  if (accessCode) headers['X-Studio-Access'] = accessCode;
  let res: Response;
  try { res = await fetch(url('/api/studio/digest'), { method: 'POST', headers, body: JSON.stringify(ask), signal, credentials: 'same-origin' }); }
  catch { throw new AskError(signal.aborted ? 'CANCELLED' : 'NETWORK'); }
  let data: { error?: { code?: unknown }; model?: unknown; reply?: unknown } | null = null;
  try { data = await res.json(); } catch { /* handled below */ }
  if (!res.ok) throw new AskError(typeof data?.error?.code === 'string' ? data.error.code : 'REQUEST_FAILED');
  if (typeof data?.model !== 'string') throw new AskError('INVALID_RESPONSE');
  try { return { model: data.model, reply: validateDigestReply(data.reply, ask) }; } catch { throw new AskError('INVALID_RESPONSE'); }
}

/** A map reading. The reply is checked again here against the request that was sent. studio.map.4: the reply comes as references,
 * decoded here against this very request (the server says which request body it read), so each passage keeps where it stands. */
export async function askMap(ask: MapAsk, signal: AbortSignal, accessCode: string): Promise<{ model: string; reply: MapReply }> {
  if (RUNTIME.apiBase === null) throw new AskError('NO_SERVER');
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-AgentFlow-Request': '1' };
  if (accessCode) headers['X-Studio-Access'] = accessCode;
  const body = JSON.stringify(ask);
  let res: Response;
  try { res = await fetch(url('/api/studio/map'), { method: 'POST', headers, body, signal, credentials: 'same-origin' }); }
  catch { throw new AskError(signal.aborted ? 'CANCELLED' : 'NETWORK'); }
  let data: { error?: { code?: unknown }; model?: unknown; reply?: unknown; evidence?: { index?: unknown; ask?: unknown } } | null = null;
  try { data = await res.json(); } catch { /* handled below */ }
  // Cancelled while the body was still coming: said as cancelled, never read as a broken reply.
  if (signal.aborted) throw new AskError('CANCELLED');
  if (!res.ok) throw new AskError(typeof data?.error?.code === 'string' ? data.error.code : 'REQUEST_FAILED');
  if (typeof data?.model !== 'string') throw new AskError('INVALID_RESPONSE');
  if ((ask.schemaVersion === MAP4_SCHEMA || ask.schemaVersion === MAP5_SCHEMA || ask.schemaVersion === MAP6_SCHEMA) && (data.evidence?.index !== SPAN_INDEX || data.evidence.ask !== textDigest(body))) throw new AskError('INVALID_RESPONSE');
  try { return { model: data.model, reply: validateMapReply(data.reply, ask) }; } catch { throw new AskError('INVALID_RESPONSE'); }
}

export const ERROR_TEXT: Record<string, string> = {
  AI_NOT_CONFIGURED: '서버에 AI 키가 설정되지 않았어요.',
  AI_AUTH_FAILED: 'AI 서비스가 서버의 키를 받아들이지 않았어요.',
  AI_BALANCE_REQUIRED: 'AI 서비스 잔액이 부족해요.',
  AI_RATE_LIMIT: 'AI 서비스 요청이 잠시 많아요. 조금 뒤에 다시 시도하세요.',
  LOCAL_RATE_LIMIT: '요청이 잠시 많아요. 1분쯤 뒤에 다시 시도하세요.',
  AI_BUSY: '앞의 요청을 처리 중이에요. 잠시 뒤에 다시 시도하세요.',
  PROCESS_CALL_CAP: '이 서버의 요청 한도에 도달했어요.',
  AI_CONFIG_REJECTED: 'AI 서비스가 요청 설정을 거절했어요(모델 이름 등).',
  AI_UNAVAILABLE: 'AI 서비스가 응답하지 않아요.',
  AI_TIMEOUT: '응답이 너무 오래 걸려 멈췄어요.',
  AI_NETWORK_ERROR: '서버가 AI 서비스에 연결하지 못했어요.',
  INVALID_RESPONSE: 'AI 응답이 약속한 형식이 아니어서 보여 드리지 않았어요.',
  AI_RESPONSE_INCOMPLETE: 'AI가 응답을 끝내지 못해 보여 드리지 않았어요.',
  AI_RESPONSE_UNFINISHED: 'AI 응답이 정상적으로 끝나지 않아 보여 드리지 않았어요.',
  ACCESS_CODE_REQUIRED: '접속 코드가 맞지 않아요.',
  FORBIDDEN_ORIGIN: '이 주소에서는 AI 서버에 요청할 수 없어요.',
  INPUT_TOO_LARGE: '보낼 기록이 너무 커요.',
  NETWORK: 'AI 서버에 연결하지 못했어요.',
  NO_SERVER: '이 페이지에는 연결된 AI 서버가 없어요.'
};
