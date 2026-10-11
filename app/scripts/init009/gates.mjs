// Generation-free artifact checks. They neither probe a network nor read a credential.
import { readdirSync, lstatSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { PURPOSE,RUN_ID,MODEL,PRICE_URL,MODEL_URL,LIMITS,LIVE_DIR,CONTROL_DIR,LEGACY_SOURCE_FINGERPRINT,
  LEGACY_RUNTIME_FINGERPRINT,sha,isHash,exact,equal,fail,readJson,readBytes,noSymlinks,recentDate,validNow,
  validatePrices,nanoCost,reserveRequest,experimentConfig,rejectSecretContent } from './policy.mjs';
import { validatePhase } from './engine.mjs';
import { readLedger as readOriginalLedger } from '../init007b/ledger.mjs';
import { codeIdentity as originalCodeIdentity, PURPOSE as ORIGINAL_PURPOSE, RUN_ID as ORIGINAL_RUN_ID } from '../init007b/policy.mjs';
const SUPPORT=Object.freeze({model:MODEL,endpoint:'https://api.deepseek.com/chat/completions',stream:false,
  thinking:{type:'disabled'},max_tokens:4096,response_format:{type:'json_object'}});
export function reviewTemplate(plan){
  return {schemaVersion:'init009.review.1',purpose:PURPOSE,runId:RUN_ID,...plan.identity,stage:plan.stage,
    phasePlanHash:sha(plan),ledgerHead:plan.ledgerHead,answersHash:plan.answersHash,
    legacySourceFingerprint:LEGACY_SOURCE_FINGERPRINT,legacyRuntimeFingerprint:LEGACY_RUNTIME_FINGERPRINT,
    checkedAt:null,prices:null,priceEvidenceHash:null,supportEvidenceHash:null,legacyInventoryHash:null,preflightHash:null,
    credential:{kind:'network-secret',name:'DEEPSEEK_API_KEY',host:'api.deepseek.com'},
    reservation:{inputTokens:40000,outputTokens:4096,maxBodyBytes:32768,slots:4,engineeringBasisAccepted:false},
    budgetNanoUsd:120000000,coordinatorReviewRef:null};
}
export function evidenceTemplates(){
  return {
    price:{schemaVersion:'init009.price.1',purpose:PURPOSE,runId:RUN_ID,source:PRICE_URL,checkedAt:null,
      captureFile:'official-price.txt',captureSha256:null,prices:null},
    support:{schemaVersion:'init009.support.1',purpose:PURPOSE,runId:RUN_ID,source:MODEL_URL,checkedAt:null,
      captureFile:'official-support.txt',captureSha256:null,supported:false,bodySettings:SUPPORT},
    preflight:{kind:'keyless-external-probe',target:'https://api.deepseek.com/models',transport:'curl-proxy',node:'v22.16.0',
      checkedAt:null,authSent:false,generationRequests:0,reachedHttp:false,httpStatus:null},
    legacy:{schemaVersion:'init009.legacy.1',sourceFingerprint:LEGACY_SOURCE_FINGERPRINT,
      runtimeFingerprint:LEGACY_RUNTIME_FINGERPRINT,priorActualCalls:11,init007Dispatches:8,init007Closed:true,
      checkedAt:null,originalINIT007:null,groups:[]},
    legacyRequiredRoles:['prior005006-source','prior005-evidence','prior006-evidence','prior007-source','prior007-live','prior007-control','prior007-report']
  };
}
export function validatePreflightEvidence(p,now=Date.now()){
  validNow(now);
  if(!p||!recentDate(p.checkedAt,now)||p.kind!=='keyless-external-probe'||p.transport!=='curl-proxy'
    ||p.target!=='https://api.deepseek.com/models'||p.node!=='v22.16.0'||p.reachedHttp!==true||p.authSent!==false
    ||p.generationRequests!==0||![200,401].includes(p.httpStatus))fail('NETWORK_PROBE_FAILED');
  return sha(p);
}
export function validateOfficial(price,support,priceCapture,supportCapture,now=Date.now()){
  validNow(now);const t=evidenceTemplates();
  for(const [value,base,raw] of [[price,t.price,priceCapture],[support,t.support,supportCapture]]){
    exact(value,Object.keys(base),'FRESH_EVIDENCE_REQUIRED');
    for(const k of ['schemaVersion','purpose','runId','source','captureFile'])if(value[k]!==base[k])fail('FRESH_EVIDENCE_REQUIRED');
    if(!recentDate(value.checkedAt,now)||!isHash(value.captureSha256)||!raw||raw.length<20||raw.length>65536
      ||sha(raw)!==value.captureSha256)fail('FRESH_EVIDENCE_REQUIRED');
    rejectSecretContent(raw.toString('utf8'));
  }
  validatePrices(price.prices);
  if(!equal(support.bodySettings,SUPPORT)||support.supported!==true)fail('FRESH_EVIDENCE_REQUIRED');
}
function legacyFiles(root,source=false,prefix=''){
  const path=prefix?join(root,prefix):root;noSymlinks(path);
  const stat=lstatSync(path);
  if(stat.isFile())return [{path:prefix,sha256:sha(readBytes(path))}];
  return readdirSync(path,{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0).flatMap(e=>{
    // Never inspect secrets, installed dependencies, generated runtime or unvalidated/rejected response logs.
    if(['.git','node_modules','dist'].includes(e.name)||/^\.env(?:\.|$)/i.test(e.name))return [];
    if(source&&prefix===''&&e.name==='eval-results')return [];
    if(/(?:rejected.?raw|reasoning|credential|secret|private|\.pem$|\.key$)/i.test(e.name))fail('UNSAFE_PATH');
    return legacyFiles(root,source,prefix?`${prefix}/${e.name}`:e.name);
  });
}
/** Read-only legacy identity. Coordinator inventories actual old locations; these are NOT new run paths.
 * Existing lock files are just hashed and are never acquired, removed, reset or replaced. */
export function verifyLegacy(legacy,now=Date.now()){
  const template=evidenceTemplates().legacy;exact(legacy,Object.keys(template),'LEGACY_INVENTORY_REQUIRED');
  for(const k of ['schemaVersion','sourceFingerprint','runtimeFingerprint','priorActualCalls','init007Dispatches','init007Closed'])
    if(legacy[k]!==template[k])fail('LEGACY_INVENTORY_REQUIRED');
  if(!recentDate(legacy.checkedAt,now)||!Array.isArray(legacy.groups))fail('LEGACY_INVENTORY_REQUIRED');
  const roles=evidenceTemplates().legacyRequiredRoles;
  if(!equal(legacy.groups.map(g=>g.role).sort(),[...roles].sort()))fail('LEGACY_INVENTORY_REQUIRED');
  const fixed={
    'prior005006-source':'/workspace/validation/init006/source',
    'prior005-evidence':'/workspace/validation/init006/source/eval-results/init005-live',
    'prior006-evidence':'/workspace/validation/init006/source/eval-results/init006-c2-diagnostic',
    'prior007-live':'/workspace/validation/init007b/live/INIT007-KO-20261011-01',
    'prior007-control':'/workspace/validation/init007b/control'};
  for(const g of legacy.groups){
    exact(g,['role','root','files'],'LEGACY_INVENTORY_REQUIRED');
    if(typeof g.root!=='string'||!g.root.startsWith('/workspace/validation/')||g.root!==resolve(g.root)
      ||g.root.includes('/init009/')||(fixed[g.role]&&g.root!==fixed[g.role]))fail('UNSAFE_PATH');
    if(!Array.isArray(g.files)||!g.files.length||g.files.length>5000)fail('LEGACY_INVENTORY_REQUIRED');
    for(const f of g.files){
      exact(f,['path','sha256'],'LEGACY_INVENTORY_REQUIRED');
      if(typeof f.path!=='string'||f.path.includes('..')||f.path.startsWith('/')||!isHash(f.sha256))fail('UNSAFE_PATH');
    }
    const actual=legacyFiles(g.root,g.role.endsWith('-source'));
    if(!equal(actual,g.files))fail('LEGACY_CHANGED');
    const names=new Set(g.files.map(f=>f.path));
    const required=g.role==='prior005-evidence'||g.role==='prior006-evidence'?['run.lock','report.json']:
      g.role==='prior007-live'?['journal/000001.json']:g.role==='prior007-control'?['review.json','answers.json']:[];
    if(required.some(p=>!names.has(p)))fail('LEGACY_INVENTORY_REQUIRED');
  }
  // Preserve the original experiment identity instead of replacing it with INIT008/INIT009 fingerprints.
  const oldSource=legacy.groups.find(g=>g.role==='prior007-source').root;
  const oldLive=fixed['prior007-live'],oldControl=fixed['prior007-control'];
  const original=readJson(join(oldLive,'journal/000001.json'),'LEGACY_INVENTORY_REQUIRED').data?.identity;
  const snapshot=readOriginalLedger(oldLive,original); // Read only; never call an old CLI or take over its lock.
  const oldReview=readJson(join(oldControl,'review.json'),'LEGACY_INVENTORY_REQUIRED');
  const actual=originalCodeIdentity(oldSource);
  for(const k of ['sourceFingerprint','runtimeFingerprint','fixtureHash','projectSchemaVersion','sessionSchemaVersion','node'])
    if(actual[k]!==original[k]||actual[k]!==oldReview[k])fail('LEGACY_CHANGED');
  if(original.purpose!==ORIGINAL_PURPOSE||original.runId!==ORIGINAL_RUN_ID||original.mode!=='live'
    ||sha(oldReview)!==original.reviewHash||snapshot.data.slots.filter(s=>s.startedAtMs!==null).length!==8)fail('LEGACY_CHANGED');
  const observed={purpose:ORIGINAL_PURPOSE,runId:ORIGINAL_RUN_ID,sourceFingerprint:actual.sourceFingerprint,
    runtimeFingerprint:actual.runtimeFingerprint,fixtureHash:actual.fixtureHash,reviewHash:sha(oldReview),ledgerHead:snapshot.head,dispatches:8};
  if(!equal(legacy.originalINIT007,observed))fail('LEGACY_CHANGED');
  return sha(legacy);
}
export function loadArtifacts(control=CONTROL_DIR,now=Date.now()){
  const price=readJson(join(control,'price.json'),'FRESH_EVIDENCE_REQUIRED',65536);
  const support=readJson(join(control,'support.json'),'FRESH_EVIDENCE_REQUIRED',65536);
  const priceCapture=readBytes(join(control,'official-price.txt'),65536),supportCapture=readBytes(join(control,'official-support.txt'),65536);
  validateOfficial(price,support,priceCapture,supportCapture,now);
  const preflight=readJson(join(control,'preflight.json'),'NETWORK_PROBE_FAILED',65536);validatePreflightEvidence(preflight,now);
  const legacy=readJson(join(control,'legacy.json'),'LEGACY_INVENTORY_REQUIRED',2*1024*1024);verifyLegacy(legacy,now);
  return {price,support,preflight,legacy,priceCapture,supportCapture};
}
export function validateReview(review,expectedHash,plan,identity,artifacts,store=null,now=Date.now()){
  validNow(now);
  if(!isHash(expectedHash)||sha(review)!==expectedHash)fail('REVIEW_HASH_MISMATCH');
  const template=reviewTemplate(plan);exact(review,Object.keys(template));
  for(const k of ['schemaVersion','purpose','runId','stage','phasePlanHash','ledgerHead','answersHash',
    'legacySourceFingerprint','legacyRuntimeFingerprint','budgetNanoUsd','credential'])
    if(!equal(review[k],template[k]))fail('REVIEW_INVALID');
  for(const k of Object.keys(plan.identity))if(review[k]!==identity[k])fail('CODE_FINGERPRINT_MISMATCH');
  if(identity.node!=='v22.16.0'||!recentDate(review.checkedAt,now)||!isHash(review.coordinatorReviewRef))fail('REVIEW_EXPIRED');
  if(!equal(review.reservation,{...template.reservation,engineeringBasisAccepted:true}))fail('REVIEW_INVALID');
  validatePhase(plan,identity,plan.stage,store);
  if(!artifacts)fail('FRESH_EVIDENCE_REQUIRED');
  const {price,support,preflight,legacy,priceCapture,supportCapture}=artifacts;
  validateOfficial(price,support,priceCapture,supportCapture,now);validatePreflightEvidence(preflight,now);
  for(const [key,value] of [['priceEvidenceHash',price],['supportEvidenceHash',support],['preflightHash',preflight],['legacyInventoryHash',legacy]])
    if(!isHash(review[key])||review[key]!==sha(value))fail('REVIEW_HASH_MISMATCH');
  validatePrices(review.prices);if(!equal(review.prices,price.prices))fail('PRICE_UNKNOWN');
  const allFour=nanoCost(40000,4096,review.prices)*4;
  if(!Number.isSafeInteger(allFour)||allFour>LIMITS.budgetNanoUsd)fail('BUDGET_EXCEEDED');
  const reservations=plan.rows.map(r=>reserveRequest(r.started.request,experimentConfig(),review.prices));
  const consumed=store?.data.slots.reduce((n,s)=>n+(s.reservation?.reservedNanoUsd??0),0)??0;
  if(consumed+reservations.reduce((n,r)=>n+r.reservedNanoUsd,0)>LIMITS.budgetNanoUsd)fail('BUDGET_EXCEEDED');
  return {reviewHash:sha(review),legacyHash:sha(legacy),allFourReservedNanoUsd:allFour,reservations};
}
