import { RUNTIME } from './runtime.js';
export class AskError extends Error {
    code;
    constructor(code) {
        super(code);
        this.code = code;
    }
}
// same-origin: an owner-private host's own cookies go with same-origin calls; a cross-origin API still gets none.
const url = (path) => `${RUNTIME.apiBase ?? ''}${path}`;
/** none = this build has no server to ask; off = a server answered but has no AI key. */
export async function aiStatus() {
    if (RUNTIME.apiBase === null)
        return { ai: 'none', model: null, access: 'open' };
    try {
        const res = await fetch(url('/api/studio/status'), { credentials: 'same-origin' });
        const v = await res.json();
        if (!res.ok || !['deepseek', 'off'].includes(v?.ai))
            return { ai: 'none', model: null, access: 'open' };
        return { ai: v.ai, model: typeof v.model === 'string' ? v.model : null, access: v.access === 'code' ? 'code' : 'open' };
    }
    catch {
        return { ai: 'none', model: null, access: 'open' };
    }
}
export async function askStudio(ask, signal, accessCode) {
    if (RUNTIME.apiBase === null)
        throw new AskError('NO_SERVER');
    const headers = { 'Content-Type': 'application/json', 'X-AgentFlow-Request': '1' };
    if (accessCode)
        headers['X-Studio-Access'] = accessCode;
    let res;
    try {
        res = await fetch(url('/api/studio/ask'), { method: 'POST', headers, body: JSON.stringify(ask), signal, credentials: 'same-origin' });
    }
    catch (e) {
        throw new AskError(signal.aborted ? 'CANCELLED' : 'NETWORK');
    }
    let data = null;
    try {
        data = await res.json();
    }
    catch { /* handled below */ }
    if (!res.ok)
        throw new AskError(typeof data?.error?.code === 'string' ? data.error.code : 'REQUEST_FAILED');
    if (!data?.reply || typeof data.model !== 'string')
        throw new AskError('INVALID_RESPONSE');
    return { model: data.model, reply: data.reply };
}
export const ERROR_TEXT = {
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
    ACCESS_CODE_REQUIRED: '접속 코드가 맞지 않아요.',
    FORBIDDEN_ORIGIN: '이 주소에서는 AI 서버에 요청할 수 없어요.',
    INPUT_TOO_LARGE: '보낼 기록이 너무 커요.',
    NETWORK: 'AI 서버에 연결하지 못했어요.',
    NO_SERVER: '이 페이지에는 연결된 AI 서버가 없어요.'
};
