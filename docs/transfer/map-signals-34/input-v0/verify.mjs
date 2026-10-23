import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const args=process.argv.slice(2),get=k=>args[args.indexOf(k)+1];
for(const k of ['--module-root','--input-root','--receipt'])assert(args.includes(k),k+' required');
const root=path.resolve(get('--input-root')),mod=path.resolve(get('--module-root'));
const D=await import(pathToFileURL(path.join(mod,'domain.js'))),V=await import(pathToFileURL(path.join(mod,'validation.js'))),A=await import(pathToFileURL(path.join(mod,'attention.js')));
const files=fs.readdirSync(root).sort(),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const before=files.map(name=>({name,sha256:sha(fs.readFileSync(path.join(root,name)))}));
const raw=fs.readFileSync(path.join(root,'mixed-long-title.json')),p=V.parseProject(raw.toString('utf8')),facts=JSON.parse(fs.readFileSync(path.join(root,'FACTS.json'))),qExpected=facts.expectedQuestions;
const observations=[];
for(const e of facts.expectedAreas){const signals=A.subtreeSignals(p,e.id),questions=signals.flatMap(x=>x.questions),ids=questions.map(q=>q.taskId);assert.equal(ids.length,new Set(ids).size,'raw ID array has no hidden duplicate');assert.deepEqual(signals.map(x=>x.areaId),e.owners);assert.equal(questions.length,e.N);assert.equal(questions.filter(x=>x.applicability==='active'&&!x.answered).length,e.M);assert.deepEqual(new Set(ids),new Set(qExpected.filter(q=>q.inN&&e.owners.includes(q.owner)).map(q=>q.id)));observations.push({key:e.key,rawQuestionIds:ids,N:questions.length,M:questions.filter(x=>x.applicability==='active'&&!x.answered).length});}
for(const key of ['P_CURRENT','Q_STALE','S_HELD_ONLY']){const fileRaw=fs.readFileSync(path.join(root,'return-'+key+'.json'),'utf8'),f=V.parseResultFile(fileRaw),task=D.taskOf(p,f.taskId),h=task.handoffs.find(h=>h.returnId===f.returnId),text=fs.readFileSync(path.join(root,'handoff-'+key+'.md'),'utf8');assert(h&&h.chars===text.length&&h.digest===V.digest(text));const blocks=[...text.matchAll(/```json\s*([\s\S]*?)```/g)].map(m=>{try{return JSON.parse(m[1])}catch{return null}}),template=blocks.find(x=>x?.schemaVersion==='agentflow.return.2');assert.equal(template.returnId,f.returnId);assert.equal(template.taskId,f.taskId);assert.equal(template.projectId,f.projectId);assert(p.tasks.some(t=>t.parentTaskId===f.taskId&&t.resultFile?.returnId===f.returnId&&t.resultFile.rawText===fileRaw));}
assert.equal(JSON.stringify(V.parseProject(JSON.stringify(p))),JSON.stringify(p));
const after=files.map(name=>({name,sha256:sha(fs.readFileSync(path.join(root,name)))}));assert.deepEqual(after,before);
const receipt={node:process.version,actualChecksPassed:true,strictReload:true,exactHAndRawReturns:true,rawIDsBeforeDedupVerified:true,inputFilesUnchanged:true,inputFiles:before,observations,UI:'NOT_RUN'};
fs.writeFileSync(get('--receipt'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({verified:true,files:files.length,rawInputSHA256:sha(raw),UI:'NOT_RUN'}));
