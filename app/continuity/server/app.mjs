import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { extname } from 'node:path';
import { readFile } from 'node:fs/promises';
import { readConfig } from '../../server/config.mjs';
import { ApiError, safeError } from '../../server/errors.mjs';
import { abortOnClose, assertLocalHost, assertLocalPost, readBody, readJson, sendError, sendJson, setLocalTimeouts, setSecurityHeaders, STATIC_TYPES } from './http.mjs';
import { readPublicFile } from '../../server/static-files.mjs';
import { createLimiter } from '../../server/limiter.mjs';
import { validateRequest, validateAdvice, validateGuideRequest, validateGuideReply } from '../dist/public/shared/validation.js';
import { REQUEST_BYTES } from '../dist/public/shared/types.js';
import { mockAdvice, mockGuidance } from './mock.mjs';
import { callContinuity, callGuidance } from './provider.mjs';
import { JOB_BYTES, CONNECTOR_BYTES } from './studio.mjs';
const root=fileURLToPath(new URL('../dist/public/',import.meta.url));
const FONT_FILES=new Set(['/fonts/PretendardVariable.woff2','/fonts/LICENSE-Pretendard.txt']);
// Outer limits for /api/studio/*: a little above the handler's own ASK_BYTES (65536), so the handler answers an oversize ask
// itself; a job submission carries the whole input and reads up to JOB_BYTES.
const STUDIO_BODY=70000;
const studioBodyLimit=path=>path==='/api/studio/jobs'?JOB_BYTES:path.startsWith('/api/studio/connector/')?CONNECTOR_BYTES:STUDIO_BODY;
// Context errors (the advice contract) are a provider reply that broke the contract; everything else maps as usual.
const continuityError=e=>e?.name==='ContextError'?new ApiError('INVALID_RESPONSE',502):safeError(e);
async function readValid(req,validate) {
  const raw=await readJson(req,REQUEST_BYTES);
  try{return validate(raw);}catch{throw new ApiError('INVALID_INPUT',400);}
}
// Studio API (fetch handler) behind the same localhost host check. The body is read with its own limit and handed over as a
// standard Request; the handler applies its own origin/header rules on top.
async function serveStudio(req,res,studio,path) {
  const controller=new AbortController(),detach=abortOnClose(res,controller);
  try {
    const body=req.method==='POST'?await readBody(req,studioBodyLimit(path)):undefined;
    const headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(v!==undefined)headers.set(k,Array.isArray(v)?v.join(', '):v);
    const response=await studio(new Request(`http://${req.headers.host}${req.url}`,{method:req.method,headers,body,signal:controller.signal}));
    const data=Buffer.from(await response.arrayBuffer());
    if(!res.destroyed){res.writeHead(response.status,Object.fromEntries(response.headers));res.end(data);}
  } finally {detach();}
}
export function createContinuityApp({config=readConfig(),fetchImpl=globalThis.fetch,mockImpl=mockAdvice,guideImpl=mockGuidance,studio=null}={}) {
  const limiter=createLimiter(config);
  const server=createServer(async(req,res)=>{
    // Same localhost-only development boundary as the existing app; no CORS or public deployment.
    setSecurityHeaders(res);
    try {
      const hosts=assertLocalHost(req);
      const path=(req.url ?? '').split('?')[0];
      if(studio&&path.startsWith('/api/studio/')){await serveStudio(req,res,studio,path);return;}
      if(req.method==='GET' && path==='/api/config') {
        sendJson(res,200,{mode:config.mode,configured:config.mode==='mock'||!!config.apiKey,paidEnabled:config.mode==='deepseek'&&config.allowPaid,scope:'local-development-only',feature:'idea015-continuity'});return;
      }
      // GUIDE097: /api/guidance uses the same origin/header checks, size limit, paid opt-in, limiter and provider transport.
      const guide=path==='/api/guidance';
      if(req.method==='POST' && (path==='/api/continuity'||guide)) {
        assertLocalPost(req,hosts);
        const request=await readValid(req,guide?validateGuideRequest:validateRequest);
        if(config.mode==='deepseek'&&!config.apiKey)throw new ApiError('AI_NOT_CONFIGURED',503);
        if(config.mode==='deepseek'&&!config.allowPaid)throw new ApiError('PAID_CALLS_DISABLED',503);
        const release=limiter.acquire(request.ticket.requestId),controller=new AbortController(),detach=abortOnClose(res,controller);
        try {
          if(guide) {
            const reply=config.mode==='mock'?validateGuideReply(await guideImpl(request),request):await callGuidance(request,config,{fetchImpl,signal:controller.signal});
            if(!res.destroyed)sendJson(res,200,{mode:config.mode,ticket:request.ticket,reply});
          } else {
            const advice=config.mode==='mock'?validateAdvice(await mockImpl(request),request.bases.map(b=>b.id),request):
              await callContinuity(request,config,{fetchImpl,signal:controller.signal});
            if(!res.destroyed)sendJson(res,200,{mode:config.mode,ticket:request.ticket,advice});
          }
        } finally {release();detach();}return;
      }
      if(req.method!=='GET'&&req.method!=='HEAD')throw new ApiError('METHOD_NOT_ALLOWED',405);
      // The bundled UI font and its licence: two fixed names, read from this build only (the shared static reader keeps its own list).
      const {file,data}=FONT_FILES.has(path)?{file:`${root}${path.slice(1)}`,data:await readFile(new URL(`../dist/public${path}`,import.meta.url)).catch(()=>{throw new ApiError('NOT_FOUND',404);})}:await readPublicFile(root,path);
      res.writeHead(200,{'Content-Type':STATIC_TYPES[extname(file)],'Content-Length':data.length});res.end(req.method==='HEAD'?undefined:data);
    } catch(e) { sendError(res,e,continuityError); }
  });
  return setLocalTimeouts(server);
}
