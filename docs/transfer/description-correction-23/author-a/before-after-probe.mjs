// Synthetic transport proof only. No server/browser/provider call or semantic AI evaluation.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as Old from '../product21-author/app/continuity/dist/public/shared/domain.js';
import * as Now from '../product23-author/app/continuity/dist/public/shared/domain.js';
import {mockAdvice} from '../product21-author/app/continuity/dist/public/shared/mock.js';
import {validateRequest as oldValidate} from '../product21-author/app/continuity/dist/public/shared/validation.js';
import {validateRequest} from '../product23-author/app/continuity/dist/public/shared/validation.js';
import {buildBody,SYSTEM_PROMPT} from '../product23-author/app/continuity/server/prompt.mjs';
const copy=v=>structuredClone(v),sha=b=>createHash('sha256').update(b).digest('hex');
const oldProof=JSON.parse(readFileSync(new URL('../description-correction-probe/probe-evidence.json',import.meta.url),'utf8'));
for(const f of oldProof.provenance){
  assert.equal(sha(readFileSync(new URL('../product21-author/'+f.path,import.meta.url))),f.sourceSHA256.toLowerCase());
  assert.equal(sha(readFileSync(new URL('../product21-author/'+f.path.replace('src/shared/','dist/public/shared/').replace(/\.ts$/,'.js'),import.meta.url))),f.distSHA256.toLowerCase());
}
const inputs=oldProof.inputs;
let p=Old.addArea(Old.setBrief(Old.createProject(),inputs.brief),'문서 보관 안내 · 합성',inputs.note),area=p.space.areas[0].id;
p=Old.submit(Old.editDraft(p,inputs.firstRequest),undefined,area);const A=p.currentTaskId;
let start=Old.begin(p);p=Old.receive(start.project,start.request,{mode:'mock',ticket:start.request.ticket,advice:{...mockAdvice(start.request),...inputs.oldAIWork}});
const H='H_DESCRIPTION23_BEFORE_AFTER',anchor=Old.exportAnchor(p,Old.taskOf(p,A));
p=Old.markHandoff(p,A,Old.handoffText(p,A,H),'clipboard',p.revision,H,anchor);
const file={schemaVersion:'agentflow.return.2',projectId:p.id,taskId:A,returnId:H,report:inputs.report,evidence:null,
  understanding:{version:'understanding.1',areaId:area,basedOn:anchor.understanding,summary:inputs.externalDescription,changes:[],proposal:null,origin:'[합성] 동일 상태 전후 전달 검사'}};
p=Old.importResultFile(p,JSON.stringify(file));const report=p.currentTaskId;
const before=copy(p);p=Old.correctUnderstanding(p,area,inputs.correction);
assert.deepEqual(p.tasks,before.tasks);assert.deepEqual(p.sources,before.sources);assert.deepEqual(p.bases,before.bases);assert.deepEqual(p.space.areas,before.space.areas);
const originalH=copy(Old.taskOf(p,A).handoffs),corrected=copy(p);
function compare(project,id,label){
  const ticket=Old.begin(project,id).request.ticket,old=Old.buildRequest(project,ticket),now=Now.buildRequest(project,ticket),without=copy(now);
  delete without.currentAreaDescription;
  assert.equal(JSON.stringify(without),JSON.stringify(old),'all pre-existing request fields retain exact JSON shape/values');
  assert.equal(JSON.stringify(old).includes('SYNTH_CORRECTED_30_DAYS'),false);
  assert.equal(now.currentAreaDescription.text,inputs.correction);assert.equal(now.currentAreaDescription.taskId,id);
  assert.equal(now.currentAreaDescription.by,'user');assert.equal(now.currentAreaDescription.corrects,1);assert.equal(now.currentAreaDescription.source,null);
  assert.equal(JSON.stringify(validateRequest(old)),JSON.stringify(old),'old request accepted without null injection');
  assert.deepEqual(validateRequest(now),now);assert.throws(()=>oldValidate(now),'new client reference is incompatible with old strict server');
  const body=buildBody(now,{model:'synthetic-not-called',maxTokens:1000});
  assert.deepEqual(JSON.parse(body.messages[1].content.split('\n').slice(1).join('\n')),now);
  assert.equal(body.messages[0].content,SYSTEM_PROMPT);assert.equal(SYSTEM_PROMPT.includes(inputs.correction),false);
  writeFileSync(new URL(`${label}-old-request.json`,import.meta.url),JSON.stringify(old,null,2)+'\n');
  writeFileSync(new URL(`${label}-new-request.json`,import.meta.url),JSON.stringify(now,null,2)+'\n');
  return {label,target:id,oldCorrectionPresent:false,newCorrectionPresent:true,allEarlierFieldsByteShapeEqual:true,
    previousWork:now.previousWork?.next??null,description:now.currentAreaDescription,oldRequestBytes:Buffer.byteLength(JSON.stringify(old)),newRequestBytes:Buffer.byteLength(JSON.stringify(now))};
}
const same=compare(p,A,'same-task');assert.deepEqual(p,corrected);
p=Old.submit(Old.editDraft(p,inputs.nextRequest),undefined,area);const C=p.currentTaskId,next=compare(p,C,'new-same-area');
assert.equal(next.previousWork,inputs.oldAIWork.next);assert.deepEqual(Old.taskOf(p,A).handoffs,originalH);
assert.deepEqual(Now.currentWork(p,Now.taskOf(p,A)).values,inputs.oldAIWork);
assert.equal(Now.currentWork(p,Now.taskOf(p,A)).aiStale,false);
assert.equal(Now.taskOf(p,report).resultFile.rawText,JSON.stringify(file));
const result={basis:oldProof.basis,node:process.version,synthetic:true,inputs,ids:{area,A,report,C,H},observed:[same,next],
  preserved:{oldReportRaw:true,oldH:true,oldFourValues:true,oldAIStale:false,areaIdea:true,bases:true},
  compatibility:'Old absent-key request keeps its JSON shape on the new validator. New non-null reference request is rejected by old strict server: matching client/server bundle required.',
  limit:'Transport and structural attribution only. Old 7-day work intentionally remains alongside the user-edited 30-day reference. No AI call or semantic conflict-resolution quality was evaluated.'};
writeFileSync(new URL('before-after-evidence.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
