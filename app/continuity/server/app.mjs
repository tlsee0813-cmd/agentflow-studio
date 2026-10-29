import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { extname } from 'node:path';
import { readConfig } from '../../server/config.mjs';
import { ApiError, safeError } from '../../server/errors.mjs';
import { readPublicFile } from '../../server/static-files.mjs';
import { createLimiter } from '../../server/limiter.mjs';
import { validateRequest, validateAdvice, validateGuideRequest, validateGuideReply } from '../dist/public/shared/validation.js';
import { REQUEST_BYTES } from '../dist/public/shared/types.js';
import { mockAdvice, mockGuidance } from './mock.mjs';
import { callContinuity, callGuidance } from './provider.mjs';
const root=fileURLToPath(new URL('../dist/public/',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));}
async function body(req,validate=validateRequest) {
  if(Number(req.headers['content-length'] ?? 0)>REQUEST_BYTES)throw new ApiError('INPUT_TOO_LARGE',413);
  let length=0;const chunks=[];
  for await(const chunk of req.iterator({destroyOnReturn:false})) {
    length+=chunk.length; if(length>REQUEST_BYTES){req.resume();throw new ApiError('INPUT_TOO_LARGE',413);} chunks.push(chunk);
  }
  try{return validate(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{throw new ApiError('INVALID_INPUT',400);}
}
// Studio API (fetch handler) behind the same localhost host check. The body is read with its own limit and handed over as a
// standard Request; the handler applies its own origin/header rules on top.
async function serveStudio(req,res,studio,path) {
  const controller=new AbortController(),closed=()=>{if(!res.writableEnded)controller.abort();};res.on('close',closed);
  try {
    let body;
    if(req.method==='POST') {
      const chunks=[];let length=0;
      for await(const chunk of req.iterator({destroyOnReturn:false})){length+=chunk.length;if(length>(path==='/api/studio/jobs'?JOB_BODY:STUDIO_BODY)){req.resume();json(res,413,{error:{code:'INPUT_TOO_LARGE'}});return;}chunks.push(chunk);}
      body=Buffer.concat(chunks);
    }
    const headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(v!==undefined)headers.set(k,Array.isArray(v)?v.join(', '):v);
    const response=await studio(new Request(`http://${req.headers.host}${req.url}`,{method:req.method,headers,body,signal:controller.signal}));
    const data=Buffer.from(await response.arrayBuffer());
    if(!res.destroyed){res.writeHead(response.status,Object.fromEntries(response.headers));res.end(data);}
  } finally {res.off('close',closed);}
}
const STUDIO_BODY=70000,JOB_BODY=524288;
export function createContinuityApp({config=readConfig(),fetchImpl=globalThis.fetch,mockImpl=mockAdvice,guideImpl=mockGuidance,studio=null}={}) {
  const limiter=createLimiter(config);
  const server=createServer(async(req,res)=>{
    // Same localhost-only development boundary as the existing app; no CORS or public deployment.
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Content-Security-Policy',"default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'; form-action 'self'; base-uri 'none'; object-src 'none'");
    try {
      const hosts=[`127.0.0.1:${req.socket.localPort}`,`localhost:${req.socket.localPort}`];
      if(!hosts.includes(req.headers.host))throw new ApiError('FORBIDDEN_ORIGIN',403);
      const path=(req.url ?? '').split('?')[0];
      if(studio&&path.startsWith('/api/studio/')){await serveStudio(req,res,studio,path);return;}
      if(req.method==='GET' && path==='/api/config') {
        json(res,200,{mode:config.mode,configured:config.mode==='mock'||!!config.apiKey,paidEnabled:config.mode==='deepseek'&&config.allowPaid,scope:'local-development-only',feature:'idea015-continuity'});return;
      }
      // GUIDE097: /api/guidance uses the same origin/header checks, size limit, paid opt-in, limiter and provider transport.
      const guide=path==='/api/guidance';
      if(req.method==='POST' && (path==='/api/continuity'||guide)) {
        if(!hosts.map(h=>`http://${h}`).includes(req.headers.origin)||req.headers['sec-fetch-site']==='cross-site'||req.headers['x-agentflow-request']!=='1')throw new ApiError('FORBIDDEN_ORIGIN',403);
        if(req.headers['content-type']?.split(';')[0].trim()!=='application/json')throw new ApiError('INVALID_CONTENT_TYPE',415);
        const request=await body(req,guide?validateGuideRequest:validateRequest);
        if(config.mode==='deepseek'&&!config.apiKey)throw new ApiError('AI_NOT_CONFIGURED',503);
        if(config.mode==='deepseek'&&!config.allowPaid)throw new ApiError('PAID_CALLS_DISABLED',503);
        const release=limiter.acquire(request.ticket.requestId),controller=new AbortController();
        const disconnected=()=>{if(!res.writableEnded)controller.abort();};res.on('close',disconnected);
        try {
          if(guide) {
            const reply=config.mode==='mock'?validateGuideReply(await guideImpl(request),request):await callGuidance(request,config,{fetchImpl,signal:controller.signal});
            if(!res.destroyed)json(res,200,{mode:config.mode,ticket:request.ticket,reply});
          } else {
            const advice=config.mode==='mock'?validateAdvice(await mockImpl(request),request.bases.map(b=>b.id),request):
              await callContinuity(request,config,{fetchImpl,signal:controller.signal});
            if(!res.destroyed)json(res,200,{mode:config.mode,ticket:request.ticket,advice});
          }
        } finally {release();res.off('close',disconnected);}return;
      }
      if(req.method!=='GET'&&req.method!=='HEAD')throw new ApiError('METHOD_NOT_ALLOWED',405);
      const {file,data}=await readPublicFile(root,path);
      res.writeHead(200,{'Content-Type':mime[extname(file)],'Content-Length':data.length});res.end(req.method==='HEAD'?undefined:data);
    } catch(e) {
      const error=e?.name==='ContextError'?new ApiError('INVALID_RESPONSE',502):safeError(e);
      if(!res.destroyed&&!res.headersSent){if(error.retryAfter)res.setHeader('Retry-After',String(error.retryAfter));json(res,error.status,{error:{code:error.code}});}
    }
  });
  server.requestTimeout=10000;server.headersTimeout=5000;server.keepAliveTimeout=5000;
  return server;
}
