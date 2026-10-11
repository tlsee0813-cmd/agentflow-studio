import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { CASES, prepareCase } from '../scripts/init005/cases.mjs';
import { runEvaluation, parseOptions, simulatedFetchFor, inspectState, validatePreflight, telemetryStopReason } from '../scripts/init005/run.mjs';
import { claimBatch, authorizeLive, scrub, writePrivateJson } from '../scripts/init005/safety.mjs';
import { LIMITS, costUsd, reservation } from '../scripts/init005/cost.mjs';
import { createCurlFetch } from '../scripts/init005/curl-fetch.mjs';
import { localProbe } from '../scripts/init005/preflight.mjs';
import { callDeepSeek, buildDeepSeekBody } from '../server/providers/deepseek.mjs';
import { readConfig } from '../server/config.mjs';
import { mockInterview } from '../server/providers/mock.mjs';
import { applyResponse } from '../dist/public/shared/project.js';
import { validateRequest } from '../dist/public/shared/validation.js';
const temporary = () => mkdtempSync(join(tmpdir(),'afs-eval-test-'));
const fixture = () => prepareCase(CASES[0]);
const config = () => ({...readConfig({AI_MODE:'deepseek'}),apiKey:'ONLY_TEST_CREDENTIAL_57',allowPaid:true});
const complete = (req, overrides={}) => new Response(JSON.stringify({model:'deepseek-flash',usage:{prompt_tokens:123,completion_tokens:45,total_tokens:168},
  choices:[{finish_reason:'stop',message:{content:JSON.stringify(mockInterview(req))}}],...overrides}),{status:200});

test('E01 all six fictional checkpoints conform to the real request and byte contracts', () => {
  assert.equal(CASES.length,6);
  for(const c of CASES){const f=prepareCase(c);assert.deepEqual(validateRequest(f.request),f.request);assert.equal(f.request.stage,c.phase);assert.ok(reservation(buildDeepSeekBody(f.request,config())).requestBytes<=32768);assert.ok(c.expected.length&&c.failure.length);}
  assert.ok(CASES[4].input.length>800 && CASES[4].input.length<=1500);
  for(const v of ['unknown','deferred'])assert.equal(prepareCase(CASES[2],v).request.answers.at(-1).disposition,v);
  assert.ok(prepareCase(CASES[3]).state.conflicts.length>0);
});
test('E02 default mock and plan ignore ambient paid flags, key and global fetch', async () => {
  const dir=temporary(),original=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;throw new Error('MUST_NOT_CALL');};
  try {
    const env={DEEPSEEK_API_KEY:'DO_NOT_READ_OR_TRANSMIT',ALLOW_PAID_AI:'true'};
    for(const mode of ['mock','plan']){
      const out=await runEvaluation({mode,output:join(dir,mode)},{env});
      assert.equal(out.report.billedEndpointAttempts,0);assert.equal(out.report.cases.length,6);
      assert.equal(out.report.simulatedAttempts,mode==='mock'?6:0);
      assert.ok(out.report.cases.every(c=>c.humanReview.status==='pending'));
      assert.ok(!JSON.stringify(out.report).includes(env.DEEPSEEK_API_KEY));
    }
    assert.equal(calls,0);
  } finally {globalThis.fetch=original;rmSync(dir,{recursive:true,force:true});}
});
test('E03 six attempt cap, strictly sequential dispatch, no implicit retry', async () => {
  const dir=temporary();let calls=0,active=0,maxActive=0;
  try {const out=await runEvaluation({output:dir},{mockFactory:req=>async()=>{calls++;active++;maxActive=Math.max(maxActive,active);await new Promise(r=>setTimeout(r,5));active--;return complete(req);}});
    assert.equal(calls,6);assert.equal(maxActive,1);assert.equal(out.report.stopReason,null);
    assert.ok(out.report.reservedUsd<0.12);
    await assert.rejects(runEvaluation({limit:7,output:join(dir,'invalid')}),/INVALID_EVAL_OPTIONS/);
    assert.equal(calls,6);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
for(const [status,code] of [[401,'AI_AUTH_FAILED'],[402,'AI_BALANCE_REQUIRED'],[429,'AI_RATE_LIMIT'],[503,'AI_UNAVAILABLE']]){
  test(`E04 HTTP ${status} records sanitized error and stops after one attempt`,async()=>{
    const dir=temporary();let calls=0;
    try{const out=await runEvaluation({output:dir},{mockFactory:()=>async()=>{calls++;return new Response('Bearer never-log-this-credential',{status});}});
      assert.equal(calls,1);assert.equal(out.report.stopReason,code);assert.equal(out.report.cases[0].errorDataPreserved,true);
      assert.equal(out.report.cases[0].telemetry.httpStatus,status);
      assert.ok(!readFileSync(join(dir,'report.json'),'utf8').includes('never-log'));
    }finally{rmSync(dir,{recursive:true,force:true});}
  });
}
test('E05 rejected response stops the batch and never replaces saved requirements',async()=>{
  const dir=temporary();let calls=0;
  try{const out=await runEvaluation({output:dir},{mockFactory:()=>async()=>{calls++;return new Response('{bad',{status:200});}});
    assert.equal(calls,1);assert.equal(out.report.stopReason,'INVALID_RESPONSE');assert.equal(out.report.cases[0].errorDataPreserved,true);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('E06 explicit live gates cannot be replaced by an ambient API key or --live alone',()=>{
  const opts={live:true,approve:'INIT005-SIX-CALLS',credential:'direct-secret',transport:'native'};
  const env={ALLOW_PAID_AI:'true',AFS_EVAL_APPROVED_USD:'0.12',AFS_PRICE_RECHECKED:'true',DEEPSEEK_API_KEY:'synthetic-only'};
  for(const field of ['ALLOW_PAID_AI','AFS_EVAL_APPROVED_USD','AFS_PRICE_RECHECKED'])assert.throws(()=>authorizeLive(opts,{...env,[field]:''}),/LIVE_NOT_AUTHORIZED/);
  assert.throws(()=>authorizeLive({...opts,approve:null},env),/LIVE_NOT_AUTHORIZED/);
  assert.throws(()=>authorizeLive({...opts,live:false},env),/LIVE_NOT_AUTHORIZED/);
  assert.throws(()=>authorizeLive(opts,{...env,DEEPSEEK_API_KEY:''}),/AI_NOT_CONFIGURED/);
  assert.throws(()=>authorizeLive(opts,{...env,NODE_TLS_REJECT_UNAUTHORIZED:'0'}),/TLS_UNVERIFIED/);
  assert.throws(()=>authorizeLive({...opts,credential:'network-secret'},env),/PROXY_REQUIRED/);
  assert.doesNotThrow(()=>authorizeLive(opts,env)); // Authorization function only: NO live runner call.
});
test('E07 persistent exclusive claim blocks duplicate batches and does not auto-resume',()=>{
  const dir=temporary();try {claimBatch(dir);assert.throws(()=>claimBatch(dir),/BATCH_ALREADY_STARTED/);assert.equal(readFileSync(join(dir,'run.lock'),'utf8'),'');}finally{rmSync(dir,{recursive:true,force:true});}
});
test('E08 preflight must match transport/runtime/host/recency and cannot claim authentication',()=>{
  const dir=temporary(),p=join(dir,'probe.json');
  const valid={kind:'keyless-external-probe',transport:'native',node:'v22.16.0',target:'https://api.deepseek.com/models',reachedHttp:true,checkedAt:new Date().toISOString(),authSent:false};
  try{writePrivateJson(p,valid);assert.doesNotThrow(()=>validatePreflight(p,'native'));
    for(const change of [{authSent:true},{node:'v24.19.0'},{checkedAt:'2020-01-01'},{reachedHttp:false},{transport:'curl-proxy'},{target:'https://example.com'}]){
      writePrivateJson(p,{...valid,...change});assert.throws(()=>validatePreflight(p,'native'),/NETWORK_PROBE_FAILED/);
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('E09 telemetry records returned model, tokens, finish reason and latency without changing result contract',async()=>{
  const {request}=fixture(),c=config();const records=[];let body;
  const result=await callDeepSeek(request,c,{fetchImpl:async(u,i)=>{body=JSON.parse(i.body);return complete(request);},onTelemetry:t=>records.push(t)});
  assert.deepEqual(result,mockInterview(request));assert.deepEqual(body,buildDeepSeekBody(request,c));
  assert.equal(records.length,1);assert.equal(records[0].returnedModel,'deepseek-flash');assert.equal(records[0].usage.prompt_tokens,123);
  assert.equal(records[0].usage.completion_tokens,45);assert.equal(records[0].finishReason,'stop');assert.ok(records[0].elapsedMs>=0);
  assert.ok(!JSON.stringify(records).includes(c.apiKey));assert.ok(!JSON.stringify(body).includes(c.apiKey));
});
test('E10 telemetry is available for truncation errors and does not claim a configured model is the actual model',async()=>{
  const {request}=fixture(),records=[];
  await assert.rejects(callDeepSeek(request,config(),{fetchImpl:async()=>complete(request,{model:'provider-different-model',choices:[{finish_reason:'length',message:{content:'{}'}}]}),onTelemetry:t=>records.push(t)}),/INVALID_RESPONSE/);
  assert.equal(records[0].returnedModel,'provider-different-model');assert.equal(records[0].finishReason,'length');assert.equal(records[0].usage.total_tokens,168);
  const absent=[];await callDeepSeek(request,config(),{fetchImpl:async()=>complete(request,{model:null,usage:null}),onTelemetry:t=>absent.push(t)});
  assert.equal(absent[0].returnedModel,null);assert.equal(absent[0].usage.prompt_tokens,null);
});
test('E11 malicious model fields, error text and observer exceptions do not leak a key or cause retry',async()=>{
  const {request}=fixture(),c=config(),records=[];let calls=0;
  await callDeepSeek(request,c,{fetchImpl:async()=>{calls++;return complete(request,{model:c.apiKey});},onTelemetry:t=>{records.push(t);throw new Error('observer error');}});
  assert.equal(calls,1);assert.equal(records[0].returnedModel,null);assert.ok(!JSON.stringify(records).includes(c.apiKey));
  const failing=[];
  await assert.rejects(callDeepSeek(request,c,{fetchImpl:async()=>{throw new Error(`credential ${c.apiKey}`);},onTelemetry:t=>failing.push(t)}),/AI_NETWORK_ERROR/);
  assert.ok(!JSON.stringify(failing).includes(c.apiKey));
});
test('E12 timeout and cancellation preserve one safe telemetry record without retry',async()=>{
  const {request}=fixture();let calls=0;const records=[];
  await assert.rejects(callDeepSeek(request,{...config(),timeoutMs:20},{fetchImpl:async()=>{calls++;return await new Promise(()=>{});},onTelemetry:t=>records.push(t)}),/AI_TIMEOUT/);
  assert.equal(calls,1);assert.equal(records.length,1);assert.equal(records[0].outcome,'AI_TIMEOUT');
  const controller=new AbortController();controller.abort();
  await assert.rejects(callDeepSeek(request,config(),{signal:controller.signal,fetchImpl:async()=>{calls++;},onTelemetry:t=>records.push(t)}),/CANCELLED/);
  assert.equal(calls,1);assert.equal(records[1].outcome,'CANCELLED');
});
test('E13 source/status injection is rejected by the actual adapter, not just a fixture string check',async()=>{
  const f=prepareCase(CASES[5]),result=mockInterview(f.request);result.proposals[0].status='confirmed';
  await assert.rejects(callDeepSeek(f.request,config(),{fetchImpl:async()=>complete(f.request,{choices:[{finish_reason:'stop',message:{content:JSON.stringify(result)}}]})}),/INVALID_RESPONSE/);
  delete result.proposals[0].status;result.proposals[0].sourceIds=['S-OTHER'];
  await assert.rejects(callDeepSeek(f.request,config(),{fetchImpl:async()=>complete(f.request,{choices:[{finish_reason:'stop',message:{content:JSON.stringify(result)}}]})}),/INVALID_RESPONSE/);
});
test('E14 valid JSON and preserved state are NOT a quality pass: long-answer mock retains TBD acceptance',async()=>{
  const f=prepareCase(CASES[4]);const result=mockInterview(f.request);
  const after=applyResponse(f.state,f.request,{mode:'mock',result});const judged=inspectState(f.state,after,f.request,result);
  assert.equal(judged.pass,true);assert.equal(judged.refinementSignals.acceptanceStillTbd,true);
  assert.equal(judged.refinementSignals.acceptanceChanged,false); // Negative quality-control example, NOT success criterion for live AI.
});
test('E15 reserve uses peak/no-cache, rejects oversize complete bodies, includes output and six attempts',()=>{
  assert.equal(costUsd(40000,4096),0.0169152);assert.ok(Math.abs(costUsd(40000,4096)*6-0.1014912)<1e-12);
  assert.ok(costUsd(40000,4096)*6<LIMITS.budgetUsd);assert.throws(()=>reservation({input:'가'.repeat(20000)}),/INPUT_TOO_LARGE/);
});
test('E16 safe files redact credentials, auth headers and bearer text; ignore unknown errors',()=>{
  const dir=temporary(),path=join(dir,'safe.json'),secret='local-test-secret-only';
  try{writePrivateJson(path,{headers:{Authorization:secret},note:`${secret} Bearer abc123`,Authorization:secret},[secret]);
    const saved=readFileSync(path,'utf8');assert.ok(!saved.includes(secret));assert.ok(!saved.includes('abc123'));assert.ok(!saved.includes('Authorization'));
    if(process.platform!=='win32')assert.equal(statSync(path).mode&0o777,0o600);
    assert.equal(scrub({key:secret},[secret]).key,'[REDACTED]');
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('E17 CLI rejects hidden transports, excessive calls and paid output-path reset',()=>{
  assert.equal(parseOptions([]).mode,'mock');
  for(const args of [['--limit=7'],['--limit=0'],['--live','--mock'],['--transport=other'],['--live','--output=new'],['--api-key=never']])assert.throws(()=>parseOptions(args),/INVALID_EVAL_OPTIONS/);
});
test('E18 HTTPS CONNECT rehearsal verifies TLS and exact Korean POST body without any API key',async()=>{
  const r=await localProbe();assert.equal(r.authSent,false);assert.equal(r.nativeStatus,200);assert.equal(r.curlStatus,200);
  assert.equal(r.tlsVerified,true);assert.equal(r.bodyMatches,true);assert.equal(r.curlProxyConnects,1);
  if(process.version==='v22.16.0')assert.equal(r.nativeProxyConnects,0);
});
test('E19 curl transport never follows a redirect to another host and rejects arbitrary production endpoints',async()=>{
  let requests=0;const server=createServer((req,res)=>{requests++;res.writeHead(302,{Location:'https://invalid.example/steal'});res.end();});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
  try{const transport=createCurlFetch({requireProxy:false,env:{PATH:process.env.PATH,Path:process.env.Path,SystemRoot:process.env.SystemRoot},testOrigin:origin});
    const r=await transport(origin);assert.equal(r.status,302);assert.equal(requests,1);
    await assert.rejects(transport('https://invalid.example/steal'),/INVALID_EVAL_OPTIONS/);
  }finally{await new Promise(r=>{server.close(r);server.closeAllConnections();});}
});

test('E20 live batch stops on missing telemetry, model mismatch or token reservation overrun',()=>{
  const t={returnedModel:'deepseek-flash',usage:{prompt_tokens:1000,completion_tokens:1000}};
  assert.equal(telemetryStopReason(t,'deepseek-flash'),null);
  assert.equal(telemetryStopReason(null,'deepseek-flash'),'TELEMETRY_INCOMPLETE');
  assert.equal(telemetryStopReason({...t,returnedModel:'unexpected-model'},'deepseek-flash'),'MODEL_CHANGED');
  assert.equal(telemetryStopReason({...t,usage:{prompt_tokens:40001,completion_tokens:1000}},'deepseek-flash'),'INPUT_RESERVE_EXCEEDED');
  assert.equal(telemetryStopReason({...t,usage:{prompt_tokens:1000,completion_tokens:4097}},'deepseek-flash'),'OUTPUT_CAP_EXCEEDED');
});

// Fixtures below exercise the local recency gate, not external connectivity.
test('E21 preflight rejects missing, non-string, malformed and normalized invalid timestamps',t=>{
  const dir=temporary(),path=join(dir,'probe.json');
  t.mock.method(Date,'now',()=>Date.parse('2026-03-01T12:00:00.000Z'));
  const base={kind:'keyless-external-probe',transport:'native',node:'v22.16.0',
    target:'https://api.deepseek.com/models',reachedHttp:true,authSent:false};
  const invalid=[undefined,null,0,{},[],true,'','not-a-date','2026-03-01',
    '2026-03-01T11:00:00','2026-03-01T11:00:00Z','2026-03-01T11:00:00.000+00:00',
    ' 2026-03-01T11:00:00.000Z','2026-03-01T11:00:00.000Z\n',
    '2026-02-29T12:00:00.000Z','2026-02-30T12:00:00.000Z','2026-13-01T00:00:00.000Z',
    '2026-03-01T24:00:00.000Z','2026-03-01T11:60:00.000Z'];
  try {
    for(const checkedAt of invalid){
      writeFileSync(path,JSON.stringify({...base,checkedAt}));
      assert.throws(()=>validatePreflight(path,'native'),/^Error: NETWORK_PROBE_FAILED$/,
        `Malformed timestamp must fail: ${JSON.stringify(checkedAt)}`);
    }
    for(const body of ['null','[]','{}','{invalid-json']){
      writeFileSync(path,body);assert.throws(()=>validatePreflight(path,'native'),/^Error: NETWORK_PROBE_FAILED$/);
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('E22 preflight admits only a real UTC timestamp with age from zero through exactly 24 hours',t=>{
  const dir=temporary(),path=join(dir,'probe.json'),now=Date.parse('2026-10-10T12:00:00.000Z');
  t.mock.method(Date,'now',()=>now);
  const base={kind:'keyless-external-probe',node:'v22.16.0',
    target:'https://api.deepseek.com/models',reachedHttp:true,authSent:false};
  try {
    for(const transport of ['native','curl-proxy'])for(const age of [-3600000,-1,0,1,3600000,86399999,86400000,86400001,90000000]){
      writePrivateJson(path,{...base,transport,checkedAt:new Date(now-age).toISOString()});
      if(age>=0&&age<=86400000) assert.doesNotThrow(()=>validatePreflight(path,transport));
      else assert.throws(()=>validatePreflight(path,transport),/^Error: NETWORK_PROBE_FAILED$/);
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('E23 preflight does not accept a non-finite elapsed age',t=>{
  const dir=temporary(),path=join(dir,'probe.json');
  writePrivateJson(path,{kind:'keyless-external-probe',transport:'native',node:'v22.16.0',
    target:'https://api.deepseek.com/models',reachedHttp:true,authSent:false,checkedAt:'2026-10-10T11:00:00.000Z'});
  try {
    for(const now of [NaN,Infinity,-Infinity]){
      t.mock.method(Date,'now',()=>now);
      assert.throws(()=>validatePreflight(path,'native'),/^Error: NETWORK_PROBE_FAILED$/);
      t.mock.restoreAll();
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('E24 local TLS uses its own public config even when OpenSSL default is unavailable; child env stays allowlisted',async t=>{
  const {default:childProcess}=await import('node:child_process');
  const {syncBuiltinESMExports}=await import('node:module');
  const {promisify}=await import('node:util');
  const {existsSync}=await import('node:fs');
  const dir=temporary(),missing=join(dir,'absent-default-openssl.cnf');
  const saved={OPENSSL_CONF:process.env.OPENSSL_CONF,AFS_TEST_PRIVATE_SENTINEL:process.env.AFS_TEST_PRIVATE_SENTINEL};
  process.env.OPENSSL_CONF=missing;
  process.env.AFS_TEST_PRIVATE_SENTINEL='synthetic-environment-value-not-a-provider-key';
  const realExecFile=childProcess.execFile,observed=[];
  // Intercept only to impose the missing-default condition on real OpenSSL.
  // We do not mock its success: certificate creation, TLS and CONNECT really run.
  const intercepted=(command,args,options,callback)=>{
    assert.equal(Object.hasOwn(options.env,'AFS_TEST_PRIVATE_SENTINEL'),false);
    assert.equal(Object.hasOwn(options.env,'DEEPSEEK_API_KEY'),false);
    assert.equal(Object.hasOwn(options.env,'OPENSSL_CONF'),false);
    if(command==='openssl'){
      const position=args.indexOf('-config'),path=position<0?null:args[position+1];
      observed.push({path,text:path?readFileSync(path,'utf8'):null});
      return realExecFile(command,args,{...options,env:{...options.env,OPENSSL_CONF:missing}},callback);
    }
    return realExecFile(command,args,options,callback);
  };
  intercepted[promisify.custom]=(...args)=>new Promise((resolve,reject)=>{
    intercepted(...args,(error,stdout,stderr)=>error?reject(error):resolve({stdout,stderr}));
  });
  childProcess.execFile=intercepted;syncBuiltinESMExports();
  try {
    const {localProbe:probe}=await import('../scripts/init005/preflight.mjs?missing-default-regression');
    const result=await probe();
    assert.equal(observed.length,1);
    assert.match(observed[0].text,/^\[req\]\ndistinguished_name = req_distinguished_name\n\[req_distinguished_name\]\n$/);
    assert.equal(result.nativeStatus,200);assert.equal(result.curlStatus,200);
    assert.equal(result.authSent,false);assert.equal(result.tlsVerified,true);
    assert.equal(result.bodyMatches,true);assert.equal(result.curlProxyConnects,1);
    assert.equal(existsSync(observed[0].path),false,'temporary config is removed after probe');
  }finally{
    childProcess.execFile=realExecFile;syncBuiltinESMExports();
    for(const [k,v] of Object.entries(saved))if(v===undefined)delete process.env[k];else process.env[k]=v;
    rmSync(dir,{recursive:true,force:true});
  }
});
