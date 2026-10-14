import { ApiError } from '../../server/errors.mjs';
import { readLimitedBody } from '../../server/providers/deepseek.mjs';
import { validateAdvice, validateGuideReply } from '../dist/public/shared/validation.js';
import { buildBody, buildGuideBody } from './prompt.mjs';
// Reuses the existing bounded body reader. The new context contract has its own parser.
// One request, no automatic retry, no raw provider errors or credentials in responses/logs.
export function callContinuity(request,config,options) {
  return callProvider(buildBody(request,config),content=>validateAdvice(content,request.bases.map(b=>b.id),request),config,options);
}
// GUIDE097: the same single call, limits and error mapping; only the prompt and the response contract differ.
export function callGuidance(request,config,options) {
  return callProvider(buildGuideBody(request,config),content=>validateGuideReply(content,request),config,options);
}
async function callProvider(body,parse,config,{fetchImpl=globalThis.fetch,signal}={}) {
  if(!config.apiKey) throw new ApiError('AI_NOT_CONFIGURED',503);
  if(!config.allowPaid) throw new ApiError('PAID_CALLS_DISABLED',503);
  if(signal?.aborted) throw new ApiError('CANCELLED',499);
  const controller=new AbortController(); let timeout=false;
  const abort=()=>controller.abort(); signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(()=>{timeout=true;controller.abort();},config.timeoutMs);
  let listener;
  try {
    const cancelled=new Promise((_,reject)=>{
      listener=()=>reject(new ApiError(timeout?'AI_TIMEOUT':'CANCELLED',timeout?504:499));
      if(controller.signal.aborted)listener(); else controller.signal.addEventListener('abort',listener,{once:true});
    });
    const work=(async()=>{
      const response=await fetchImpl(config.endpoint,{method:'POST',redirect:'error',signal:controller.signal,
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${config.apiKey}`},body:JSON.stringify(body)});
      if(!response.ok) {
        await response.body?.cancel();
        if([401,403].includes(response.status))throw new ApiError('AI_AUTH_FAILED',502);
        if(response.status===402)throw new ApiError('AI_BALANCE_REQUIRED',502);
        if(response.status===429)throw new ApiError('AI_RATE_LIMIT',429,60);
        if([400,404,422].includes(response.status))throw new ApiError('AI_CONFIG_REJECTED',502);
        throw new ApiError('AI_UNAVAILABLE',503);
      }
      try {
        const raw=JSON.parse(await readLimitedBody(response,131072,controller.signal));
        const c=raw?.choices?.[0];
        if(c?.finish_reason!=='stop' || c?.message?.tool_calls || typeof c?.message?.content!=='string')throw new Error();
        // The API credential must never be echoed into a model-generated display field.
        if(config.apiKey && c.message.content.includes(config.apiKey))throw new Error();
        return parse(JSON.parse(c.message.content));
      } catch { throw new ApiError('INVALID_RESPONSE',502); }
    })();
    return await Promise.race([work,cancelled]);
  } catch(e) {
    if(e instanceof ApiError)throw e;
    if(controller.signal.aborted)throw new ApiError(timeout?'AI_TIMEOUT':'CANCELLED',timeout?504:499);
    throw new ApiError('AI_NETWORK_ERROR',503);
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort',abort);
    if(listener)controller.signal.removeEventListener('abort',listener);
  }
}
