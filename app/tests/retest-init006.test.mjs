import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, mkdirSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync, spawn } from 'node:child_process';
import { runDiagnostic, parseDiagnosticOptions, authorizeDiagnostic, codeFingerprint, legacyGuard, onceTransport, checkBudget, BUDGET_USD, EXPERIMENT_ID } from '../scripts/init006/run.mjs';
import { claimBatch } from '../scripts/init005/safety.mjs';
import { reservation } from '../scripts/init005/cost.mjs';
import { mockInterview } from '../server/providers/mock.mjs';
const temporary=t=>{const d=mkdtempSync(join(tmpdir(),'afs-init006-'));t.after(()=>rmSync(d,{recursive:true,force:true}));return d;};
const SECRET='SYNTHETIC_REPORT_CANARY_006';
const childEnv=Object.fromEntries(['PATH','Path','SystemRoot','SYSTEMROOT','TMP','TEMP','TMPDIR'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
const response=(req,mutate=()=>{})=>{const r=mockInterview(req);mutate(r);return new Response(JSON.stringify({model:SECRET,
  usage:{prompt_tokens:100,completion_tokens:50,total_tokens:150},choices:[{finish_reason:'stop',message:{content:JSON.stringify(r),reasoning_content:SECRET}}]}));};
test('I6R default plan and explicit mock ignore ambient secrets and global fetch',async t=>{
  const dir=temporary(t),original=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;throw new Error('NO_EXTERNAL_IO');};
  const env=new Proxy({}, {get(){throw new Error('FREE_MODE_READ_ENV');}});
  try {
    for(const mode of ['plan','mock']) {
      const report=await runDiagnostic({mode,output:join(dir,mode)},{env});
      assert.equal(report.paidAttempts,0);assert.equal(report.simulatedAttempts,mode==='mock'?1:0);
      assert.equal(report.caseId,'C2');assert.equal(report.experimentId,EXPERIMENT_ID);
      assert.equal(report.status,mode==='plan'?'planned':'validated');assert.equal(report.quality,'NOT_ASSESSED');
    }
    assert.equal(calls,0);assert.equal(parseDiagnosticOptions([]).mode,'plan');
  }finally{globalThis.fetch=original;}
});
test('I6R only C2 dispatched once, and report contains no raw result/request/state/unknown model',async t=>{
  const dir=temporary(t);let calls=0;
  const report=await runDiagnostic({mode:'mock',output:dir},{mockFactory:req=>async()=>{
    calls++;assert.equal(req.brief.tools,'claude-only');assert.match(req.brief.idea,/혼자 공부하는 대학생/);
    return response(req,r=>r.summary=SECRET);
  }});
  assert.equal(calls,1);assert.equal(report.status,'validated');assert.equal(report.telemetry.modelMatch,'different');
  const saved=readFileSync(join(dir,'report.json'),'utf8');assert.ok(!saved.includes(SECRET));
  for(const field of ['input','result','requirementsBefore','requirementsAfter','bodySha256','headers','reasoning_content','requestId','projectId']) assert.equal(Object.hasOwn(JSON.parse(saved),field),false);
  assert.equal(report.telemetry.usage.total_tokens,150);assert.ok(readFileSync(join(dir,'run.lock')).length===0);
  if(process.platform!=='win32')assert.equal(statSync(join(dir,'report.json')).mode&0o777,0o600);
});
test('I6R inner JSON and contract failures persist safe diagnostics, preservation, no retry or fallback',async t=>{
  const dir=temporary(t);let calls=0;
  for(const kind of ['syntax','contract','auth']) {
    const path=join(dir,kind);
    const report=await runDiagnostic({mode:'mock',output:path},{mockFactory:req=>async()=>{
      calls++;
      if(kind==='syntax')return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'{'+SECRET}}]}));
      if(kind==='auth')return new Response(SECRET,{status:401});
      return response(req,r=>{r.proposals[0].sourceIds=[SECRET];});
    }});
    assert.equal(report.simulatedAttempts,1);assert.equal(report.status,'failed');assert.equal(report.errorDataPreserved,true);
    assert.equal(report.error,kind==='auth'?'AI_AUTH_FAILED':'INVALID_RESPONSE');
    assert.equal(report.diagnostic?.stage??null,kind==='syntax'?'content_parse':kind==='contract'?'result_contract':null);
    assert.ok(!readFileSync(join(path,'report.json'),'utf8').includes(SECRET));
    await assert.rejects(runDiagnostic({mode:'mock',output:path}),/BATCH_ALREADY_STARTED/);
  }
  assert.equal(calls,3);
});
test('I6R invalid flags cannot widen case/call cap, change experiment ID, resume, or redirect paid output',()=>{
  for(const args of [['--case=C1'],['--limit=6'],['--retry'],['--id=new'],['--resume'],['--live','--mock'],['--live','--output=new'],['--transport=other'],['--credential=other'],['--api-key=secret'],['--plan','--plan']])assert.throws(()=>parseDiagnosticOptions(args),/INVALID_EVAL_OPTIONS/);
});
test('I6R separate explicit authorization and reviewed source/runtime fingerprint required; no live invocation',()=>{
  const f=codeFingerprint(),o={mode:'live',transport:'native',credential:'direct-secret',approve:'INIT006-C2-ONCE','code-sha256':f.sha256};
  const env={ALLOW_PAID_AI:'true',AFS_INIT006_APPROVED_USD:String(BUDGET_USD),AFS_PRICE_RECHECKED:'true',DEEPSEEK_API_KEY:SECRET};
  assert.doesNotThrow(()=>authorizeDiagnostic(o,env,f));
  for(const field of ['ALLOW_PAID_AI','AFS_INIT006_APPROVED_USD','AFS_PRICE_RECHECKED'])assert.throws(()=>authorizeDiagnostic(o,{...env,[field]:''},f),/LIVE_NOT_AUTHORIZED/);
  for(const approve of [undefined,'INIT005-SIX-CALLS'])assert.throws(()=>authorizeDiagnostic({...o,approve},env,f),/LIVE_NOT_AUTHORIZED/);
  assert.throws(()=>authorizeDiagnostic({...o,'code-sha256':'a'.repeat(64)},env,f),/CODE_FINGERPRINT_MISMATCH/);
  assert.throws(()=>authorizeDiagnostic(o,{...env,DEEPSEEK_API_KEY:''},f),/AI_NOT_CONFIGURED/);
  assert.throws(()=>authorizeDiagnostic(o,{...env,NODE_TLS_REJECT_UNAUTHORIZED:'0'},f),/TLS_UNVERIFIED/);
  assert.throws(()=>authorizeDiagnostic({...o,credential:'network-secret'},env,f),/PROXY_REQUIRED/);
  assert.ok(f.files.some(x=>x.path==='src/shared/diagnostics.ts'));
  assert.ok(f.files.some(x=>x.path==='dist/public/shared/diagnostics.js'));
});
test('I6R exclusive persistent claim rejects a second process and preserves existing evidence',t=>{
  const dir=temporary(t),old=join(dir,'eval-results','init005-live');mkdirSync(old,{recursive:true});
  writeFileSync(join(old,'run.lock'),'ORIGINAL LOCK');writeFileSync(join(old,'report.json'),'ORIGINAL RESULTS');
  const unchanged=legacyGuard(dir),fresh=join(dir,'eval-results','init006-c2-diagnostic');
  claimBatch(fresh);
  // Separate OS process, not just an in-memory flag.
  const child=spawnSync(process.execPath,['--input-type=module','-e',
    "import {claimBatch} from './scripts/init005/safety.mjs';try{claimBatch(process.argv[1]);process.exitCode=1;}catch(e){if(e.message!=='BATCH_ALREADY_STARTED')process.exitCode=2;}",fresh],{encoding:'utf8',env:childEnv});
  assert.equal(child.status,0);assert.equal(unchanged(),true);
  writeFileSync(join(old,'report.json'),'CHANGED');assert.equal(unchanged(),false);
  assert.throws(()=>legacyGuard(join(dir,'missing')),/LEGACY_EVIDENCE_REQUIRED/);
});
test('I6R dispatch slot is not refunded on transport or pre-dispatch disk failure',async()=>{
  let calls=0,records=0;
  const broken=onceTransport(async()=>{calls++;throw new Error(SECRET);},()=>{records++;});
  await assert.rejects(broken('test',{}));await assert.rejects(broken('test',{}),/CALL_CAP_EXCEEDED/);
  assert.equal(calls,1);assert.equal(records,1);
  const disk=onceTransport(async()=>{calls++;},()=>{throw new Error('OUTPUT_WRITE_FAILED');});
  await assert.rejects(disk('test',{}),/OUTPUT_WRITE_FAILED/);await assert.rejects(disk('test',{}),/CALL_CAP_EXCEEDED/);
  assert.equal(calls,1);
});
test('I6R same shared peak reservation fits narrower declared budget; invalid/nonfinite budgets fail',()=>{
  const r=reservation({test:'budget-only'});assert.equal(r.reservedUsd,0.0169152);assert.ok(r.reservedUsd<BUDGET_USD);
  assert.doesNotThrow(()=>checkBudget(r));
  for(const v of [NaN,Infinity,-1,0,0.021,undefined])assert.throws(()=>checkBudget({...r,reservedUsd:v}),/BUDGET_EXCEEDED/);
  assert.throws(()=>checkBudget({...r,requestBytes:32769}),/BUDGET_EXCEEDED/);
  assert.throws(()=>checkBudget({...r,inputReservationTokens:40001}),/BUDGET_EXCEEDED/);
});
test('I6R CLI errors print no raw flag or secret and do not execute a provider',()=>{
  const p=spawnSync(process.execPath,['scripts/init006/run.mjs','--api-key='+SECRET],{encoding:'utf8',env:childEnv});
  assert.equal(p.status,1);assert.ok(!(p.stdout+p.stderr).includes(SECRET));
  assert.deepEqual(JSON.parse(p.stderr),{error:'INVALID_EVAL_OPTIONS',automaticRetry:false});
});
test('I6R two simultaneous processes compete for one persistent slot: exactly one wins',async t=>{
  const dir=temporary(t);
  const start=()=>new Promise((resolve,reject)=>{
    const p=spawn(process.execPath,['--input-type=module','-e',
      "import {claimBatch} from './scripts/init005/safety.mjs';try{claimBatch(process.argv[1]);}catch(e){process.exitCode=e.message==='BATCH_ALREADY_STARTED'?3:2;}",dir],
      {env:childEnv,stdio:'ignore'});
    p.on('error',reject);p.on('close',resolve);
  });
  const result=await Promise.all([start(),start()]);assert.deepEqual(result.sort(),[0,3]);
  assert.throws(()=>claimBatch(dir),/BATCH_ALREADY_STARTED/);
});
