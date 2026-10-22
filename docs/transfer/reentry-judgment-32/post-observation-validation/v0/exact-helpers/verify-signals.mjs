// Explicit public projection proof, not an inference from one source string.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {loadAPI} from './api.mjs';
const api=await loadAPI(),d=api.domain,a=api.attention,v=api.validation,root=new URL('./generated-v0/',import.meta.url);
const read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const f=await read('sealed-answer/FACTS.json'),t0=v.parseProject(JSON.stringify(await read('observer-input/T0.json'))),t2=v.parseProject(JSON.stringify(await read('observer-input/T2.json')));
const stages={};
for(const [name,p] of [['T0',t0],['T2',t2]]){
  const A=a.subtreeSignals(p,f.ids.A)[0].questions,B=a.subtreeSignals(p,f.ids.B)[0].questions;
  assert.equal(A.length,1);assert.equal(B.length,1);
  assert.equal(A[0].taskId,f.tasks.A);assert.equal(A[0].answered,true);assert.equal(A[0].applicability,'answered');assert.equal(A[0].status,'답변 기록 있음');
  assert.equal(B[0].taskId,f.tasks.B);assert.equal(B[0].answered,false);assert.equal(B[0].applicability,'active');assert.equal(B[0].status,'제품 선택 항목 있음');
  assert.equal(d.questionAnswered(p,d.taskOf(p,f.tasks.A)),true);assert.equal(d.questionAnswered(p,d.taskOf(p,f.tasks.B)),false);
  const sources=d.taskOf(p,f.tasks.A).sourceIds.map(id=>p.sources.find(s=>s.id===id));
  assert.equal(sources.some(s=>s.kind==='test_answer'),false);assert.equal(sources.some(s=>s.kind==='answer'&&s.replyTo===d.taskOf(p,f.tasks.A).advice.question.text),true);
  const C=d.areaDescription(p,f.ids.C);assert.equal(C.current.valid,false);assert.equal(C.current.entry.revision,1);
  stages[name]={A:A[0],B:B[0],AReplyKinds:sources.map(s=>s.kind),C:{currentValid:C.current.valid,currentRevision:C.current.entry.revision,summary:C.current.summary,held:C.held.map(x=>x.entry.held)}};
}
assert.equal(stages.T0.C.summary,stages.T2.C.summary);assert.deepEqual(stages.T0.C.held,[]);assert.deepEqual(stages.T2.C.held,['plan-changed']);
for(const key of ['scope','checks'])assert.equal(d.taskOf(t0,f.tasks.A).manual[key],d.taskOf(t2,f.tasks.A).manual[key]);
for(const key of ['B','C','D'])assert.deepEqual(d.taskOf(t0,f.tasks[key]).manual,d.taskOf(t2,f.tasks[key]).manual);
const result={status:'PASS',runtime:process.version,fixtureNature:'labelled synthetic fixture uses normal answer API; not testimony by a real user and not test_answer API',stages,manualPreservation:{A:'scope/checks unchanged; U/N explicit10→20',B:true,C:true,D:true},HAndRawProof:'verify.mjs separately checks all six original export records, UTF16/FNV/SHA and six exact return raw files'};
await writeFile(new URL('sealed-answer/QUESTION_SIGNAL_PROOF.json',root),JSON.stringify(result,null,2),'utf8');console.log(JSON.stringify(result));
