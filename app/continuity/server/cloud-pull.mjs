// A PC's Studio linked to the web AI connector (AGENTFLOW_CLOUD_URL and AGENTFLOW_CLOUD_KEY in app/.env, the key made at
// <url>/auth/pc): records the person's web AI sessions left in the cloud come into this PC's connector mailbox (and from there into
// the project they name, or the first connected project that looks for unplaced ones), and the handover documents this PC's page
// leaves go up too, so a web AI session can take them. Local Node server only. The key goes only to that address, as a header.
export function cloudPull({ env = process.env, connector, fetchImpl = globalThis.fetch, every = 60000, log = () => {} }) {
  const base = String(env.AGENTFLOW_CLOUD_URL ?? '').replace(/\/+$/, ''), key = String(env.AGENTFLOW_CLOUD_KEY ?? '').trim();
  if (!base || !key || !connector) return null;
  let url; try { url = new URL(base); } catch { log('AgentFlow Studio: AGENTFLOW_CLOUD_URL is not a URL; the web AI connector is not linked.'); return null; }
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) { log('AgentFlow Studio: AGENTFLOW_CLOUD_URL must be https; the web AI connector is not linked.'); return null; }
  if (!/^afk_[\w-]{20,}$/.test(key)) { log('AgentFlow Studio: AGENTFLOW_CLOUD_KEY does not look like a PC key (afk_…); the web AI connector is not linked.'); return null; }
  const headers = json => ({ Authorization: `Bearer ${key}`, 'X-AgentFlow-Request': '1', ...(json ? { 'Content-Type': 'application/json' } : {}) });
  let said = null;
  const say = text => { if (text !== said) { said = text; if (text) log(text); } };
  async function once() {
    try {
      const res = await fetchImpl(`${base}/api/connector/records?all=1`, { headers: headers(false), signal: AbortSignal.timeout(20000) });
      if (res.status === 401) { say('AgentFlow Studio: the web AI connector refused this PC key (made a new one?); records from web AI sessions are not coming in.'); return { added: 0 }; }
      if (!res.ok) { say(`AgentFlow Studio: the web AI connector answered ${res.status}; trying again later.`); return { added: 0 }; }
      const { records } = await res.json();
      const list = Array.isArray(records) ? records : [];
      const { added } = await connector.take(list);
      const ids = list.map(r => r?.id).filter(id => typeof id === 'string');
      if (ids.length) await fetchImpl(`${base}/api/connector/ack`, { method: 'POST', headers: headers(true), body: JSON.stringify({ ids }), signal: AbortSignal.timeout(20000) });
      say(null);
      return { added };
    } catch { say('AgentFlow Studio: could not reach the web AI connector; trying again later.'); return { added: 0 }; }
  }
  /** One handover this PC's page left: sent up as it is (already masked here). */
  async function push(h) {
    try { await fetchImpl(`${base}/api/connector/handover`, { method: 'POST', headers: headers(true), body: JSON.stringify({ key: h.key, name: h.name, text: h.text }), signal: AbortSignal.timeout(20000) }); }
    catch { say('AgentFlow Studio: could not send a handover to the web AI connector; it goes with the next change.'); }
  }
  let timer = null;
  return { once, push, start() { void once(); timer = setInterval(() => void once(), every); timer.unref?.(); }, stop() { if (timer) clearInterval(timer); }, base };
}
