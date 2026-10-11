import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer as createHttpsServer } from 'node:https';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileAsync=promisify(execFile);
import { createCurlFetch } from './curl-fetch.mjs';
import { writePrivateJson, safeCode } from './safety.mjs';
export async function localProbe() {
  // Ephemeral local certificate, not a DeepSeek/customer key. No -k / TLS bypass.
  const dir=mkdtempSync(join(tmpdir(),'afs-keyless-tls-'));
  const cert=join(dir,'cert.pem'),key=join(dir,'key.pem'),config=join(dir,'public-openssl.cnf');
  const utilityEnv={};for(const k of ['PATH','Path','SystemRoot','SYSTEMROOT','WINDIR','TMP','TEMP','TMPDIR','LD_LIBRARY_PATH'])if(process.env[k])utilityEnv[k]=process.env[k];
  let origin,proxy;const sockets=new Set();let connects=0,requests=0,authReceived=false,postBody=null;
  try {
    // Own public config: no system default or caller OPENSSL_CONF dependency.
    // Keep the child environment allowlist; never forward provider secrets.
    writeFileSync(config,'[req]\ndistinguished_name = req_distinguished_name\n[req_distinguished_name]\n',{encoding:'utf8',mode:0o600,flag:'wx'});
    await execFileAsync('openssl',['req','-config',config,'-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,
      '-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1'],{timeout:10000,env:utilityEnv});
    origin=createHttpsServer({key:readFileSync(key),cert:readFileSync(cert)},(req,res)=>{
      requests++;authReceived ||= Boolean(req.headers.authorization);
      const chunks=[];req.on('data',b=>chunks.push(b));req.on('end',()=>{
        if(req.method==='POST')postBody=Buffer.concat(chunks).toString('utf8');
        res.writeHead(200,{'Content-Type':'application/json'});res.end('{"keyless":true}');
      });
    });
    await new Promise(r=>origin.listen(0,'127.0.0.1',r));
    const target=`https://127.0.0.1:${origin.address().port}`;
    proxy=createServer((req,res)=>{res.writeHead(405);res.end();});
    proxy.on('connect',(req,client,head)=>{
      connects++;authReceived ||= Boolean(req.headers.authorization || req.headers['proxy-authorization']);
      if(req.url!==`127.0.0.1:${origin.address().port}`){client.destroy();return;}
      const upstream=connect(origin.address().port,'127.0.0.1',()=>{
        client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if(head.length)upstream.write(head);client.pipe(upstream);upstream.pipe(client);
      });
      for(const socket of [client,upstream]){sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.on('error',()=>{client.destroy();upstream.destroy();});}
    });
    await new Promise(r=>proxy.listen(0,'127.0.0.1',r));
    const address=`http://127.0.0.1:${proxy.address().port}`;
    const env={};for(const k of ['PATH','Path','SystemRoot','SYSTEMROOT','WINDIR','TMP','TEMP','TMPDIR','LD_LIBRARY_PATH'])if(process.env[k])env[k]=process.env[k];
    Object.assign(env,{HTTPS_PROXY:address,HTTP_PROXY:address,https_proxy:address,http_proxy:address,
      NO_PROXY:'',no_proxy:'',NODE_EXTRA_CA_CERTS:cert,CURL_CA_BUNDLE:cert});
    let nativeStatus=null,nativeError=null;
    try {
      // A separate exact-node child reads CA config at startup. No credential env inherited.
      const script=`fetch(${JSON.stringify(target)},{signal:AbortSignal.timeout(3000)}).then(async r=>{await r.text();console.log(JSON.stringify({status:r.status}));}).catch(()=>{console.log(JSON.stringify({error:'AI_NETWORK_ERROR'}));process.exitCode=1;});`;
      const got=await execFileAsync(process.execPath,['-e',script],{env,timeout:5000});
      nativeStatus=JSON.parse(got.stdout.trim()).status;
    } catch {nativeError='AI_NETWORK_ERROR';}
    const nativeProxyConnects=connects;
    const fetchImpl=createCurlFetch({env,requireProxy:true,testOrigin:target,timeoutMs:3000});
    const expected=JSON.stringify({input:'한글 "인용"\n다음 줄',keyless:true});
    const r=await fetchImpl(target,{method:'POST',headers:{'Content-Type':'application/json'},body:expected});
    const body=await r.json();
    return {kind:'local-keyless-proxy-rehearsal',protocol:'HTTPS via HTTP CONNECT',node:process.version,
      nativeStatus,nativeError,nativeProxyConnects,curlStatus:r.status,curlProxyConnects:connects-nativeProxyConnects,
      tlsVerified:true,bodyMatches:body.keyless===true&&postBody===expected,originRequests:requests,authSent:authReceived,
      interpretation:'Local TLS/CONNECT and POST-body rehearsal only. Does NOT prove Cloud access, CA trust there, Network-secret substitution or DeepSeek authentication.'};
  } finally {
    for(const socket of sockets)socket.destroy();
    for(const server of [proxy,origin])if(server)await new Promise(r=>{server.close(r);server.closeAllConnections();});
    rmSync(dir,{recursive:true,force:true});
  }
}
export async function externalProbe(transport,env=process.env) {
  if(!['native','curl-proxy'].includes(transport))throw new Error('INVALID_EVAL_OPTIONS');
  if(env.NODE_TLS_REJECT_UNAUTHORIZED==='0')throw new Error('TLS_UNVERIFIED');
  const target='https://api.deepseek.com/models',started=performance.now();
  const result={kind:'keyless-external-probe',checkedAt:new Date().toISOString(),node:process.version,target,transport,
    authSent:false,generationRequests:0,proxyConfigured:Boolean(env.https_proxy||env.HTTPS_PROXY),reachedHttp:false,httpStatus:null,error:null};
  // Deliberately never read DEEPSEEK_API_KEY, including Network-secret placeholders.
  try {const fetchImpl=transport==='native'?fetch:createCurlFetch({env,timeoutMs:8000});
    const r=await fetchImpl(target,{method:'GET',redirect:'error',signal:AbortSignal.timeout(8000)});
    result.httpStatus=r.status;result.reachedHttp=r.status===200||r.status===401;await r.body?.cancel();
    result.interpretation=result.reachedHttp?'HTTP reached; authentication/model/generation and proxy placeholder substitution remain unverified.':'HTTP response received but may be a proxy/policy error; inspect safe status only.';
  }catch(e){result.error={code:safeCode(e)==='INTERNAL_ERROR'?'AI_NETWORK_ERROR':safeCode(e),
      cause:['ENOTFOUND','EAI_AGAIN','ECONNREFUSED','ETIMEDOUT','UNABLE_TO_VERIFY_LEAF_SIGNATURE'].includes(e?.cause?.code)?e.cause.code:null};}
  result.elapsedMs=Math.round(performance.now()-started);return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const args=process.argv.slice(2);let result;
    if(!args.length)result=await localProbe();
    else if(args.length===2&&args[0]==='--external'&&/^--transport=(native|curl-proxy)$/.test(args[1]))result=await externalProbe(args[1].slice(12));
    else throw new Error('INVALID_EVAL_OPTIONS');
    const dir=resolve('eval-results');mkdirSync(dir,{recursive:true});const path=join(dir,result.kind==='keyless-external-probe'?`preflight-${result.transport}.json`:'preflight-local.json');
    writePrivateJson(path,result);console.log(JSON.stringify(result));
    if(result.kind==='keyless-external-probe'&&!result.reachedHttp)process.exitCode=1;
  } catch(e) {console.error(JSON.stringify({error:safeCode(e)}));process.exitCode=1;}
}
