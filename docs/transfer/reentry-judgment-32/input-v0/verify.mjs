// Re-run against the final integrated compiled shared modules without rebuilding/replacing inputs.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {loadAPI,sha,returnFromH} from './api.mjs';
const api=await loadAPI(),d=api.domain,v=api.validation,a=api.attention;
const root=new URL('./generated-v0/',import.meta.url);
const read=async p=>readFile(new URL(p,root),'utf8');
const t0=v.parseProject(await read('observer-input/T0.json')),t2=v.parseProject(await read('observer-input/T2.json'));
const f=JSON.parse(await read('sealed-answer/FACTS.json')),ids=f.ids,tasks=f.tasks;
assert.equal(t0.id,t2.id);assert.equal(t2.space.areas.length,5);
assert.deepEqual(Object.keys(t2.space.containment.parents).sort(),[ids.A,ids.B,ids.C].sort());
assert.equal(api.hierarchy.areaPath(t2,ids.A).length,2);assert.equal(api.hierarchy.areaPath(t2,ids.C).length,2);
const A0=d.areaDescription(t0,ids.A),A2=d.areaDescription(t2,ids.A);
assert.equal(A0.current.entry.revision,1);assert.ok(A0.current.summary.includes('10행'));
assert.equal(A2.current.entry.revision,3);assert.equal(A2.current.valid,true);assert.ok(A2.current.summary.includes('20행'));assert.deepEqual(A2.current.changes,[]);
assert.equal(A2.previous.find(x=>x.entry.revision===2).summary,A2.current.summary);assert.equal(A2.previous.find(x=>x.entry.revision===2).changes.length,1);
for(const k of ['A','B'])assert.equal(a.subtreeSignals(t2,ids[k])[0].questions.length,1);
assert.equal(d.questionAnswered(t2,d.taskOf(t2,tasks.A)),true);assert.equal(d.questionApplicability(t2,d.taskOf(t2,tasks.A)),'answered');
assert.equal(d.questionAnswered(t2,d.taskOf(t2,tasks.B)),false);assert.equal(d.questionApplicability(t2,d.taskOf(t2,tasks.B)),'active');
assert.deepEqual(d.areaDescription(t0,ids.B),d.areaDescription(t2,ids.B));
const C0=d.areaDescription(t0,ids.C),C2=d.areaDescription(t2,ids.C);
assert.equal(C0.current.valid,false);assert.equal(C2.current.valid,false);assert.equal(C0.current.summary,C2.current.summary);
assert.equal(C2.current.entry.revision,1);assert.equal(C2.held.length,1);assert.equal(C2.held[0].entry.held,'plan-changed');assert.equal(C2.held[0].entry.revision,null);
for(const p of [t0,t2]){assert.equal(p.currentTaskId,tasks.D);assert.equal(d.areaOf(p,d.taskOf(p)),ids.output);assert.equal(p.space.draftTarget.area,ids.read);assert.equal(p.draft,f.current.draft);assert.deepEqual(d.taskOf(p,tasks.D).manual,f.work.D.T0);}
for(const key of ['scope','checks'])assert.equal(d.taskOf(t0,tasks.A).manual[key],d.taskOf(t2,tasks.A).manual[key]);
assert.deepEqual(t0.bases,t2.bases);assert.deepEqual(t0.space.layout,t2.space.layout);assert.deepEqual(t0.space.containment,t2.space.containment);assert.deepEqual(t0.space.relations,t2.space.relations);
for(const source of t0.sources)assert.deepEqual(t2.sources.find(x=>x.id===source.id),source);
for(const x of f.exports){
  const text=await read(`preparer-artifacts/${x.label}-original-H.md`),record=d.taskOf(t2,x.task).handoffs.find(h=>h.returnId===x.H);
  assert.equal(sha(text),x.textSHA256);assert.equal(text.length,record.chars);assert.equal(v.digest(text),record.digest);assert.deepEqual(record,x.record);
  const sample=returnFromH(text,{report:'[합성32 검증 전용] 이 문자열을 제품에 수신시키지 않는다.'});v.parseResultFile(JSON.stringify(sample));
  assert.equal(sample.taskId,x.task);assert.equal(sample.returnId,x.H);
}
for(const x of f.receipt){
  const raw=await read(`preparer-artifacts/${x.label}-return.2.json`),i=d.inspectResultFile(t2,raw);assert.equal(sha(raw),x.rawSHA256);
  assert.equal(i.duplicate.id,x.task);assert.equal(i.file.returnId,x.H);assert.equal(i.file.understanding.basedOn,x.basedOn);
}
const result={status:'PASS',runtime:process.version,kind:'pure parse/domain/hash only; no UI/storage injection',T0SHA256:sha(await read('observer-input/T0.json')),T2SHA256:sha(await read('observer-input/T2.json')),binding:api.binding,limitations:f.limitations};
const out=process.argv.indexOf('--receipt');if(out>=0)await writeFile(process.argv[out+1],JSON.stringify(result,null,2),'utf8');
console.log(JSON.stringify(result));
