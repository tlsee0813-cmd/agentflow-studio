import { spawn } from 'node:child_process';
import { ApiError } from '../../server/errors.mjs';
// Optional EVALUATION-ONLY transport for proxies/Network-secret placeholders.
// No global dispatcher changes, TLS bypass, retries, redirect following or credential argv.
const escape = s => String(s).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\r/g,'\\r').replace(/\n/g,'\\n');
export function createCurlFetch({env=process.env, requireProxy=true, timeoutMs=15000, testOrigin=null}={}) {
  const proxy=env.https_proxy || env.HTTPS_PROXY;
  if (requireProxy && !proxy) throw new Error('PROXY_REQUIRED');
  if (proxy) {let p;try {p=new URL(proxy);}catch {throw new Error('PROXY_CONFIG_INVALID');}
    if (!['http:','https:'].includes(p.protocol) || p.search || p.hash) throw new Error('PROXY_CONFIG_INVALID');}
  // Restrict subprocess inheritance to necessary execution, trust and proxy config.
  const childEnv={};
  for (const k of ['PATH','Path','SystemRoot','SYSTEMROOT','WINDIR','TMP','TEMP','TMPDIR','LD_LIBRARY_PATH']) if(env[k]) childEnv[k]=env[k];
  return async (url,init={}) => {
    let u;try {u=new URL(url);}catch {throw new ApiError('AI_NETWORK_ERROR',503);}
    const localTest=testOrigin && u.origin===testOrigin && ['127.0.0.1','localhost'].includes(u.hostname);
    if (!localTest && (u.protocol!=='https:' || u.hostname!=='api.deepseek.com' || (u.port && u.port!=='443') || u.username || u.password
      || u.search || u.hash || !['/models','/chat/completions','/v1/chat/completions'].includes(u.pathname))) throw new Error('INVALID_EVAL_OPTIONS');
    const method=init.method ?? 'GET'; if(!['GET','POST'].includes(method)) throw new Error('INVALID_EVAL_OPTIONS');
    if(init.signal?.aborted) throw new ApiError('CANCELLED',499);
    const lines=[`url = "${escape(u.href)}"`,`request = "${method}"`,'silent','show-error','retry = 0',
      `max-time = ${timeoutMs/1000}`,'max-filesize = 131072',`proto = "=${localTest?'http,https':'https'}"`,
      'write-out = "\\nAFS_HTTP_STATUS:%{http_code}"'];
    // -q must be first: do not read a developer's .curlrc.
    // Proxy, CA path and authentication header live only in stdin, never command argv.
    if(proxy) lines.push(`proxy = "${escape(proxy)}"`,'noproxy = ""');
    else lines.push('proxy = ""');
    const ca=env.CURL_CA_BUNDLE || env.SSL_CERT_FILE || env.NODE_EXTRA_CA_CERTS;
    if(ca) lines.push(`cacert = "${escape(ca)}"`);
    for(const [k,v] of new Headers(init.headers).entries()) {
      if(!['authorization','content-type'].includes(k)) throw new Error('INVALID_EVAL_OPTIONS');
      lines.push(`header = "${escape(`${k}: ${v}`)}"`);
    }
    if(init.body!==undefined) {
      if(typeof init.body!=='string'||Buffer.byteLength(init.body)>32768) throw new Error('INPUT_TOO_LARGE');
      lines.push(`data-binary = "${escape(init.body)}"`);
    }
    return await new Promise((resolve,reject)=>{
      const child=spawn('curl',['-q','--config','-'],{env:childEnv,stdio:['pipe','pipe','pipe'],windowsHide:true});
      let chunks=[],size=0,settled=false;
      const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);init.signal?.removeEventListener('abort',abort);error?reject(error):resolve(value);};
      const abort=()=>{child.kill();finish(new ApiError('CANCELLED',499));};
      const timer=setTimeout(()=>{child.kill();finish(new ApiError('AI_TIMEOUT',504));},timeoutMs+500);
      init.signal?.addEventListener('abort',abort,{once:true});
      child.on('error',()=>finish(new ApiError('AI_NETWORK_ERROR',503)));
      child.stdin.on('error',()=>{});
      child.stdout.on('data',b=>{size+=b.length;if(size>132096){child.kill();finish(new ApiError('INVALID_RESPONSE'));}else chunks.push(b);});
      child.stderr.resume(); // Never log stderr: it can contain URLs, proxy credentials or remote data.
      child.on('close',code=>{
        if(code!==0) return finish(new ApiError(code===28?'AI_TIMEOUT':'AI_NETWORK_ERROR',code===28?504:503));
        const text=Buffer.concat(chunks).toString('utf8'); const marker=text.lastIndexOf('\nAFS_HTTP_STATUS:');
        const status=Number(text.slice(marker+17));
        if(marker<0||!Number.isInteger(status)||status<200||status>599) return finish(new ApiError('AI_NETWORK_ERROR',503));
        const body=text.slice(0,marker);
        finish(null,new Response([204,205,304].includes(status)?null:body,{status}));
      });
      child.stdin.end(lines.join('\n')+'\n');
    });
  };
}
