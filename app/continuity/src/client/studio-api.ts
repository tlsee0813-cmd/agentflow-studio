import type { StudioAsk, StudioReply } from '../shared/studio.js';
import { validateDigestReply, type DigestAsk, type DigestReply } from '../shared/digest-api.js';
import { validateMapReply, MAP4_SCHEMA, MAP5_SCHEMA, MAP6_SCHEMA, MAP7_SCHEMA, type MapAsk, type MapReply } from '../shared/map-reading.js';
import { SPAN_INDEX, textDigest } from '../shared/evidence-span.js';
import { RUNTIME } from './runtime.js';

/** digest: the model and prompt id a return reading would be made with (null when the server does not say). */
export interface AiStatus { ai: 'deepseek' | 'off' | 'none'; model: string | null; access: 'open' | 'code'; digest?: { model: string; prompt: string; record: string | null } | null;
  /** The model and prompt id a map reading would be made with (null when the server does not offer it). AF102 via 'jobs': made only
   * as a durable job by the server's own map executor (a local preview), whatever ai says; the other AI features keep ai. */
  map?: { model: string; prompt: string; via?: 'jobs';
    /** AF116: the m7 recipe for later readings (studio.map.7), beside prompt (m6, still every first map); absent on older servers. */
    laterPrompt?: string } | null;
  /** AF100: the server keeps map readings as durable jobs on this PC (durable), or has a job store it cannot use (problem).
   * AF102 executor: the map executor's state (ready, busy, unsettled: an earlier child not known to have ended, unavailable). */
  jobs?: { durable: boolean; problem: string | null; executor?: { state: string; problem: string | null; scope?: ExecutorScope } | null } | null;
  /** AF124: the server is a limited release that names why it offers no map reading (never read into an older server's silence). */
  release?: ReleasePolicy | null }
/** AF124: work on maps one already has. Map readings (a first map, a later one, a return read against the map) are not offered. */
export type ReleasePolicy = 'existing-map';
/** The earlier public site, at its own address (opened only by the person; nothing is sent or synchronised between the two). */
export const PUBLIC_EDITION = 'https://agentflow-studio.tlsee0813.workers.dev/';
export const RELEASE_TEXT = {
  intro: '기존 지도 작업용 버전이에요. 저장된 지도를 읽고 고치며, 변경안과 요청문을 이어 가요.',
  limit: '원자료로 첫 지도를 만들거나 새 기록으로 지도를 갱신하는 기능은 이 버전에서 제공하지 않아요.',
  move: '기존 공개판의 자료는 자동으로 옮겨지지 않아요. 지도 백업을 가져오고, 변경안·요청·반환 자료가 있으면 그 지도의 ‘변경 구상’에서 변경안 파일도 따로 가져오세요.',
  apart: '기존 공개판은 그 주소에서 그대로 쓸 수 있어요. 두 주소의 저장 내용은 자동으로 맞춰지지 않아요.'
};
/** AF112/AF116: which map readings a local preview executor takes; unknown values are not shown. */
export type ExecutorScope = 'first' | 'map6-later' | 'map7-later';
const SCOPES: readonly string[] = ['first', 'map6-later', 'map7-later'];
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
    const m = v.map, map = m && typeof m.model === 'string' && /^[\w.-]{1,80}$/.test(m.model) && typeof m.prompt === 'string' && /^m[1-6]-[0-9a-f]{12}$/.test(m.prompt) ? { model: m.model, prompt: m.prompt, ...(m.via === 'jobs' ? { via: 'jobs' as const } : {}),
      // A later recipe is read only beside a current m6 one, and only as an exact m7 id.
      ...(/^m6-/.test(m.prompt) && typeof m.laterPrompt === 'string' && /^m7-[0-9a-f]{12}$/.test(m.laterPrompt) ? { laterPrompt: m.laterPrompt } : {}) } : null;
    // AF112 scope: which map readings the executor takes (first maps only, later map.6 readings too, or AF116 later map.7 readings).
    const j = v.jobs, x = j?.executor, executor = x && typeof x.state === 'string' ? { state: x.state, problem: typeof x.problem === 'string' ? x.problem : null, ...(SCOPES.includes(x.scope) ? { scope: x.scope as ExecutorScope } : {}) } : null;
    const jobs = j && j.version === 'map-job.1' ? { durable: j.durable === true, problem: typeof j.problem === 'string' ? j.problem : null, ...(executor ? { executor } : {}) } : null;
    const release = v.release === 'existing-map' ? 'existing-map' as const : null;
    return { ai: v.ai, model: typeof v.model === 'string' ? v.model : null, access: v.access === 'code' ? 'code' : 'open', digest, map: release ? null : map, jobs: release ? null : jobs, release };
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
  if ((ask.schemaVersion === MAP4_SCHEMA || ask.schemaVersion === MAP5_SCHEMA || ask.schemaVersion === MAP6_SCHEMA || ask.schemaVersion === MAP7_SCHEMA) && (data.evidence?.index !== SPAN_INDEX || data.evidence.ask !== textDigest(body))) throw new AskError('INVALID_RESPONSE');
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
  MAP_WITHHELD: '이 버전에서는 지도를 새로 만들거나 갱신하지 않아요. 기록과 지도는 그대로예요.',
  NETWORK: 'AI 서버에 연결하지 못했어요.',
  NO_SERVER: '이 페이지에는 연결된 AI 서버가 없어요.'
};
