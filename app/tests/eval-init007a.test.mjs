import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createSession, generate, answerTemplate, submitAnswers, previewResolution, cancelResolution,
  confirmResolution, reviewItem, branchEvidence } from '../scripts/init007a/evaluator.mjs';
import { createEvidenceStore, submitAnswerFile, renderReview } from '../scripts/init007a/evidence.mjs';
import { personas } from '../scripts/init007a/personas.mjs';
import { openMockHttp, MIN_INTERVAL_MS } from '../scripts/init007a/http.mjs';
import { mockInterview } from '../server/providers/mock.mjs';

const clone = v=>structuredClone(v);
const CANARY='REJECTED_PROVIDER_CONTENT_DO_NOT_PERSIST_007A'; // Synthetic canary, not a secret.
const evidenceRoot=process.env.INIT007A_TEST_OUTPUT || await mkdtemp(join(tmpdir(),'agentflow-007a-'));
const documentFor=(s,factId,optionId=null,disposition='answered',text)=>{
  const fact=s.persona.facts.find(f=>f.id===factId);assert.ok(fact);
  const doc=answerTemplate(s);doc.answers=[{factIds:[factId],optionId,disposition,text:text??fact.text}];return doc;
};
const double=fn=>({kind:'mock-test-double',generate:fn});
const validDouble=double(async req=>({status:200,body:{mode:'mock',result:mockInterview(req)}}));
const reqBy=(s,topic)=>s.state.requirements.find(r=>r.topic===topic);
async function submitFile(s,doc,file,save){await writeFile(file,JSON.stringify(doc,null,2));await submitAnswerFile(s,file);await save(s);}
function sourceIdsStay(before,after){for(const s of before.sources) assert.deepEqual(after.sources.find(x=>x.id===s.id),s);}

// ONLY real HTTP scenario batch in this file: one unmodified createApp, one limiter,
// 11 requests total, sequential starts >=12 seconds apart. No real provider.
test('I7A actual local HTTP: six fixed personas, same-state two-turn lifecycle (no real provider)',async t=>{
  const save=await createEvidenceStore(join(evidenceRoot,'http-evidence'));
  const transport=await openMockHttp();t.after(()=>transport.close());
  assert.deepEqual(transport.config,{mode:'mock',allowPaid:false,rate:6,cap:20,concurrency:2});
  const sessions=[];
  for(const persona of personas){
    await t.test(persona.id+' '+persona.title,async()=>{
      const s=createSession(persona.id);sessions.push(s);const projectId=s.state.id;
      await generate(s,transport,save);
      assert.equal(s.generations[0].status,'succeeded');assert.equal(s.generations[0].httpStatus,200);
      assert.equal(s.generations[0].transport,'mock-http');assert.equal(s.state.id,projectId);
      assert.equal(s.generations[0].validatedEnvelope.result.projectId,projectId);
      const first=clone(s.state),q=s.state.question;
      // The answer writer sees the ACTUAL validated question; no fixture question injected.
      if(!q){
        assert.equal(persona.id,'p02');assert.equal(s.phase,'question_absent');
        const calls=transport.observations.length;
        await assert.rejects(generate(s,transport,save),/GENERATION_NOT_READY/);
        assert.equal(transport.observations.length,calls);
        assert.deepEqual(branchEvidence(s),{storage:'unevaluated',conflict:'unevaluated',secondGeneration:'not_called',quality:'human_review_pending'});
        const core=reqBy(s,'core-scene');reviewItem(s,core.id,'deferred');await save(s);
        assert.equal(s.generations.length,1);assert.equal(reqBy(s,'core-scene').status,'deferred');return;
      }
      assert.ok(q.text&&q.reason&&q.example&&q.options.every(o=>o.label&&o.consequence));
      assert.deepEqual(q,s.snapshots.first.question);
      const file=join(evidenceRoot,`${persona.id}-answer.json`);
      if(persona.id==='p01'){
        assert.equal(q.topic,'core-scene');const option=q.options.find(o=>o.id==='record');assert.ok(option);
        await submitFile(s,documentFor(s,'F-core',option.id),file,save);
        const after=clone(s.state),count=s.generations.length;
        assert.throws(()=>submitAnswers(s,documentFor({...s,state:first},'F-core',option.id)),/ANSWER_FILE_CONTEXT/);
        assert.deepEqual(s.state,after);assert.equal(s.generations.length,count);
      } else if(persona.id==='p03'){
        assert.equal(q.topic,'storage');
        await submitFile(s,documentFor(s,'F-unknown',null,'unknown'),file,save);
        const unknown=clone(s.state),answer=s.state.answers.at(-1);
        assert.equal(reqBy(s,'storage').status,'deferred');assert.equal(answer.optionId,null);
        await submitFile(s,documentFor(s,'F-defer',null,'deferred'),file,save);
        assert.equal(s.state.answers.at(-1).id,answer.id);assert.equal(s.state.answers.at(-1).disposition,'deferred');
        assert.equal(reqBy(s,'storage').status,'deferred');sourceIdsStay(unknown,s.state);
      } else if(persona.id==='p04'){
        assert.equal(q.topic,'storage');const option=q.options.find(o=>o.id==='multi-device');assert.ok(option);
        const old=clone(reqBy(s,'storage'));
        await submitFile(s,documentFor(s,'F-new',option.id),file,save);
        assert.equal(s.state.conflicts.length,1);assert.deepEqual(reqBy(s,'storage'),{...old,needsReview:true});
        const conflicted=clone(s.state),preview=previewResolution(s,old.id,'apply');
        assert.deepEqual(s.state,conflicted);assert.notEqual(preview.acceptance,old.acceptance);
        await assert.rejects(generate(s,transport,save),/UNRESOLVED_PREVIEW/);
        cancelResolution(s);assert.deepEqual(s.state,conflicted);
        previewResolution(s,old.id,'apply');confirmResolution(s);
        assert.equal(s.state.conflicts.length,0);assert.equal(reqBy(s,'storage').id,old.id);
        assert.equal(reqBy(s,'storage').locked,true);assert.equal(reqBy(s,'storage').status,'confirmed');
        assert.equal(reqBy(s,'storage').acceptance,preview.acceptance);sourceIdsStay(conflicted,s.state);
        assert.equal(branchEvidence(s).conflict,'observed');await save(s);
      } else if(persona.id==='p05'){
        assert.equal(q.topic,'storage');const before=clone(s),calls=transport.observations.length;
        await writeFile(file,'{"answers":');
        await assert.rejects(submitAnswerFile(s,file),/ANSWER_FILE_JSON/);assert.deepEqual(s,before);
        await writeFile(file,JSON.stringify(documentFor(s,'F-long',null,'answered','가'.repeat(1501))));
        const originalFile=await readFile(file,'utf8');
        await assert.rejects(submitAnswerFile(s,file),/INVALID_ANSWER/);assert.deepEqual(s,before);
        assert.equal(await readFile(file,'utf8'),originalFile);assert.equal(transport.observations.length,calls);
        const longDoc=documentFor(s,'F-long');assert.equal(longDoc.answers[0].text.length,1490);
        await submitFile(s,longDoc,file,save);const longState=clone(s.state),oldAnswer=s.state.answers.at(-1);
        assert.equal(oldAnswer.text,longDoc.answers[0].text);assert.equal(reqBy(s,'storage').status,'proposed');
        assert.ok(reqBy(s,'storage').text.length<=800);assert.ok(reqBy(s,'storage').acceptance.startsWith('TBD:'));
        assert.equal(s.state.sources.find(x=>x.id===oldAnswer.sourceId).text,`${q.text}\n${oldAnswer.text}`);
        await submitFile(s,documentFor(s,'F-revised'),file,save);
        assert.equal(s.state.answers.at(-1).id,oldAnswer.id);sourceIdsStay(longState,s.state);
        assert.equal(transport.observations.length,calls);
      } else if(persona.id==='p06'){
        assert.equal(q.topic,'storage');const option=q.options.find(o=>o.id==='multi-device');assert.ok(option);
        await submitFile(s,documentFor(s,'F-storage',option.id),file,save);
      } else assert.fail('Unexpected persona');
      assert.equal(s.phase,'ready_second');const answered=clone(s.state);
      await generate(s,transport,save);
      assert.equal(s.phase,'completed');assert.equal(s.generations.length,2);assert.equal(s.state.id,projectId);
      assert.equal(s.generations[1].request.projectId,projectId);assert.equal(s.generations[1].request.stage,'summarize');
      assert.equal(s.generations[1].request.baseVersion,answered.version+1);
      assert.deepEqual(s.generations[1].request.answers,answered.answers);sourceIdsStay(answered,s.state);
      assert.ok(s.state.summary);assert.equal(s.state.question,null);
      assert.ok(s.state.requirements.every(r=>r.scope==='user-project'&&r.sourceIds.every(id=>s.state.sources.some(x=>x.id===id))));
      assert.ok(s.state.requirements.every(r=>!r.id.includes('other-project')));
      assert.equal(s.quality.status,'human_review_pending');assert.ok(s.quality.rubric.every(r=>r.status==='human_review_pending'));
      if(persona.id==='p01'){
        const old=first.requirements.find(r=>r.topic==='core-scene'),now=reqBy(s,'core-scene');
        assert.equal(now.id,old.id);assert.notEqual(now.text,old.text);assert.notEqual(now.acceptance,old.acceptance);
        assert.equal(now.status,'proposed');assert.ok(now.sourceIds.includes(answered.answers[0].sourceId));
        reviewItem(s,now.id,'confirmed');assert.equal(reqBy(s,'core-scene').status,'confirmed');
      }
      if(persona.id==='p03') assert.equal(reqBy(s,'storage').status,'deferred');
      if(persona.id==='p04') {assert.equal(reqBy(s,'storage').locked,true);assert.equal(reqBy(s,'storage').status,'confirmed');}
      if(persona.id==='p05') assert.equal(reqBy(s,'storage').status,'proposed');
      if(persona.id==='p06') {assert.equal(reqBy(s,'core-scene').status,'proposed');assert.match(reqBy(s,'tools').text,/Claude만/);}
      await save(s);const persisted=JSON.parse(await readFile(join(evidenceRoot,'http-evidence',persona.id,'session.json')));
      assert.deepEqual(persisted,s);const report=await readFile(join(evidenceRoot,'http-evidence',persona.id,'review.md'),'utf8');
      assert.ok(report.includes(q.reason)&&report.includes(q.example)&&report.includes(q.options[0].consequence));
      assert.ok(report.includes(s.state.summary));
      const called=transport.observations.length;await assert.rejects(generate(s,transport,save),/GENERATION_NOT_READY/);
      assert.equal(transport.observations.length,called);
    });
  }
  assert.equal(transport.observations.length,11);
  assert.ok(transport.observations.every(o=>o.httpStatus===200));
  assert.ok(transport.observations.slice(1).every(o=>o.gapMs>=MIN_INTERVAL_MS));
  assert.equal(new Set(transport.observations.map(o=>o.requestId)).size,11);
  await writeFile(join(evidenceRoot,'http-observations.json'),JSON.stringify({kind:'actual-local-http',provider:'mock',
    limits:transport.config,observations:transport.observations,paidCalls:0,quality:'human_review_pending'},null,2)+'\n');
  await writeFile(join(evidenceRoot,'summary.json'),JSON.stringify(sessions.map(s=>({persona:s.persona.id,phase:s.phase,
    calls:s.generations.length,branches:branchEvidence(s),projectId:s.state.id})),null,2)+'\n');
});

test('I7A fixed personas distribute tools/storage without inventing quotas or Studio cloud',()=>{
  assert.equal(personas.length,6);assert.deepEqual(new Set(personas.map(p=>p.brief.tools)),new Set(['undecided','codex-only','claude-only','mixed']));
  assert.deepEqual(new Set(personas.map(p=>p.directChoices.customerStorage)),new Set(['undecided','browser-only','multi-device']));
  for(const p of personas){assert.equal(p.synthetic,true);assert.ok(p.expectedChanges.length);assert.ok(p.facts.every(f=>f.id&&f.text&&f.knownAt));}
});

test('I7A rejected envelope is atomic and never persists provider raw/reasoning/headers (mock adapter double, not HTTP)',async()=>{
  const s=createSession('p01'),save=await createEvidenceStore(join(evidenceRoot,'rejection-evidence'));let calls=0;
  await generate(s,double(async req=>{calls++;const result=mockInterview(req);result.summary=CANARY;
    result.proposals[0].sourceIds=[CANARY];return {status:200,body:{mode:'mock',result},headers:{private:CANARY},reasoning:CANARY};}),save);
  assert.equal(s.phase,'failed');assert.equal(s.generations[0].status,'rejected');assert.equal(s.state.error,'INVALID_RESPONSE');
  assert.equal(s.state.summary,'');assert.equal(s.generations[0].validatedEnvelope,undefined);
  assert.deepEqual(s.generations[0].diagnostics,[{schemaVersion:'init006.diagnostic.1',stage:'state_contract',path:'result.proposals[].sourceIds[]',rule:'known_source'}]);
  assert.ok(!JSON.stringify(s).includes(CANARY));assert.ok(!renderReview(s).includes(CANARY));
  for(const f of await readdir(join(evidenceRoot,'rejection-evidence','p01'))) assert.ok(!(await readFile(join(evidenceRoot,'rejection-evidence','p01',f),'utf8')).includes(CANARY));
  await assert.rejects(generate(s,validDouble,save),/GENERATION_NOT_READY/);assert.equal(calls,1);
});

test('I7A HTTP-error adapter double and thrown transport data are not logged or retried',async()=>{
  for(const fail of [async()=>({status:429,body:{error:{code:'LOCAL_RATE_LIMIT',raw:CANARY}},headers:CANARY}),async()=>{throw new Error(CANARY);}]){
    const s=createSession('p01');let calls=0;
    const transport=double(async req=>{calls++;return fail(req);});await generate(s,transport);
    assert.equal(s.phase,'failed');assert.ok(!JSON.stringify(s).includes(CANARY));assert.ok(!renderReview(s).includes(CANARY));
    await assert.rejects(generate(s,transport),/GENERATION_NOT_READY/);assert.equal(calls,1);
  }
});

test('I7A pre-dispatch save failure and post-dispatch save failure never replay a generation',async()=>{
  const s=createSession('p01');let calls=0;
  const transport=double(async req=>{calls++;return validDouble.generate(req);});
  await assert.rejects(generate(s,transport,async()=>{throw new Error(CANARY);}));
  assert.equal(calls,0);assert.equal(s.phase,'in_flight');await assert.rejects(generate(s,transport),/GENERATION_NOT_READY/);
  const second=createSession('p01');let saves=0;
  await assert.rejects(generate(second,transport,async()=>{if(++saves===2)throw new Error(CANARY);}));
  assert.equal(calls,1);assert.equal(second.phase,'awaiting_answer');
  await assert.rejects(generate(second,transport),/GENERATION_NOT_READY/);assert.equal(calls,1);
});

test('I7A answer file validation is atomic across multiple rows, IDs/versions/facts and extra fields',async()=>{
  const s=createSession('p01');await generate(s,validDouble);const before=clone(s);
  const doc=documentFor(s,'F-core','record');
  for(const change of [d=>d.projectId='P-other',d=>d.baseVersion++,d=>d.questionId='Q-other',d=>d.personaId='p06',
    d=>d.answers[0].factIds=['not-a-fact'],d=>d.answers[0].extra=CANARY,d=>d.extra=CANARY]){
    const bad=clone(doc);change(bad);assert.throws(()=>submitAnswers(s,bad));assert.deepEqual(s,before);
  }
  const bad=clone(doc);bad.answers.push({factIds:['F-core'],optionId:'not-an-option',disposition:'answered',text:'수정'});
  assert.throws(()=>submitAnswers(s,bad),/INVALID_ANSWER/);assert.deepEqual(s,before);
});

test('I7A wrong project/version/envelope mode rejection never becomes accepted mock content',async()=>{
  for(const mutate of [r=>r.result.projectId='P-other',r=>r.result.baseVersion++,r=>r.mode='deepseek']){
    const s=createSession('p01');await generate(s,double(async req=>{const body={mode:'mock',result:mockInterview(req)};mutate(body);return{status:200,body};}));
    assert.equal(s.phase,'failed');assert.equal(s.generations[0].validatedEnvelope,undefined);assert.equal(s.state.summary,'');
  }
  const s=createSession('p01');await assert.rejects(generate(s,{kind:'live',generate(){assert.fail();}}),/MOCK_ONLY/);
  assert.equal(s.generations.length,0);
});

test('I7A missing question marks unrelated storage/conflict as unevaluated (adapter double)',async()=>{
  const s=createSession('p01');await generate(s,double(async req=>{const result=mockInterview(req);result.question=null;return{status:200,body:{mode:'mock',result}};}));
  assert.equal(s.phase,'question_absent');assert.equal(branchEvidence(s).storage,'unevaluated');
  assert.equal(branchEvidence(s).conflict,'unevaluated');assert.throws(()=>submitAnswers(s,answerTemplate(s)),/ANSWER_NOT_EXPECTED/);
});

test('I7A CLI rejects live/bare invocation; evidence directory cannot be reused',async()=>{
  for(const args of [[],['--live'],['--mock','--out','anywhere','--endpoint','https://example.invalid']]){
    const proc=spawnSync(process.execPath,['scripts/init007a/run.mjs',...args],{cwd:resolve('.'),encoding:'utf8',env:{PATH:process.env.PATH}});
    assert.equal(proc.status,1);assert.ok(!proc.stdout);assert.match(proc.stderr,/MOCK_ONLY|ARGUMENTS/);
  }
  const dir=join(evidenceRoot,'exclusive-directory');await createEvidenceStore(dir);
  await assert.rejects(createEvidenceStore(dir),/OUTPUT_DIRECTORY_UNAVAILABLE/);
});
