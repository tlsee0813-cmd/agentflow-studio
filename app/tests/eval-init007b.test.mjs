import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { readConfig } from '../server/config.mjs';
import { mockInterview } from '../server/providers/mock.mjs';
import { beginRequest } from '../dist/public/shared/project.js';
import { validatePreflight } from '../scripts/init005/run.mjs';
import { openLedger, readLedger } from '../scripts/init007b/ledger.mjs';
import { executeStage, prepareAnswers, stageGate, answerBundleTemplate, itemReviewTemplate, applyItemReview, sessionFor } from '../scripts/init007b/engine.mjs';
import { parseCommand, runCommand, readAnswerDocument } from '../scripts/init007b/run.mjs';
import { renderReport } from '../scripts/init007b/report.mjs';
import { SNAPSHOT, LIMITS, LIVE_DIR, MODEL, PURPOSE, RUN_ID, sha, experimentConfig, reserveRequest,
  nanoCost, budgetAvailable, rateDelay, validateReview, reviewTemplate, telemetryHalt, failurePolicy, legacySnapshot } from '../scripts/init007b/policy.mjs';
import { clone, identity, temp, createStore, fakeClock, goodTelemetry, transportDouble, fixedAnswers, optionsFor,
  syntheticLegacyFixture, CANARY } from './init007b-helpers.mjs';
const output=process.env.INIT007B_TEST_OUTPUT;
const collect=(name,value)=>{if(output){mkdirSync(output,{recursive:true});writeFileSync(join(output,name),JSON.stringify(value,null,2)+'\n');}};
const never=async()=>{assert.fail('No transport may be opened');};
function validReview() {
  const code={...identity};for(const k of ['purpose','runId','mode','reviewHash','legacyHash'])delete code[k];
  const r=reviewTemplate(code);r.priceCheckedAt=new Date().toISOString();r.supportCheckedAt=r.priceCheckedAt;
  r.supports={thinkingDisabled:true,jsonObject:true,output4096:true};r.reservation.engineeringBasisAccepted=true;r.coordinatorReviewRef=sha('SYNTHETIC_COORDINATOR_REVIEW');
  return {r,code};
}
function diskText(root) {
  return readdirSync(root,{withFileTypes:true}).map(e=>e.isDirectory()?diskText(join(root,e.name)):readFileSync(join(root,e.name),'utf8')).join('\n');
}

test('B01 fixed commands reject out/id/limit/reset/retry/key/provider URL and duplicate switches',()=>{
  assert.equal(parseCommand([]),'--plan');assert.equal(parseCommand(['--mock']),'--mock-firsts');
  for(const args of [['--out=/tmp/new'],['--id=NEW'],['--limit=99'],['--reset'],['--retry'],['--live'],
    ['--key=synthetic'],['--transport=native'],['--firsts','--firsts'],['--firsts','--out=/tmp/new']])assert.throws(()=>parseCommand(args),/ARGUMENTS/);
});
test('B02 plan ignores even a throwing credential environment; no live directory created',async()=>{
  const existed=existsSync(LIVE_DIR);const env=new Proxy({}, {get(){assert.fail('Plan must not inspect credentials');}});
  const plan=await runCommand('--plan',{env});assert.equal(plan.paid,false);assert.equal(plan.generationRequests,0);
  assert.equal(plan.runId,RUN_ID);assert.equal(plan.liveDirectory,LIVE_DIR);assert.equal(existsSync(LIVE_DIR),existed);
  assert.equal(plan.coordinatorReviewTemplate.supportCheckedAt,null);
});
test('B03 4096 experiment does not modify product default 2048; body reserve and exact pricing example',()=>{
  assert.equal(readConfig({AI_MODE:'mock'}).maxTokens,2048);const config=experimentConfig();
  const req=beginRequest(sessionFor('p01','mock').state).request,r=reserveRequest(req,config,SNAPSHOT);
  assert.equal(config.maxTokens,4096);assert.equal(config.timeoutMs,15000);assert.equal(config.rate,6);assert.equal(config.cap,20);assert.equal(config.concurrency,1);
  assert.equal(r.inputReservationTokens,40000);assert.equal(r.reservedNanoUsd/1e9,0.0169152);
  assert.equal(r.reservedNanoUsd*12/1e9,0.2029824);assert.equal(LIMITS.budgetNanoUsd/1e9,0.25);
  assert.throws(()=>reserveRequest({...req,brief:{...req.brief,idea:'가'.repeat(20000)}},config,SNAPSHOT),/INPUT_TOO_LARGE/);
});
test('B04 fresh reviewed identity/price/support required; hashes, dates, changed pricing and insufficient budget fail closed',()=>{
  const {r,code}=validReview();assert.equal(validateReview(r,sha(r),code),r);
  assert.throws(()=>validateReview(r,'0'.repeat(64),code),/REVIEW_HASH_MISMATCH/);
  for(const value of [undefined,null,'invalid','2026-02-30T00:00:00.000Z',new Date(Date.now()+60000).toISOString(),new Date(Date.now()-86400001).toISOString()]) {
    const a=clone(r);a.priceCheckedAt=value;assert.throws(()=>validateReview(a,sha(a),code),/REVIEW_EXPIRED/);
  }
  for(const key of ['sourceFingerprint','runtimeFingerprint','fixtureHash','projectSchemaVersion']) {
    const a=clone(r);a[key]=key.includes('Fingerprint')||key==='fixtureHash'?'0'.repeat(64):'other';
    assert.throws(()=>validateReview(a,sha(a),code),/MISMATCH/);
  }
  const a=clone(r);a.prices.inputMiss=9;assert.throws(()=>validateReview(a,sha(a),code),/BUDGET_EXCEEDED/);
  const b=clone(r);b.supports.jsonObject=false;assert.throws(()=>validateReview(b,sha(b),code),/REVIEW_INVALID/);
});
test('B05 accepted INIT005 preflight date gate rejects missing, invalid, normalized, future and stale dates',()=>{
  const p=join(temp(),'preflight.json');const base={kind:'keyless-external-probe',transport:'curl-proxy',node:'v22.16.0',
    target:'https://api.deepseek.com/models',reachedHttp:true,authSent:false,checkedAt:new Date().toISOString()};
  writeFileSync(p,JSON.stringify(base));assert.doesNotThrow(()=>validatePreflight(p,'curl-proxy'));
  for(const checkedAt of [null,'bad','2026-02-30T00:00:00.000Z',new Date(Date.now()+60000).toISOString(),new Date(Date.now()-86400001).toISOString()]) {
    writeFileSync(p,JSON.stringify({...base,checkedAt}));assert.throws(()=>validatePreflight(p,'curl-proxy'),/NETWORK_PROBE_FAILED/);
  }
});
test('B06 synthetic legacy fixture is read-only; missing real history is not manufactured',()=>{
  const {root,baseline}=syntheticLegacyFixture(),before=diskText(root),first=legacySnapshot(root,baseline);
  assert.equal(first.files.length,5);assert.equal(diskText(root),before);
  writeFileSync(join(root,'eval-results/init005-live/report.json'),'SYNTHETIC changed');assert.notEqual(legacySnapshot(root,baseline).sha256,first.sha256);
  writeFileSync(join(root,'synthetic-source.txt'),'changed');assert.throws(()=>legacySnapshot(root,baseline),/LEGACY_CHANGED/);
  const missing=join(temp(),'absent');assert.throws(()=>legacySnapshot(missing,baseline),/LEGACY_EVIDENCE_REQUIRED/);assert.equal(existsSync(missing),false);
});
test('B07 fixed budget/12-slot cap cannot be reset by counters in a new process',()=>{
  const r={reservedNanoUsd:nanoCost(40000,4096)},data={slots:Array.from({length:12},()=>({reservation:r}))};
  assert.throws(()=>budgetAvailable(data,r),/CALL_CAP_EXCEEDED/);
  assert.throws(()=>budgetAvailable({slots:[{reservation:{reservedNanoUsd:249000000}}]},r),/BUDGET_EXCEEDED/);
});
test('B08 persisted last start and rolling six/minute protect a new process and clock rollback',()=>{
  assert.equal(rateDelay([{startedAtMs:100000}],100001),11999);
  assert.equal(rateDelay([0,1000,2000,3000,4000,5000].map(startedAtMs=>({startedAtMs})),5000),55000);
  assert.throws(()=>rateDelay([{startedAtMs:100000}],99999),/CLOCK_ROLLBACK/);
});
test('B09 local lock blocks a competing native child process; no stale takeover option',()=>{
  const {root,store}=createStore();
  const script=`import {openLedger} from ${JSON.stringify(new URL('../scripts/init007b/ledger.mjs',import.meta.url).href)};
    try {openLedger(${JSON.stringify(root)},${JSON.stringify(identity)});process.exit(9);}catch(e){if(e.message!=='LEDGER_LOCKED')process.exit(8);console.log('competing process blocked; generation=0');}`;
  const child=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',env:{PATH:process.env.PATH}});
  assert.equal(child.status,0,child.stderr);assert.match(child.stdout,/generation=0/);store.close();
});
test('B10 source/fixture/run identity mismatch rejects an existing journal without writes',()=>{
  const {root,store}=createStore();store.close();const before=diskText(root);
  for(const key of ['sourceFingerprint','runtimeFingerprint','fixtureHash','runId','projectSchemaVersion']) {
    const other={...identity,[key]:'different'};assert.throws(()=>openLedger(root,other),/LEDGER_IDENTITY_MISMATCH/);
  }
  assert.equal(diskText(root),before);
});
test('B11 truncated or reordered journal fails, never reconstructs or resets',()=>{
  const {root,store}=createStore();store.close();writeFileSync(join(root,'journal/000002.json'),'{');
  assert.throws(()=>openLedger(root,identity),/LEDGER_INVALID/);assert.equal(readdirSync(join(root,'journal')).length,2);
});
test('B12 persisted session digest/state version protects followups from edited first question',async()=>{
  const {root,store}=createStore(),tr=transportDouble();await executeStage(store,'firsts',optionsFor(tr));store.close();
  const snapshot=readLedger(root,identity),ref=snapshot.data.sessions.p01,path=join(root,'sessions',ref.file);
  const s=JSON.parse(readFileSync(path));s.snapshots.first.question.text='INJECTED FAKE QUESTION';writeFileSync(path,JSON.stringify(s));
  assert.throws(()=>openLedger(root,identity),/STATE_HASH_MISMATCH/);assert.equal(tr.calls.length,6);
});

test('B13 two-stage persistent SAME state; input correction, unknown/defer, preview cancel/confirm, explicit item decisions; transport/clock DOUBLE',async()=>{
  const {root,store}=createStore(),clock=fakeClock(),first=transportDouble({clock});
  const firstResult=await executeStage(store,'firsts',optionsFor(first));assert.equal(firstResult.totalDispatched,6);assert.equal(firstResult.halt,null);
  assert.equal(store.data.slots.find(s=>s.id==='p02-2').status,'skipped');
  const firstStates=clone(store.sessions);const firstHead=store.head;store.close();
  const next=openLedger(root,identity),doc=fixedAnswers(next),before=clone(next.sessions);
  const bad=clone(doc);bad.cases.find(c=>c.personaId==='p05').answerDocument.answers[0].text='가'.repeat(1501);
  assert.throws(()=>prepareAnswers(next,bad),/INVALID_ANSWER/);assert.deepEqual(next.sessions,before);assert.equal(next.head,firstHead);
  const injected=clone(doc);injected.cases[0].firstQuestionHash=sha('fake');assert.throws(()=>prepareAnswers(next,injected),/ANSWER_FILE_CONTEXT/);
  const second=transportDouble({clock});const result=await executeStage(next,'followups',{...optionsFor(second),answers:doc});
  assert.equal(result.halt,null);assert.equal(result.dispatchesThisInvocation,5);assert.equal(result.totalDispatched,11);
  assert.equal(second.calls[0].startedAtMs-first.calls.at(-1).startedAtMs,12000);
  for(const [id,s] of Object.entries(next.sessions)) {
    assert.equal(s.state.id,firstStates[id].state.id);assert.deepEqual(s.snapshots.first,firstStates[id].snapshots.first);
    assert.equal(s.quality.status,'human_review_pending');
    if(id!=='p02') {
      assert.equal(s.generations[1].request.stage,'summarize');assert.ok(s.generations[1].request.answers.length);
      assert.ok(next.data.slots.find(slot=>slot.id===`${id}-2`).answerHash);
      assert.equal(s.generations[1].request.baseVersion,s.generations[1].validatedEnvelope.result.baseVersion);
    }
  }
  const p03=next.sessions.p03;assert.equal(p03.state.answers.at(-1).disposition,'deferred');
  assert.equal(p03.inputEvents[0].after.answers.at(-1).id,p03.inputEvents[1].after.answers.at(-1).id);
  const p04=next.sessions.p04;assert.deepEqual(p04.resolutionEvents.map(e=>e.action),['preview','cancel','preview','confirm']);
  assert.deepEqual(p04.resolutionEvents[0].state,p04.resolutionEvents[1].state);assert.equal(p04.state.requirements.find(r=>r.topic==='storage').locked,true);
  const p05=next.sessions.p05;assert.equal(p05.inputEvents[0].submitted.text.length,1490);
  assert.equal(p05.inputEvents[0].after.answers.at(-1).id,p05.inputEvents[1].after.answers.at(-1).id);
  const decisions=itemReviewTemplate(next),p01=next.sessions.p01,req=p01.state.requirements.find(r=>r.topic==='core-scene');
  decisions.items=[{personaId:'p01',stateHash:sha(p01.state),requirementId:req.id,status:'confirmed'}];
  assert.equal(applyItemReview(next,decisions).recorded,1);assert.equal(next.sessions.p01.itemDecisions[0].actor,'synthetic-test-operator');
  assert.equal(applyItemReview(next,decisions).alreadyRecorded,true);
  assert.equal((await executeStage(next,'firsts',{openTransport:never})).dispatchesThisInvocation,0);
  assert.equal((await executeStage(next,'followups',{openTransport:never,answers:{malformed:'ignored not resent'}})).dispatchesThisInvocation,0);
  collect('two-stage-double-summary.json',{kind:'transport-and-clock-double-NOT-HTTP',first:firstResult,followups:result,
    starts:[...first.calls,...second.calls].map(c=>c.startedAtMs),fixedPersonas:6,paidCalls:0,sourceIdsPreserved:true});
  if(output){writeFileSync(join(output,'two-stage-double-review.md'),renderReport(next));cpSync(root,join(output,'two-stage-double-ledger'),{recursive:true});}
  next.close();
});
test('B14 completed firsts cannot silently start followups; actual question absence yields zero second generation',async()=>{
  const {store}=createStore(),tr=transportDouble({respond:req=>{const result=mockInterview(req);result.question=null;return {status:200,body:{mode:'mock',result},telemetry:goodTelemetry()};}});
  await executeStage(store,'firsts',optionsFor(tr));assert.equal(tr.calls.length,6);
  assert.equal(answerBundleTemplate(store).cases.length,0);
  const result=await executeStage(store,'followups',{openTransport:never,answers:answerBundleTemplate(store),prices:SNAPSHOT});
  assert.equal(result.dispatchesThisInvocation,0);assert.ok(store.data.slots.filter(s=>s.turn===2).every(s=>s.status==='skipped'));
  store.close();
});
test('B15 safe healthy contract rejection is case failed, skips followup, allows only remaining fixed independent cases',async()=>{
  const {root,store}=createStore(),diag={schemaVersion:'init006.diagnostic.1',stage:'content_parse',path:'provider.choices[].message.content',rule:'json_syntax'};
  const tr=transportDouble({respond:(req,n)=>n===1?{status:502,body:{error:{code:'INVALID_RESPONSE',raw:CANARY}},
    telemetry:goodTelemetry({outcome:'INVALID_RESPONSE',diagnostic:diag}),headers:CANARY,reasoning:CANARY}:
    {status:200,body:{mode:'mock',result:mockInterview(req)},telemetry:goodTelemetry()}});
  const result=await executeStage(store,'firsts',optionsFor(tr));
  assert.equal(result.halt,null);assert.equal(tr.calls.length,6);assert.equal(store.data.slots[0].failure.scope,'case');
  assert.equal(store.data.slots.find(s=>s.id==='p01-2').status,'skipped');assert.equal(store.sessions.p01.snapshots.first,undefined);
  assert.ok(!diskText(root).includes(CANARY));assert.ok(!renderReport(store).includes(CANARY));store.close();
});
const badTelemetry=[
  ['auth',goodTelemetry({outcome:'AI_AUTH_FAILED',httpStatus:401}), 'AI_AUTH_FAILED'],
  ['balance',goodTelemetry({outcome:'AI_BALANCE_REQUIRED',httpStatus:402}), 'AI_BALANCE_REQUIRED'],
  ['429',goodTelemetry({outcome:'AI_RATE_LIMIT',httpStatus:429}), 'AI_RATE_LIMIT'],
  ['network',goodTelemetry({outcome:'AI_NETWORK_ERROR',httpStatus:null}), 'AI_NETWORK_ERROR'],
  ['timeout',goodTelemetry({outcome:'AI_TIMEOUT',httpStatus:null}), 'AI_TIMEOUT'],
  ['model',goodTelemetry({returnedModel:'unexpected-model'}), 'MODEL_CHANGED'],
  ['usage',goodTelemetry({usage:{}}), 'USAGE_INVALID'],
  ['total',goodTelemetry({usage:{prompt_tokens:1000,completion_tokens:500,total_tokens:1}}), 'USAGE_INVALID'],
  ['finish',goodTelemetry({finishReason:'length'}), 'FINISH_NOT_STOP'],
  ['input over reservation',goodTelemetry({usage:{prompt_tokens:40001,completion_tokens:1,total_tokens:40002}}), 'INPUT_RESERVE_EXCEEDED'],
  ['output over cap',goodTelemetry({usage:{prompt_tokens:1,completion_tokens:4097,total_tokens:4098}}), 'OUTPUT_CAP_EXCEEDED'],
];
for(const [name,t,expected] of badTelemetry)test(`B16 global ${name} halts batch and persists consumed slot; DOUBLE`,async()=>{
  const {root,store}=createStore(),tr=transportDouble({respond:()=>({status:502,body:{raw:CANARY},telemetry:t})});
  const result=await executeStage(store,'firsts',optionsFor(tr));assert.equal(tr.calls.length,1);assert.equal(result.halt.code,expected);
  assert.equal(store.data.slots[0].status,'failed');assert.equal(result.reservedUsd,0.0169152);
  assert.ok(!diskText(root).includes(CANARY));store.close();
  const reopened=openLedger(root,identity);await assert.rejects(executeStage(reopened,'followups',{openTransport:never}),/GLOBAL_HALTED/);reopened.close();
});
test('B17 state application/guard rejection is global, unlike contract rejection',()=>{
  const d={schemaVersion:'init006.diagnostic.1',stage:'state_apply',path:'state',rule:'invariant_failed'};
  assert.deepEqual(failurePolicy(goodTelemetry(),d,'INVALID_RESPONSE'),{scope:'global',code:'STATE_INVARIANT_FAILED'});
  assert.equal(telemetryHalt(goodTelemetry()),null);
});
for(const status of ['reserved','dispatched'])test(`B18 durable ${status} journal save failure: upstream send zero, no refund/replay; DOUBLE`,async()=>{
  const {root,store}=createStore({beforeWrite:(path,value)=>{if(path.includes('journal')&&value.data?.slots[0].status===status)throw Error('SYNTHETIC_DISK_FULL');}});
  const tr=transportDouble();await assert.rejects(executeStage(store,'firsts',optionsFor(tr)),/OUTPUT_WRITE_FAILED/);
  assert.equal(tr.calls.length,0);assert.equal(store.poisoned,true);store.close();assert.ok(existsSync(join(root,'active.lock')));
  assert.throws(()=>openLedger(root,identity),/LEDGER_LOCKED/);
});
for(const dispatched of [false,true])test(`B19 real child-process termination ${dispatched?'after dispatch record':'reserved undispatched'}: never reclaims or retries; transport DOUBLE`,()=>{
  const parent=temp(),root=join(parent,'run'),marker=join(parent,'dispatches.txt');
  const helper=new URL('./init007b-helpers.mjs',import.meta.url).href,engine=new URL('../scripts/init007b/engine.mjs',import.meta.url).href,
    ledger=new URL('../scripts/init007b/ledger.mjs',import.meta.url).href;
  const script=`import {writeFileSync} from 'node:fs';import {openLedger} from ${JSON.stringify(ledger)};
    import {identity,transportDouble,optionsFor} from ${JSON.stringify(helper)};import {executeStage} from ${JSON.stringify(engine)};
    const s=openLedger(${JSON.stringify(root)},identity,{initialize:true}),t=transportDouble();
    t.generate=async(req,{onDispatch})=>{${dispatched?'onDispatch();':''}writeFileSync(${JSON.stringify(marker)},${JSON.stringify(dispatched?'dispatch-uncertain':'reserved-only')});process.exit(23);};
    await executeStage(s,'firsts',optionsFor(t));`;
  const child=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',env:{PATH:process.env.PATH}});
  assert.equal(child.status,23,child.stderr);const snapshot=readLedger(root,identity);
  assert.equal(snapshot.data.slots[0].status,dispatched?'dispatched':'reserved');assert.ok(snapshot.data.slots[0].reservation);
  assert.throws(()=>openLedger(root,identity),/LEDGER_LOCKED/);assert.throws(()=>stageGate(snapshot,'firsts'),/STAGE_ALREADY_STARTED/);
  assert.equal(readFileSync(marker,'utf8'),dispatched?'dispatch-uncertain':'reserved-only');
});

test('B20 malformed answer JSON preserves input bytes/state and only adds a safe digest; corrected uncalled input accepted',async()=>{
  const {store}=createStore(),tr=transportDouble();await executeStage(store,'firsts',optionsFor(tr));
  const file=join(temp(),'answers.json'),bad='{"answers":',before=clone(store.sessions);writeFileSync(file,bad);
  assert.throws(()=>readAnswerDocument(store,file),/ANSWER_FILE_JSON/);assert.equal(readFileSync(file,'utf8'),bad);
  assert.deepEqual(store.sessions,before);assert.equal(tr.calls.length,6);assert.equal(store.data.stages.followups,'pending');
  assert.equal(store.data.events.at(-1).digest,sha(bad));
  writeFileSync(file,JSON.stringify(fixedAnswers(store)));assert.doesNotThrow(()=>prepareAnswers(store,readAnswerDocument(store,file)));store.close();
});
test('B21 edited durable reservation/journal before dispatch cannot be acknowledged or sent',async()=>{
  const {root,store}=createStore();const tr=transportDouble({beforeDispatch:()=>{
    const name=readdirSync(join(root,'journal')).sort().at(-1),path=join(root,'journal',name);
    const row=JSON.parse(readFileSync(path));row.data.slots[0].reservedAtMs++;writeFileSync(path,JSON.stringify(row));
  }});
  await assert.rejects(executeStage(store,'firsts',optionsFor(tr)),/OUTPUT_WRITE_FAILED/);
  assert.equal(tr.calls.length,0);assert.equal(store.poisoned,true);store.close();
});
test('B22 unpaid live entry fails before credential access or creation of the fixed live ledger',async()=>{
  const existed=existsSync(LIVE_DIR);const env={ALLOW_PAID_AI:'false',get DEEPSEEK_API_KEY(){assert.fail('No key access');}};
  await assert.rejects(runCommand('--firsts',{env}),/LIVE_NOT_AUTHORIZED/);assert.equal(existsSync(LIVE_DIR),existed);
});
test('B23 ledger rejects dynamic input/headers as metadata rather than allowing input to define run identity',()=>{
  const {store}=createStore();const data=clone(store.data);data.events.push({kind:'input_rejected',code:null,digest:sha('x'),atMs:1,headers:CANARY});
  assert.throws(()=>store.commit(data),/OUTPUT_WRITE_FAILED/);assert.equal(store.poisoned,true);store.close();
});


test('B24 persisted completion floor covers durable-dispatch fsync delay before actual upstream send',()=>{
  // Dispatch intent 100000; slow fsync could send at 106000; response ends 106500.
  // A new process must not send at 112000 based only on the intent timestamp.
  const slots=[{startedAtMs:100000,endedAtMs:106500}];
  assert.equal(rateDelay(slots,112000),6500);
  assert.equal(rateDelay(slots,118500),0);
  assert.throws(()=>rateDelay(slots,106499),/CLOCK_ROLLBACK/);
});
