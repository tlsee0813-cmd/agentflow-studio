// TEST-ONLY helpers. These are synthetic transport/clock/legacy doubles, never live evidence.
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mockInterview } from '../server/providers/mock.mjs';
import { experimentConfig, sha, SNAPSHOT, MODEL } from '../scripts/init007b/policy.mjs';
import { newIdentity, openLedger } from '../scripts/init007b/ledger.mjs';
import { answerBundleTemplate } from '../scripts/init007b/engine.mjs';
export const clone=v=>structuredClone(v);
export const CANARY='UNTRUSTED_PROVIDER_SECRET_CANARY_007B';
export const identity=newIdentity({sourceFingerprint:sha('SYNTHETIC_CODE'),runtimeFingerprint:sha('SYNTHETIC_COMPILED'),
  fixtureHash:sha('SYNTHETIC_FIXTURE'),projectSchemaVersion:'0.1.1',sessionSchemaVersion:'init007a.session.1',node:'v22.16.0'},
  {mode:'mock',reviewHash:sha('SYNTHETIC_REVIEW'),legacyHash:sha('SYNTHETIC_LEGACY')});
export function temp(prefix='init007b-unit-'){return mkdtempSync(join(tmpdir(),prefix));}
export function createStore(options={}) {const root=join(temp(),'run');return {root,store:openLedger(root,identity,{initialize:true,...options})};}
export function fakeClock() {
  let time=Date.UTC(2026,9,11,0,0,0);const waits=[];
  return {now:()=>time,wait:async ms=>{waits.push(ms);time+=ms;},advance:ms=>{time+=ms;},waits};
}
export function goodTelemetry(overrides={}) {
  return {requestedModel:MODEL,returnedModel:MODEL,modelMatch:'expected',httpStatus:200,finishReason:'stop',
    outcome:'success',usage:{prompt_tokens:1000,completion_tokens:500,total_tokens:1500,prompt_cache_hit_tokens:0,
      prompt_cache_miss_tokens:1000,reasoning_tokens:null},elapsedMs:1,diagnostic:null,...overrides};
}
export function transportDouble({respond,clock=fakeClock(),beforeDispatch}={}) {
  const calls=[];
  return {kind:'explicit-test-double-not-HTTP',mode:'mock',config:experimentConfig(),calls,clock,
    async generate(request,{onDispatch,reservation}) {
      beforeDispatch?.();onDispatch();calls.push({request:clone(request),startedAtMs:clock.now(),bodySha256:reservation.bodySha256});
      return respond?respond(request,calls.length):{status:200,body:{mode:'mock',result:mockInterview(request)},telemetry:goodTelemetry()};
    },async close(){}
  };
}
export function fixedAnswers(store) {
  const document=answerBundleTemplate(store);
  for(const row of document.cases) {
    const s=store.sessions[row.personaId],q=s.snapshots.first.question;
    const answer=(id,optionId=null,disposition='answered')=>({factIds:[id],optionId,disposition,text:s.persona.facts.find(f=>f.id===id).text});
    switch(row.personaId) {
      case 'p01':
        if(q.topic!=='core-scene'||!q.options.some(o=>o.id==='record'))throw Error('UNEXPECTED_ACTUAL_QUESTION');
        row.answerDocument.answers=[answer('F-core','record')];break;
      case 'p03':row.answerDocument.answers=[answer('F-unknown',null,'unknown'),answer('F-defer',null,'deferred')];break;
      case 'p04':{
        const id=s.state.requirements.find(r=>r.topic==='storage').id;
        row.answerDocument.answers=[answer('F-new','multi-device')];
        row.resolutionActions=[{action:'preview',requirementId:id,choice:'apply'},{action:'cancel'},
          {action:'preview',requirementId:id,choice:'apply'},{action:'confirm'}];break;}
      case 'p05':row.answerDocument.answers=[answer('F-long'),answer('F-revised')];break;
      case 'p06':row.answerDocument.answers=[answer('F-storage','multi-device')];break;
      default:throw Error('UNEXPECTED_ACTUAL_QUESTION');
    }
  }
  return document;
}
export const optionsFor=transport=>({openTransport:async()=>transport,prices:SNAPSHOT,now:transport.clock.now,wait:transport.clock.wait});
export function syntheticLegacyFixture() {
  const root=temp('init007b-SYNTHETIC-legacy-');const bytes='SYNTHETIC legacy identity test only; not historical evidence\n';
  writeFileSync(join(root,'synthetic-source.txt'),bytes);
  for(const d of ['init005-live','init006-c2-diagnostic']) {
    const path=join(root,'eval-results',d);mkdirSync(path,{recursive:true});
    writeFileSync(join(path,'run.lock'),'SYNTHETIC TEST LOCK — NOT LIVE\n');
    writeFileSync(join(path,'report.json'),JSON.stringify({kind:'SYNTHETIC_LEGACY_FIXTURE',realCalls:0}));
  }
  return {root,baseline:{'synthetic-source.txt':sha(bytes)}};
}
