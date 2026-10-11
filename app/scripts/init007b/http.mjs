import { once } from 'node:events';
import { createApp } from '../../server/app.mjs';
import { createCurlFetch } from '../init005/curl-fetch.mjs';
import { mockInterview } from '../../server/providers/mock.mjs';
import { experimentConfig, MODEL, sha, fail, errorCode, telemetry, authorizeEnvironment } from './policy.mjs';
/** A synthetic provider envelope. Only mock commands/tests select it. No fetch to a remote host. */
export async function mockProviderResponse(request) {
  return new Response(JSON.stringify({model:MODEL,usage:{prompt_tokens:1000,completion_tokens:500,total_tokens:1500,
    prompt_cache_hit_tokens:0,prompt_cache_miss_tokens:1000},choices:[{finish_reason:'stop',message:{content:JSON.stringify(mockInterview(request))}}]}),{status:200});
}
async function openAppHttp({mode,config,upstream}) {
  let pending=null,closed=false;
  const observations=[];
  const server=createApp({config,
    onTelemetry:t=>{if(pending)pending.telemetry=telemetry(t);},
    fetchImpl:async(url,init)=>{
      const p=pending;
      if(!p)fail('DISPATCH_REPEATED');
      if(p.dispatched){p.dispatchError='DISPATCH_REPEATED';fail('DISPATCH_REPEATED');}
      if(url!==config.endpoint||sha(init.body)!==p.reservation.bodySha256){p.dispatchError='BODY_MISMATCH';fail('BODY_MISMATCH');}
      try {
        // Synchronous durable journal acknowledgement immediately before upstream IO.
        p.onDispatch();p.dispatched=true;
      }catch(e){p.dispatchError=errorCode(e);throw e;}
      return upstream(url,init,p.request);
    }});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const origin=`http://127.0.0.1:${server.address().port}`;
  return {kind:mode==='live'?'deepseek-http-curl-proxy':'deepseek-http-mock-upstream',mode,config,observations,
    async generate(request,{reservation,onDispatch}) {
      if(pending||closed)fail('DISPATCH_REPEATED');
      const p={request,reservation,onDispatch,dispatched:false,telemetry:null,dispatchError:null};pending=p;
      const record={requestIdHash:sha(request.requestId),httpStatus:null,mode,upstreamDispatched:false};observations.push(record);
      try {
        const response=await fetch(`${origin}/api/interview`,{method:'POST',redirect:'error',
          headers:{Origin:origin,'Content-Type':'application/json','X-AgentFlow-Request':'1'},
          body:JSON.stringify(request),signal:AbortSignal.timeout(17000)});
        record.httpStatus=response.status;
        let body;try{body=await response.json();}catch{body=null;}
        // The real app/provider validation path ran. Mark synthetic state provenance honestly.
        if(mode==='mock'&&body?.mode==='deepseek')body.mode='mock';
        return {status:response.status,body,telemetry:p.telemetry,dispatchError:p.dispatchError};
      }catch {return {status:null,body:null,telemetry:p.telemetry,dispatchError:p.dispatchError??'TRANSPORT_UNCERTAIN'};}
      finally{record.upstreamDispatched=p.dispatched;pending=null;}
    },
    async close() {
      closed=true;await new Promise((ok,bad)=>{server.close(e=>e?bad(e):ok());server.closeAllConnections();});
      config.apiKey='';config.allowPaid=false;
    }
  };
}
export function openMockHttp({factory=mockProviderResponse}={}) {
  return openAppHttp({mode:'mock',config:experimentConfig(),upstream:(_url,_init,request)=>factory(request)});
}
export function openLiveHttp(env) {
  authorizeEnvironment(env);
  const config=experimentConfig(env.DEEPSEEK_API_KEY);
  const fetchImpl=createCurlFetch({env,requireProxy:true,timeoutMs:15000});
  return openAppHttp({mode:'live',config,upstream:(url,init)=>fetchImpl(url,init)});
}
