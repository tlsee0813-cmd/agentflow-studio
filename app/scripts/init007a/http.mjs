import { once } from 'node:events';
import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import { createApp } from '../../server/app.mjs';
import { readConfig } from '../../server/config.mjs';
export const MIN_INTERVAL_MS = 12000;
/** Only local createApp + its explicit mock branch. No URL, key or live-mode input. */
export async function openMockHttp() {
  const config = readConfig({AI_MODE:'mock',ALLOW_PAID_AI:'false',PORT:'0'});
  const server = createApp({config,fetchImpl:async () => { throw new Error('NETWORK_PROVIDER_DISABLED'); }});
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  let lastStarted = null, active = false, closed = false;
  const observations = [];
  return {
    kind:'mock-http', config:{mode:'mock',allowPaid:false,rate:config.rate,cap:config.cap,concurrency:config.concurrency},
    observations,
    async generate(request) {
      if (active || closed) throw new Error('TRANSPORT_NOT_READY');
      active = true;
      try {
        if (lastStarted !== null) {
          while (performance.now() - lastStarted < MIN_INTERVAL_MS) await sleep(Math.ceil(MIN_INTERVAL_MS - (performance.now() - lastStarted)));
        }
        const now = performance.now();
        const observation = {requestId:request.requestId,startedAt:new Date().toISOString(),
          gapMs:lastStarted === null ? null : now-lastStarted,httpStatus:null};
        lastStarted = now; observations.push(observation);
        const response = await fetch(`${origin}/api/interview`, {method:'POST',
          headers:{Origin:origin,'Content-Type':'application/json','X-AgentFlow-Request':'1'},
          body:JSON.stringify(request),signal:AbortSignal.timeout(30000),redirect:'error'});
        observation.httpStatus = response.status;
        let body;
        try { body = await response.json(); } catch { body = null; }
        return {status:response.status,body}; // Ephemeral; evaluator saves only validated output.
      } finally { active = false; }
    },
    async close() {
      closed = true;
      await new Promise((resolve,reject) => {server.close(e=>e?reject(e):resolve());server.closeAllConnections();});
    }
  };
}
