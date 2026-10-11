// Explicit synthetic tests only; no Cloud live directories, actual secrets or prior paid evidence.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sha,MOCK_PRICES,fixtureHash } from '../scripts/init009/policy.mjs';
import { newIdentity,openLedger } from '../scripts/init009/ledger.mjs';
import { preparePhase,answerBundleTemplate,executeStage } from '../scripts/init009/engine.mjs';
import { fakeClock,goodTelemetry,transportDouble } from './init007b-helpers.mjs';
export { fakeClock,goodTelemetry,transportDouble };
export const clone=v=>structuredClone(v);
export const code={sourceFingerprint:sha('INIT009 TEST CODE ONLY'),runtimeFingerprint:'546bd875c4556613aebb97c800bc1bd4a2e3e52870c62c73f691b2c1895a8224',
  fixtureHash,projectSchemaVersion:'0.1.1',sessionSchemaVersion:'init007a.session.1',node:'v22.16.0'};
export const identity=newIdentity(code,{mode:'mock',reviewHash:sha('SYNTHETIC FIRST REVIEW'),legacyHash:sha('SYNTHETIC LEGACY')});
export function temp(){return mkdtempSync(join(tmpdir(),'afs-init009-synthetic-'));}
export function makeStore(options={}){
  const root=join(temp(),'run'),store=openLedger(root,identity,{initialize:true,...options});return {root,store};
}
export function fixedAnswers(store){
  const doc=answerBundleTemplate(store);
  for(const r of doc.cases)if(r.action==='answer')r.questionFactMatchReviewed=true; // Explicit synthetic operator, NOT human quality pass.
  return doc;
}
export function options(plan,transport){
  return {phasePlan:plan,phaseReviewHash:sha({synthetic:true,planHash:sha(plan)}),prices:MOCK_PRICES,
    openTransport:async()=>transport,now:transport.clock.now,wait:transport.clock.wait};
}
export async function firsts(store,transport=transportDouble()){
  const plan=preparePhase('firsts',identity);const result=await executeStage(store,'firsts',options(plan,transport));return {plan,result,transport};
}
