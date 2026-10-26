import { RUNTIME } from './runtime.js';
import { AskError } from './studio-api.js';
const url = (path) => `${RUNTIME.apiBase ?? ''}${path}`;
async function post(path, body, signal, accessCode) {
    if (RUNTIME.apiBase === null)
        throw new AskError('NO_SERVER');
    const headers = { 'Content-Type': 'application/json', 'X-AgentFlow-Request': '1' };
    if (accessCode)
        headers['X-Studio-Access'] = accessCode;
    let res;
    try {
        res = await fetch(url(path), { method: 'POST', headers, body: JSON.stringify(body), signal, credentials: 'same-origin' });
    }
    catch {
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
export const requestPlan = (ask, signal, accessCode) => post('/api/studio/plan', ask, signal, accessCode);
/** One review of the chosen request scope, made when a request document is generated from an AI analysis. */
export const requestScope = (ask, signal, accessCode) => post('/api/studio/scope', ask, signal, accessCode);
