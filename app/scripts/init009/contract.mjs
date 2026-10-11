// Fixed INIT009 only. No experiment/URL/run/slot/budget override and no legacy gate edits.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
export const PURPOSE='INIT009-PROMPT-QUALITY-REEVALUATION';
export const RUN_ID='INIT009-KO-20261011-01';
export const LEGACY_SOURCE_FINGERPRINT='fb30a9207a2c9a7d94bc74b30a2247498e68843a489b6d9c384a5a584a641423';
export const LEGACY_RUNTIME_FINGERPRINT='546bd875c4556613aebb97c800bc1bd4a2e3e52870c62c73f691b2c1895a8224';
export const PERSONA_IDS=Object.freeze(['p01','p03']);
export const SLOTS=Object.freeze([1,2].flatMap(turn=>PERSONA_IDS.map(personaId=>Object.freeze({id:`${personaId}-${turn}`,personaId,turn}))));
export const LIMITS=Object.freeze({slots:4,parallelism:1,retries:0,timeoutMs:15000,maxOutputTokens:4096,
  maxBodyBytes:32768,inputReservationTokens:40000,minIntervalMs:12000,rollingWindowMs:60000,rate:6,
  processCap:20,budgetNanoUsd:120000000});
export const LIVE_DIR='/workspace/validation/init009/live/INIT009-KO-20261011-01';
export const CONTROL_DIR='/workspace/validation/init009/control/INIT009-KO-20261011-01';
export const fixtureBytes=readFileSync(new URL('../../fixtures/init009/experiment.json',import.meta.url));
export const fixture=JSON.parse(fixtureBytes);
export const fixtureHash=createHash('sha256').update(fixtureBytes).digest('hex');
export function fixedPlan(){
  return {schemaVersion:'init009.fixed-plan.1',purpose:PURPOSE,runId:RUN_ID,paid:false,generationRequests:0,
    legacySourceFingerprint:LEGACY_SOURCE_FINGERPRINT,legacyRuntimeFingerprint:LEGACY_RUNTIME_FINGERPRINT,
    priorActualCalls:11,legacyRetryPermitted:false,slots:SLOTS,limits:LIMITS,fixtureHash,fixture,
    liveDirectory:LIVE_DIR,controlDirectory:CONTROL_DIR,currentPrices:null,currentSupport:null,
    readiness:'keyless-preparation-only; live blocked pending fresh artifacts and coordinator review',
    actualPromptEffect:'unverified',previousP01InvalidIdAndCause:'unknown',humanContentQuality:'pending',
    accountBillingHardCap:false,automaticApproval:false};
}
