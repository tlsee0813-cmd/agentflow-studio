// Test harness only; not imported by production server. No network fallback.
import { createApp } from '../server/app.mjs';
import { readConfig } from '../server/config.mjs';
import { mockInterview } from '../server/providers/mock.mjs';
import { upstream } from './helpers.mjs';
const scenario = process.argv[2] ?? 'mock';
const cfg = readConfig({AI_MODE:'mock',PORT:'0',AI_REQUESTS_PER_MINUTE:'60',AI_PROCESS_CALL_CAP:'100'});
let calls=0;
if(scenario !== 'mock') Object.assign(cfg,{mode:'deepseek',apiKey: scenario==='missing-key'?'':'test-placeholder-not-a-key',allowPaid:true});
const app = createApp({config:cfg, fetchImpl:async(_url,init)=>{
  calls++;
  if(scenario === 'missing-key') throw new Error('TEST_FAILED: fetch must not be called');
  const body=JSON.parse(init.body);
  const request=JSON.parse(body.messages[1].content.split('\n').slice(1).join('\n'));
  // INIT-008 opt-in synthetic scenarios only. This file is never a product import.
  if (['init008-p01','init008-p01-rejected','init008-p03'].includes(scenario)) {
    const { syntheticResult, healthyUpstream } = await import('./init008-helpers.mjs');
    const result = syntheticResult(request,scenario === 'init008-p03' ? 'p03' : 'p01');
    if (scenario === 'init008-p01-rejected' && request.stage === 'summarize') {
      result.proposals[0].sourceIds = [request.answers[0].id]; // deliberately NOT a source ID
    }
    return healthyUpstream(result);
  }
  if((scenario==='invalid-after-question'&&calls>1)||(scenario==='recover-after-question'&&calls===2)) return new Response('{invalid');
  if(scenario==='delayed') await new Promise(resolve=>setTimeout(resolve,700));
  return upstream(mockInterview(request));
}});
app.listen(0,'127.0.0.1',()=>console.log(`TEST_URL=http://127.0.0.1:${app.address().port}`));
process.on('SIGTERM',()=>{app.close();app.closeAllConnections();});
