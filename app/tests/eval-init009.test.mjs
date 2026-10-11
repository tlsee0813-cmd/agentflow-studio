import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync,readFileSync,writeFileSync,readdirSync,cpSync,mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { readConfig } from '../server/config.mjs';
import { mockInterview } from '../server/providers/mock.mjs';
import { codeIdentity,fixture,fixtureHash,PURPOSE,RUN_ID,LIMITS,SLOTS,LIVE_DIR,MOCK_PRICES,MODEL,
  sha,recentDate,rateDelay,reserveRequest,nanoCost,budgetAvailable,experimentConfig,failurePolicy,telemetryHalt,codeIdentity as realCode } from '../scripts/init009/policy.mjs';
import { runCommand,parseCommand } from '../scripts/init009/run.mjs';
import { newIdentity,openLedger,readLedger } from '../scripts/init009/ledger.mjs';
import { preparePhase,validatePhase,executeStage,prepareAnswers,answerBundleTemplate,stageGate,itemReviewTemplate,applyItemReview } from '../scripts/init009/engine.mjs';
import { evidenceTemplates,reviewTemplate,validateReview,validateOfficial,validatePreflightEvidence,verifyLegacy } from '../scripts/init009/gates.mjs';
import { collect,questions } from '../scripts/init009/report.mjs';
import { PURPOSE as OLD_PURPOSE,RUN_ID as OLD_RUN,reviewTemplate as oldReviewTemplate,validateReview as oldValidateReview,
  authorizeEnvironment as oldAuthorize,LIMITS as OLD_LIMITS } from '../scripts/init007b/policy.mjs';
import { parseCommand as oldParse } from '../scripts/init007b/run.mjs';
import { identity,code,temp,makeStore,clone,fixedAnswers,options,firsts,transportDouble,fakeClock,goodTelemetry } from './init009-helpers.mjs';
const never=async()=>assert.fail('transport must stay unopened');
const safeDiagnostic={schemaVersion:'init006.diagnostic.1',stage:'result_contract',path:'result.proposals[].sourceIds[]',rule:'known_source'};
function diskText(root){return readdirSync(root,{withFileTypes:true}).map(e=>e.isDirectory()?diskText(join(root,e.name)):readFileSync(join(root,e.name),'utf8')).join('\n');}
function reviewedFixture(){
  const plan=preparePhase('firsts',identity),now=Date.now(),at=new Date(now).toISOString(),t=evidenceTemplates();
  const priceCapture=Buffer.from('EXPLICIT SYNTHETIC price evidence, NOT official/current'),supportCapture=Buffer.from('EXPLICIT SYNTHETIC support evidence, NOT official/current');
  const price={...t.price,checkedAt:at,captureSha256:sha(priceCapture),prices:MOCK_PRICES};
  const support={...t.support,checkedAt:at,captureSha256:sha(supportCapture),supported:true};
  const preflight={...t.preflight,checkedAt:at,reachedHttp:true,httpStatus:401};
  const legacy={...t.legacy,checkedAt:at};
  const review={...reviewTemplate(plan),checkedAt:at,prices:MOCK_PRICES,priceEvidenceHash:sha(price),supportEvidenceHash:sha(support),
    preflightHash:sha(preflight),legacyInventoryHash:sha(legacy),coordinatorReviewRef:sha('SYNTHETIC COORDINATOR ONLY')};
  review.reservation.engineeringBasisAccepted=true;
  return {plan,review,artifacts:{price,support,preflight,legacy,priceCapture,supportCapture},now};
}
test('I9.01 fixed purpose/run/four slots; p01/p03 facts and choices are original fixture bytes semantically',()=>{
  assert.equal(PURPOSE,'INIT009-PROMPT-QUALITY-REEVALUATION');assert.equal(RUN_ID,'INIT009-KO-20261011-01');
  assert.deepEqual(SLOTS.map(s=>s.id),['p01-1','p03-1','p01-2','p03-2']);assert.equal(LIMITS.slots,4);
  const old=JSON.parse(readFileSync(new URL('../fixtures/init007a/personas.json',import.meta.url)));
  assert.deepEqual(fixture.personas,old.filter(p=>['p01','p03'].includes(p.id)));
  assert.equal(readConfig({AI_MODE:'mock'}).maxTokens,2048);assert.equal(experimentConfig().maxTokens,4096);
  assert.equal(realCode().runtimeFingerprint,identity.runtimeFingerprint);
});
test('I9.02 plan and review-only are keyless, unknown live evidence does not open a ledger',async()=>{
  const existed=existsSync(LIVE_DIR),env=new Proxy({}, {get(){assert.fail('plan environment read');}});
  const plan=await runCommand('--plan',{env});assert.equal(plan.generationRequests,0);assert.equal(plan.currentPrices,null);
  const r=await runCommand('--review-only',{env:{}});assert.equal(r.readiness,'blocked');assert.equal(r.credentialRead,false);
  const gated=new Proxy({ALLOW_PAID_AI:'true',AFS_INIT009_ASSIGNMENT:RUN_ID,AFS_INIT009_APPROVED_USD:'0.12',AFS_INIT009_CREDENTIAL:'network-secret'},
    {get:(target,key)=>{if(key==='DEEPSEEK_API_KEY')assert.fail('must not read key before readiness');return target[key];}});
  await assert.rejects(runCommand('--firsts',{env:gated}));assert.equal(existsSync(LIVE_DIR),existed);
});
test('I9.03 CLI rejects arbitrary run/path/slots/key/transport/retry/reset; old gate rejects new identity without old CLI execution',()=>{
  for(const arg of ['--out=/tmp/other','--run=other','--slots=100','--retry','--reset','--key=x','--transport=native','--approve'])assert.throws(()=>parseCommand([arg]));
  assert.throws(()=>parseCommand(['--firsts','--firsts']));assert.throws(()=>oldParse(['--prepare-firsts']));
  assert.equal(OLD_LIMITS.slots,12);assert.notEqual(OLD_RUN,RUN_ID);assert.notEqual(OLD_PURPOSE,PURPOSE);
  const old=oldReviewTemplate(code);old.purpose=PURPOSE;old.runId=RUN_ID;
  assert.throws(()=>oldValidateReview(old,sha(old),code),/REVIEW_INVALID/);
  assert.throws(()=>oldAuthorize({ALLOW_PAID_AI:'true',AFS_INIT009_ASSIGNMENT:RUN_ID,AFS_INIT009_APPROVED_USD:'0.12'}),/LIVE_NOT_AUTHORIZED/);
});
test('I9.04 normal state functions prepare fresh project/source/request IDs and exact reviewed body; no copied old question',()=>{
  const a=preparePhase('firsts',identity),b=preparePhase('firsts',identity);assert.equal(validatePhase(a,identity,'firsts'),a);
  assert.notEqual(a.rows[0].started.request.projectId,b.rows[0].started.request.projectId);
  assert.notEqual(a.rows[0].started.request.sources[0].id,b.rows[0].started.request.sources[0].id);
  assert.equal(a.rows[0].session.state.question,null);assert.equal(a.rows[0].session.state.sources.length,0);
  assert.ok(!JSON.stringify(a.rows[0].body).includes(fixture.personas[0].facts.find(f=>f.id==='F-core').text)); // Hidden follow-up fact is not injected into firsts.
  for(const row of a.rows){assert.deepEqual(row.started.state.pending,row.started.request);assert.equal(row.bodySha256,sha(row.body));}
  const modified=clone(a);modified.rows[0].body.max_tokens=2048;assert.throws(()=>validatePhase(modified,identity,'firsts'),/BODY_MISMATCH/);
  const changed=clone(a);changed.identity.sourceFingerprint='0'.repeat(64);assert.throws(()=>validatePhase(changed,identity,'firsts'),/PLAN_MISMATCH/);
});
test('I9.05 four-slot mock workflow: durable predispatch, exact IDs, reopen, each duplicate stage generation zero',async()=>{
  const {store,root}=makeStore();let reopened;
  const clock=fakeClock(),t=transportDouble({clock,beforeDispatch:()=>{
    const disk=readLedger(root,identity);assert.equal(disk.data.slots.filter(s=>s.status==='reserved').length,1);
  }});
  try{
    const {plan}=await firsts(store,t);assert.equal(t.calls.length,2);
    assert.deepEqual(t.calls.map(c=>c.request.requestId),plan.rows.map(r=>r.started.request.requestId));
    assert.equal((await executeStage(store,'firsts',{openTransport:never})).dispatchesThisInvocation,0);
    const firstHead=store.head;store.close();reopened=openLedger(root,identity);assert.equal(reopened.head,firstHead);
    const doc=fixedAnswers(reopened),follow=preparePhase('followups',identity,reopened,doc),second=transportDouble({clock});
    const result=await executeStage(reopened,'followups',options(follow,second));assert.equal(result.totalDispatched,4);assert.equal(result.halt,null);
    assert.deepEqual(second.calls.map(c=>c.request.requestId),follow.rows.map(r=>r.started.request.requestId));
    assert.equal((await executeStage(reopened,'followups',{openTransport:never})).dispatchesThisInvocation,0);
    assert.ok(reopened.data.slots.every(s=>s.stagePlanHash&&s.stageReviewHash&&s.status==='succeeded'));
    assert.equal(result.quality,'human_review_pending');
  }finally{store.close();reopened?.close();}
});
test('I9.06 answer draft cannot authorize itself; p01 custom fact and p03 same AnswerID unknown->deferred preserve exact text/two sources',async()=>{
  const {store}=makeStore();try{
    await firsts(store);const draft=answerBundleTemplate(store);
    assert.throws(()=>prepareAnswers(store,draft),/FACT_REVIEW_REQUIRED/);
    const doc=fixedAnswers(store),prepared=prepareAnswers(store,doc),p1=prepared.changed.p01,p3=prepared.changed.p03;
    assert.equal(p1.state.answers[0].text,p1.persona.facts.find(f=>f.id==='F-core').text);
    assert.equal(p1.state.answers[0].optionId,null);
    assert.equal(p3.inputEvents[0].after.answers[0].id,p3.inputEvents[1].after.answers[0].id);
    assert.notEqual(p3.inputEvents[0].after.answers[0].sourceId,p3.inputEvents[1].after.answers[0].sourceId);
    assert.equal(p3.state.answers[0].disposition,'deferred');assert.equal(p3.state.brief.tools,'claude-only');
    assert.equal(p3.state.requirements.find(r=>r.topic==='storage').status,'deferred');
    assert.match(p3.state.requirements.find(r=>r.topic==='storage').acceptance,/^TBD:/);
    assert.ok(p3.inputEvents.every(e=>e.after.sources.at(-1).text.endsWith(e.submitted.text)));
    assert.deepEqual(store.sessions.p03.inputEvents,[]); // Preparation is not a live state commit.
  }finally{store.close();}
});
test('I9.07 no invented person/time/habit, wrong IDs, changed revisions or extra rows; all rejected without state mutation',async()=>{
  const {store}=makeStore();try{
    await firsts(store);const doc=fixedAnswers(store),head=store.head;
    for(const alter of [d=>d.cases[0].answerDocument.answers[0].text+=' 매일 저녁 혼자 사용한다.',
      d=>d.cases[0].firstQuestionHash='0'.repeat(64),d=>d.cases[0].answerDocument.projectId='another-project',
      d=>d.cases[1].answerDocument.answers.reverse(),d=>d.cases[1].answerDocument.answers[1].disposition='answered',
      d=>d.cases.push(clone(d.cases[0])),d=>d.ledgerHead='0'.repeat(64)]){
      const wrong=clone(doc);alter(wrong);assert.throws(()=>prepareAnswers(store,wrong));assert.equal(store.head,head);
    }
  }finally{store.close();}
});
test('I9.08 absent question skips both followups; unmatched actual topic skips without fabricated answers or count filling',async()=>{
  for(const absent of [true,false]){
    const {store}=makeStore();try{
      const t=transportDouble({respond:req=>{const result=mockInterview(req);if(absent)result.question=null;
        else result.question={...result.question,topic:'audience'};return {status:200,body:{mode:'mock',result},telemetry:goodTelemetry()};}});
      await firsts(store,t);const doc=fixedAnswers(store);
      if(!absent)assert.ok(doc.cases.every(r=>r.action==='skip'));
      const plan=preparePhase('followups',identity,store,doc);assert.equal(plan.rows.length,0);
      await executeStage(store,'followups',{...options(plan,t),openTransport:never});assert.equal(t.calls.length,2);
      assert.ok(store.data.slots.filter(s=>s.turn===2).every(s=>s.status==='skipped'));
    }finally{store.close();}
  }
});
test('I9.09 only healthy known_source is case-scoped; other contract diagnostics and missing telemetry halt globally',()=>{
  assert.deepEqual(failurePolicy(goodTelemetry({outcome:'INVALID_RESPONSE'}),safeDiagnostic,'INVALID_RESPONSE'),{scope:'case',code:'INVALID_RESPONSE'});
  for(const d of [null,{...safeDiagnostic,rule:'non_blank'},{schemaVersion:'init006.diagnostic.1',stage:'content_parse',path:'provider.choices[].message.content',rule:'json_syntax'}])
    assert.equal(failurePolicy(goodTelemetry({outcome:'INVALID_RESPONSE'}),d,'INVALID_RESPONSE').scope,'global');
  for(const t of [null,goodTelemetry({httpStatus:429,outcome:'AI_RATE_LIMIT'}),goodTelemetry({finishReason:'length'}),
    goodTelemetry({modelMatch:'different'}),goodTelemetry({usage:{}}),goodTelemetry({usage:{...goodTelemetry().usage,prompt_cache_miss_tokens:null}})])assert.ok(telemetryHalt(t));
});
test('I9.10 known_source failure preserves safe diagnostic, skips failed case followup, continues independent p03 only',async()=>{
  const {store,root}=makeStore();try{
    const t=transportDouble({respond:(req,n)=>n===1?{status:502,body:{error:{code:'INVALID_RESPONSE',unvalidated:'DO_NOT_COLLECT_REJECTED_TEXT'}},
      telemetry:goodTelemetry({outcome:'INVALID_RESPONSE',diagnostic:safeDiagnostic})}:{status:200,body:{mode:'mock',result:mockInterview(req)},telemetry:goodTelemetry()}});
    await firsts(store,t);assert.equal(t.calls.length,2);assert.equal(store.data.halt,null);assert.equal(store.data.slots[2].status,'skipped');
    assert.equal(store.data.slots[0].failure.scope,'case');assert.equal(store.sessions.p01.generations[0].validatedEnvelope,undefined);
    assert.ok(!diskText(root).includes('DO_NOT_COLLECT_REJECTED_TEXT'));
  }finally{store.close();}
});
test('I9.11 global failure stops next independent case, keeps reservation/halt/lock and forbids re-entry',async()=>{
  const {store,root}=makeStore();const t=transportDouble({respond:()=>({status:502,body:null,telemetry:goodTelemetry({httpStatus:401,outcome:'AI_AUTH_FAILED'})})});
  await firsts(store,t);assert.equal(t.calls.length,1);assert.equal(store.data.halt.code,'AI_AUTH_FAILED');
  assert.ok(store.data.slots[0].reservation);assert.throws(()=>stageGate(store,'firsts'),/GLOBAL_HALTED/);
  store.close();assert.ok(existsSync(join(root,'active.lock')));assert.throws(()=>openLedger(root,identity),/LEDGER_LOCKED/);
});
test('I9.12 fsync/write uncertainty before dispatch leaves lock, sends zero, cannot reopen; damaged read also keeps lock',async()=>{
  let writes=0;const {store,root}=makeStore({beforeWrite:path=>{if(path.includes('journal')&&++writes===4)throw Error('SYNTHETIC WRITE FAILURE');}});
  const t=transportDouble();await assert.rejects(firsts(store,t),/OUTPUT_WRITE_FAILED/);assert.equal(t.calls.length,0);
  store.close();assert.ok(existsSync(join(root,'active.lock')));assert.throws(()=>openLedger(root,identity),/LEDGER_LOCKED/);
  const other=makeStore();other.store.close();writeFileSync(join(other.root,'journal/000001.json'),'broken');
  assert.throws(()=>openLedger(other.root,identity));assert.ok(existsSync(join(other.root,'active.lock')));
});
test('I9.13 unknown/current unsupported prices blocked; complete synthetic review checks exact body and source/fixture/review bindings',()=>{
  const f=reviewedFixture();assert.equal(validateReview(f.review,sha(f.review),f.plan,identity,f.artifacts,null,f.now).reservations.length,2);
  for(const key of ['sourceFingerprint','runtimeFingerprint','fixtureHash','phasePlanHash','answersHash']){
    const r=clone(f.review);r[key]='0'.repeat(64);assert.throws(()=>validateReview(r,sha(r),f.plan,identity,f.artifacts,null,f.now));
  }
  const r=clone(f.review);r.prices=null;assert.throws(()=>validateReview(r,sha(r),f.plan,identity,f.artifacts,null,f.now),/PRICE_UNKNOWN/);
  assert.throws(()=>validateReview(f.review,'0'.repeat(64),f.plan,identity,f.artifacts,null,f.now),/REVIEW_HASH_MISMATCH/);
  const a=clone(f.artifacts);a.support.supported=false;assert.throws(()=>validateOfficial(a.price,a.support,f.artifacts.priceCapture,f.artifacts.supportCapture,f.now));
  assert.throws(()=>validateOfficial(f.artifacts.price,f.artifacts.support,Buffer.from(''),f.artifacts.supportCapture,f.now));
  assert.throws(()=>verifyLegacy(f.artifacts.legacy,f.now),/LEGACY_INVENTORY_REQUIRED/); // Synthetic header is not real preservation evidence.
});
test('I9.14 canonical UTC/finite current time/24h applies equally to review, official support and preflight',()=>{
  const f=reviewedFixture(),at=f.review.checkedAt;
  assert.ok(recentDate(at,f.now));assert.ok(recentDate(at,f.now+86400000));assert.equal(recentDate(at,f.now+86400001),false);
  for(const now of [NaN,Infinity,-1]){assert.equal(recentDate(at,now),false);assert.throws(()=>rateDelay([],now),/CLOCK_INVALID/);}
  for(const bad of [null,'bad','2026-02-30T00:00:00.000Z',at.replace(/\.\d{3}Z$/,'Z'),new Date(f.now+1).toISOString(),new Date(f.now-86400001).toISOString()]){
    if(bad===at)continue;
    assert.equal(recentDate(bad,f.now),false);
    assert.throws(()=>validatePreflightEvidence({...f.artifacts.preflight,checkedAt:bad},f.now));
    const r={...f.review,checkedAt:bad};assert.throws(()=>validateReview(r,sha(r),f.plan,identity,f.artifacts,null,f.now));
  }
  assert.throws(()=>validateReview(f.review,sha(f.review),f.plan,identity,f.artifacts,null,NaN),/CLOCK_INVALID/);
});
test('I9.15 final32KiB/input40000/output4096/4-slot total<=.12 budget; fresh prices never silently replaced by historical defaults',()=>{
  const plan=preparePhase('firsts',identity),req=plan.rows[0].started.request,config=experimentConfig();
  const reserve=reserveRequest(req,config,MOCK_PRICES);assert.equal(reserve.inputReservationTokens,40000);assert.equal(reserve.outputReservationTokens,4096);
  assert.ok(reserve.reservedNanoUsd*4<=120000000);assert.throws(()=>reserveRequest(req,config,null),/PRICE_UNKNOWN/);
  assert.throws(()=>reserveRequest({...req,brief:{...req.brief,idea:'가'.repeat(20000)}},config,MOCK_PRICES),/INPUT_TOO_LARGE/);
  assert.throws(()=>reserveRequest(req,{...config,maxTokens:2048},MOCK_PRICES),/BODY_MISMATCH/);
  assert.throws(()=>budgetAvailable({slots:Array.from({length:4},()=>({reservation:reserve}))},reserve),/CALL_CAP_EXCEEDED/);
  const f=reviewedFixture();f.review.prices={inputMiss:1,inputHit:0.1,output:2};f.artifacts.price.prices=f.review.prices;f.review.priceEvidenceHash=sha(f.artifacts.price);
  assert.throws(()=>validateReview(f.review,sha(f.review),f.plan,identity,f.artifacts,null,f.now),/BUDGET_EXCEEDED/);
  assert.equal(rateDelay([{startedAtMs:1000,endedAtMs:1500}],1500),12000); // inherited timing, no whole wall-clock rerun
});
test('I9.16 generation-free item recording needs separate hash/date/coordinator review; preserves pending quality and source semantics distinction',async()=>{
  const {store}=makeStore();try{
    const first=await firsts(store);const t=transportDouble({clock:first.transport.clock}),plan=preparePhase('followups',identity,store,fixedAnswers(store));
    await executeStage(store,'followups',options(plan,t));
    const document=itemReviewTemplate(store),s=store.sessions.p01,r=s.state.requirements.find(r=>r.status==='proposed');
    document.items=[{personaId:'p01',stateHash:sha(s.state),requirementId:r.id,status:'confirmed'}];
    assert.throws(()=>applyItemReview(store,document,sha(document)),/ITEM_REVIEW_REQUIRED/);
    document.reviewedAt=new Date().toISOString();document.coordinatorReviewRef=sha('SYNTHETIC SEPARATE ITEM REVIEW');
    assert.equal(applyItemReview(store,document,sha(document)).recorded,1);assert.equal(applyItemReview(store,document,sha(document)).alreadyRecorded,true);
    const report=collect(store),p3=report.cases.find(r=>r.personaId==='p03');
    assert.equal(report.actualCustomerApproval,false);assert.equal(report.humanContentQuality,'pending');
    assert.ok(report.cases.every(c=>c.currentRequirements.every(r=>r.semanticSupport==='pending')));
    assert.equal(p3.currentDecisionView.groups.find(g=>g.status==='deferred').items[0].topic,'storage');
    assert.equal(p3.aiInterpretation.authoritative,false);assert.equal(p3.observations.sameAnswerId,true);
    assert.equal(p3.observations.preservedAnswerSources,true);assert.equal(p3.observations.priorToolsRequirementUnchanged,true);
    assert.equal(questions(store).cases.length,2);assert.equal(t.calls.length,2);
  }finally{store.close();}
});
test('I9.17 all auth/balance/429/network/timeout telemetry failures halt independent cases; no reservation refund or retry',async()=>{
  for(const [outcome,httpStatus] of [['AI_AUTH_FAILED',401],['AI_BALANCE_REQUIRED',402],['AI_RATE_LIMIT',429],['AI_NETWORK_ERROR',null],['AI_TIMEOUT',null]]){
    const {store}=makeStore(),t=transportDouble({respond:()=>({status:502,body:null,telemetry:goodTelemetry({outcome,httpStatus})})});
    await firsts(store,t);assert.equal(t.calls.length,1);assert.equal(store.data.halt.code,outcome);
    assert.ok(store.data.slots[0].reservation.reservedNanoUsd>0);assert.equal(store.data.slots[1].status,'pending');store.close();
  }
});
test('I9.18 reviewed answer state cannot be edited into a false fact, different question, new AnswerID or unrelated tool choice',async()=>{
  const {store}=makeStore();try{
    await firsts(store);const plan=preparePhase('followups',identity,store,fixedAnswers(store));
    for(const alter of [p=>p.rows[0].session.inputEvents[0].after.answers[0].text='fabricated answer',
      p=>p.rows[1].session.inputEvents[0].after.answers[0].id='A-changed',
      p=>p.rows[1].session.state.brief.tools='codex-only',p=>p.rows[1].beforeSessionHash='0'.repeat(64),
      p=>p.rows[0].session.quality.status='pass',p=>p.rows[0].started.request.requestId='R-unreviewed']){
      const changed=clone(plan);alter(changed);assert.throws(()=>validatePhase(changed,identity,'followups',store));
    }
    assert.equal(store.data.slots.filter(s=>s.startedAtMs!==null).length,2);
  }finally{store.close();}
});
test('I9.19 predispatch fsync acknowledgement failure at dispatched write sends zero and preserves consumed reservation and lock',async()=>{
  let journals=0;const {store,root}=makeStore({beforeWrite:path=>{if(path.includes('journal')&&++journals===5)throw Error('SYNTHETIC FSYNC ACK FAILURE');}});
  const t=transportDouble();await assert.rejects(firsts(store,t),/OUTPUT_WRITE_FAILED/);
  assert.equal(t.calls.length,0);assert.equal(store.data.slots[0].status,'reserved');assert.ok(store.data.slots[0].reservation);
  store.close();assert.ok(existsSync(join(root,'active.lock')));
});
