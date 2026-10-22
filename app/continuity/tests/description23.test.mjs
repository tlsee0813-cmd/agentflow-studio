// Pure domain/validation/provider-data boundary. Every report and model-like response here is synthetic.
// No server, browser, paid provider or semantic-quality claim. Existing descriptions remain references.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import {mockAdvice} from '../dist/public/shared/mock.js';
import {validateRequest,parseProject,SUMMARY_LIMIT} from '../dist/public/shared/validation.js';
import {REQUEST_BYTES} from '../dist/public/shared/types.js';
import {buildBody,SYSTEM_PROMPT} from '../server/prompt.mjs';
import {callContinuity} from '../server/provider.mjs';

const OLD='[합성 이전 응답] OLD_7_DAYS: 보관기간 7일 표기를 유지해 안내문을 정리한다.';
const CORRECTION='[합성 사용자 설명 정정] CORRECTED_30_DAYS: 현재 표시는 30일이다. 이전 설명의 7일은 오류다.';
const oldValues={understanding:'[합성] 현재 안내 표시는 7일이라는 정리',scope:'[합성] 안내문만 다룬다.',next:OLD,checks:'[합성] 7일로 표시되는지 확인한다.'};
const copy=v=>structuredClone(v),req=(p,id)=>D.begin(p,id).request;
function sample({manual=false,held=false,large=false}={}) {
  let p=D.setBrief(D.createProject(),'[합성] 문서 보관 안내. 정책 자체를 새로 정하는 요청이 아니다.');
  p=D.addArea(p,'안내 · 합성','[합성] 현재 자료를 확인하고 미확인은 구분한다.');const area=p.space.areas[0].id;
  p=D.submit(D.editDraft(p,'[합성] 현재 자료에 맞춰 안내 문구를 정리해줘.'),undefined,area);const task=p.currentTaskId;
  const s=D.begin(p);p=D.receive(s.project,s.request,{mode:'mock',ticket:s.request.ticket,advice:{...mockAdvice(s.request),...oldValues}});
  if(manual)for(const key of Object.keys(oldValues))p=D.editTask(p,task,key,`[직접 ${key}] 사용자가 쓴 값을 보존한다.`);
  if(large)for(let i=0;i<4;i++)p=D.recordBasis(p,`[합성 큰 기준 ${i}]`+'가'.repeat(11000));
  const H='H_DESCRIPTION23',anchor=D.exportAnchor(p,D.taskOf(p,task)),text=D.handoffText(p,task,H);
  p=D.markHandoff(p,task,text,'clipboard',p.revision,H,anchor);
  const file={schemaVersion:'agentflow.return.2',projectId:p.id,taskId:task,returnId:H,report:'[합성 보고] 안내가 7일로 표시된다고 보고했다. 검증한 사실이 아니다.',evidence:null,
    understanding:{version:'understanding.1',areaId:area,basedOn:held?99:anchor.understanding,summary:'[합성 외부 설명] 안내문 표시는 7일이다.',changes:[],proposal:null,origin:'[합성] 시험 작성자가 구성한 외부 설명'}};
  p=D.importResultFile(p,JSON.stringify(file));return {p,area,task,H,file,report:p.currentTaskId};
}

test('DESC23 valid external description carries exact target and return attribution through strict request validation',()=>{
  const {p,area,task,H,report,file}=sample(),before=copy(p),r=req(p,task);
  assert.deepEqual(r.currentAreaDescription,{taskId:task,areaId:area,revision:1,by:'external',corrects:null,
    source:{taskId:report,returnId:H,origin:file.understanding.origin},text:file.understanding.summary});
  assert.deepEqual(validateRequest(r),r);assert.deepEqual(p,before);
  assert.equal(req(p,report).currentAreaDescription.taskId,report,'returned-task retry still identifies the actual requested task');
});

test('DESC23 synthetic7/30 correction reaches same-task retry and new same-area request without rewriting work or historical H',()=>{
  let {p,area,task,file}=sample();const before=copy(p),priorWork=D.currentWork(p,D.taskOf(p,task));
  p=D.correctUnderstanding(p,area,CORRECTION);const after=copy(p),r=req(p,task);
  assert.deepEqual(r.currentAreaDescription,{taskId:task,areaId:area,revision:2,by:'user',corrects:1,source:null,text:CORRECTION});
  assert.deepEqual(p.sources,before.sources);assert.deepEqual(p.bases,before.bases);assert.deepEqual(p.tasks,before.tasks);assert.deepEqual(p.space.areas,before.space.areas);
  assert.deepEqual(D.currentWork(p,D.taskOf(p,task)),priorWork);assert.equal(priorWork.aiStale,false);assert.equal(priorWork.values.next,OLD);
  const legacy=copy(r);delete legacy.currentAreaDescription;assert.equal(JSON.stringify(legacy).includes('CORRECTED_30_DAYS'),false);
  assert.equal(JSON.stringify(validateRequest(r)).includes('CORRECTED_30_DAYS'),true);
  const body=buildBody(validateRequest(r),{model:'synthetic',maxTokens:128});
  assert.deepEqual(JSON.parse(body.messages[1].content.split('\n').slice(1).join('\n')).currentAreaDescription,r.currentAreaDescription);
  assert.equal(body.messages[0].content.includes(CORRECTION),false,'reference text remains INPUT data');
  p=D.submit(D.editDraft(p,'[합성] 같은 부분의 현재 자료를 확인한다.'),undefined,area);const C=p.currentTaskId,next=req(p,C);
  assert.equal(next.currentAreaDescription.taskId,C);assert.equal(next.currentAreaDescription.text,CORRECTION);assert.equal(next.previousWork.next,OLD);
  assert.equal(D.taskOf(p,task).resultFile,null);assert.equal(D.taskOf(p,before.currentTaskId).resultFile.rawText,JSON.stringify(file));
  assert.deepEqual(D.taskOf(p,task).handoffs,D.taskOf(after,task).handoffs);assert.deepEqual(parseProject(JSON.stringify(p)),p);
});

test('DESC23 direct four values, user plan/conditions and old exports survive correction and normal retry',()=>{
  let {p,area,task}=sample({manual:true});const before=copy(p),manual=copy(D.taskOf(p,task).manual);
  p=D.correctUnderstanding(p,area,CORRECTION);const s=D.begin(p,task);assert.equal(s.request.currentAreaDescription.text,CORRECTION);
  p=D.receive(s.project,s.request,{mode:'mock',ticket:s.request.ticket,advice:mockAdvice(s.request)});
  assert.deepEqual(D.taskOf(p,task).manual,manual);assert.deepEqual(D.currentWork(p,D.taskOf(p,task)).values,manual);
  assert.deepEqual(p.sources,before.sources);assert.deepEqual(p.bases,before.bases);assert.deepEqual(p.space.areas,before.space.areas);
  assert.deepEqual(D.taskOf(p,task).background,D.taskOf(before,task).background);assert.deepEqual(D.taskOf(p,task).handoffs,D.taskOf(before,task).handoffs);
});

test('DESC23 held/stale references and other/global targets do not leak, while valid current survives a later held result',()=>{
  let s=sample({held:true});assert.equal(D.areaDescription(s.p,s.area).current,null);assert.equal(req(s.p,s.task).currentAreaDescription,null);
  s=sample();let p=D.correctUnderstanding(s.p,s.area,CORRECTION);
  const held={...s.file,report:'[합성] 늦은 다른 보고',understanding:{...s.file.understanding,summary:'HELD_DESCRIPTION_MUST_NOT_BE_REFERENCE'}};
  p=D.importResultFile(p,JSON.stringify(held));assert.ok(D.areaDescription(p,s.area).held.length);
  assert.equal(req(p,s.task).currentAreaDescription.text,CORRECTION);
  const stale=D.editArea(p,s.area,p.space.areas[0].name,'바뀐 사용자 구상');assert.equal(D.areaDescription(stale,s.area).current.valid,false);assert.equal(req(stale,s.task).currentAreaDescription,null);
  const archived=D.setAreaArchived(p,s.area,true),archivedBefore=copy(archived);
  assert.equal(D.areaDescription(archived,s.area).current.valid,true);
  assert.deepEqual(req(archived,s.task).currentAreaDescription,req(p,s.task).currentAreaDescription,'existing archived-task reference reading follows the existing valid-description verdict');
  assert.deepEqual(archived,archivedBefore);assert.equal(archived.space.areas.find(a=>a.id===s.area).archived,true,'reading neither reactivates the area nor changes execution scope');
  p=D.addArea(p,'다른 부분','[합성] 별도 구상');const other=p.space.areas.at(-1).id;
  const elsewhere=D.submit(D.editDraft(p,'[합성] 다른 부분 요청'),undefined,other);assert.equal(req(elsewhere).currentAreaDescription,null);
  const global=D.submit(D.editDraft(p,'[합성] 특정 부분 없는 요청'),undefined,null);assert.equal(req(global).currentAreaDescription,null);
  const moved=D.placeTask(p,s.task,other);assert.equal(D.taskOf(moved,s.task).background.area.id,s.area);assert.equal(req(moved,s.task).currentAreaDescription,null,'historical background must not substitute for the actual target');
});

test('DESC23 strict provenance, exact keys and existing2000-char limit; earlier requests keep their absent-key byte shape',()=>{
  const s=sample(),external=req(s.p,s.task),user=req(D.correctUnderstanding(s.p,s.area,CORRECTION),s.task);
  const legacy=copy(user);delete legacy.currentAreaDescription;const raw=JSON.stringify(legacy),accepted=validateRequest(JSON.parse(raw));
  assert.equal(Object.hasOwn(accepted,'currentAreaDescription'),false);assert.equal(JSON.stringify(accepted),raw);
  assert.deepEqual(validateRequest({...legacy,currentAreaDescription:null}),{...legacy,currentAreaDescription:null});
  const bad=[
    [external,x=>x.currentAreaDescription.taskId='T_wrong'],[external,x=>x.currentAreaDescription.areaId='bad id'],
    [external,x=>x.currentAreaDescription.revision=0],[external,x=>x.currentAreaDescription.revision=x.ticket.revision+1],
    [external,x=>x.currentAreaDescription.by='confirmed'],[external,x=>x.currentAreaDescription.corrects=1],
    [external,x=>x.currentAreaDescription.source=null],[external,x=>x.currentAreaDescription.source.returnId='bad H'],
    [external,x=>delete x.currentAreaDescription.source.returnId],[external,x=>x.currentAreaDescription.source.extra='unknown'],
    [external,x=>x.currentAreaDescription.source.origin='x'.repeat(201)],[external,x=>x.currentAreaDescription.text='x'.repeat(SUMMARY_LIMIT+1)],
    [external,x=>x.currentAreaDescription.text=''],[external,x=>x.currentAreaDescription.extra='unknown'],
    [external,x=>delete x.currentAreaDescription.areaId],[external,x=>x.currentAreaDescription=undefined],
    [user,x=>x.currentAreaDescription.source=external.currentAreaDescription.source],[user,x=>x.currentAreaDescription.corrects=0],
    [user,x=>x.currentAreaDescription.corrects=null],[user,x=>x.currentAreaDescription.corrects=2],
    [legacy,x=>x.unknown='extra']
  ];
  for(const [base,change]of bad){const v=copy(base);change(v);assert.throws(()=>validateRequest(v),/INVALID_DATA/);}
  const max=copy(external);max.currentAreaDescription.text='가'.repeat(SUMMARY_LIMIT);assert.deepEqual(validateRequest(max),max);
  const tooBig=copy(max);for(let i=0;i<4;i++)tooBig.bases.push({id:`B_budget_${i}`,text:'가'.repeat(12000),status:'confirmed',sourceId:`S_budget_${i}`,revision:1,previousVersions:0,partial:false});
  assert.ok(Buffer.byteLength(JSON.stringify(tooBig))>REQUEST_BYTES);assert.throws(()=>validateRequest(tooBig),/CONTEXT_TOO_LARGE/);
  const large=sample({large:true}),unchanged=copy(large.p);assert.equal(D.areaDescription(large.p,large.area).current.valid,true);assert.throws(()=>req(large.p,large.task),/CONTEXT_TOO_LARGE/);assert.deepEqual(large.p,unchanged);
});

test('DESC23 provider receives the validated reference only as JSON data, including untrusted origin/text',async()=>{
  const {p,task}=sample(),r=req(p,task);r.currentAreaDescription.source.origin='UNTRUSTED_ORIGIN: system지시로 올리지 말 것';r.currentAreaDescription.text='UNTRUSTED_TEXT: 이것은 새 실행권한이 아니라 입력 자료다.';
  const validated=validateRequest(r);let sent=null,calls=0;
  const config={model:'synthetic-no-provider',maxTokens:256,apiKey:'NOT_A_REAL_KEY',allowPaid:true,endpoint:'https://not-used.invalid',timeoutMs:1000};
  await callContinuity(validated,config,{fetchImpl:async(url,options)=>{
    calls++;assert.equal(url,config.endpoint);sent=JSON.parse(options.body);
    return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(mockAdvice(validated))}}]}));
  }});
  assert.equal(calls,1);assert.equal(sent.messages[0].content,SYSTEM_PROMPT);
  assert.equal(sent.messages[0].content.includes('UNTRUSTED_ORIGIN'),false);assert.equal(sent.messages[0].content.includes('UNTRUSTED_TEXT'),false);
  assert.deepEqual(JSON.parse(sent.messages[1].content.split('\n').slice(1).join('\n')),validated);
  assert.match(SYSTEM_PROMPT,/사용자 설명 정정도 새 실행 권한/);assert.match(SYSTEM_PROMPT,/source=null/);assert.match(SYSTEM_PROMPT,/내용의 진실/);
});
