// Pure input preparation through public project APIs. Never writes product/storage/browser state.
import {mkdir,writeFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {loadAPI,returnFromH,sha} from './api.mjs';
const api=await loadAPI(),d=api.domain,v=api.validation,a=api.attention;
const output=new URL('./generated-v0/',import.meta.url);
try{await stat(output);throw Error('OUTPUT_EXISTS_REFUSE_OVERWRITE');}catch(e){if(e.code!=='ENOENT')throw e;}
let p=d.setBrief(d.rename(d.createProject(),'[합성32] 파일 검토 도구'),
  '[합성32] 파일 내용을 바꾸지 않고 앞부분을 미리 읽고 오류행 처리 방식을 정한 뒤 검토 결과를 파일로 내보내는 도구. 실제 구현·실행·배포 자료가 아니다.');
const ids={},tasks={},exports=[],receipts=[];
function add(key,name,note,parent=null){p=parent?d.addChildArea(p,ids[parent],name,note):d.addArea(p,name,note);ids[key]=p.space.areas.at(-1).id;}
add('read','읽기·검토','파일의 표시와 오류행 판단을 맡는 구성 부분이다.');
add('output','출력 준비','검토 결과의 파일 교환과 안내를 맡는 구성 부분이다.');
add('A','미리보기','원본을 바꾸지 않고 데이터 행을 미리 읽는다.','read');
add('B','오류행 처리','오류행이 있을 때 사용자가 처리 방식을 정한다.','read');
add('C','내보내기','선택된 범위의 검토 결과를 파일로 만든다.','output');
for(const [key,x,y] of [['read',0,0],['output',900,0],['A',0,260],['B',300,260],['C',900,260]])p=d.moveArea(p,ids[key],{x,y});
p=d.addRelation(p,ids.A,ids.B,'flow','미리 읽은 자료에서 오류행 판단으로 이어진다.');
p=d.addRelation(p,ids.B,ids.C,'needs','오류행의 처리 선택이 내보낼 범위와 관계된다. 자동 적용이나 부모 권위는 아니다.');
const qa={kind:'choice',text:'미리보기 행 수에 헤더 행도 포함할까요?',why:'데이터 행 수와 헤더 표시를 구분해야 합니다.',options:[{label:'헤더는 따로 표시',consequence:'데이터 행만 행 수에 포함합니다.'},{label:'헤더도 행 수에 포함',consequence:'헤더를 포함해 행 수를 셉니다.'}]};
const qb={kind:'choice',text:'오류행을 만나면 검토를 중단할까요, 그 행을 제외하고 계속할까요?',why:'내보낼 범위가 달라지므로 사용자의 선택이 필요합니다.',options:[{label:'오류행에서 중단',consequence:'해당 행 뒤의 검토는 멈춥니다.'},{label:'오류행 제외 후 계속',consequence:'제외한 행을 기록하고 나머지를 검토합니다.'}]};
function request(key,owner,text,work,question=null){
  p=d.submit(d.editDraft(d.setKind(p,'request'),text),undefined,ids[owner]);const id=p.currentTaskId;
  const started=d.begin(p,id),advice={...api.mock.mockAdvice(started.request),...work,question};
  p=d.receive(started.project,started.request,{mode:'mock',ticket:started.request.ticket,advice});assert.ok(d.taskOf(p,id).advice,'synthetic response must pass validation');
  for(const [field,value] of Object.entries(work))p=d.editTask(p,id,field,value);tasks[key]=id;
}
request('A','A','[합성32] 파일 미리보기는 데이터10행을 표시하고 헤더 처리 방식을 먼저 물어봐 주세요.',{
  understanding:'파일의 데이터10행을 미리 읽는 부분이다.',scope:'미리보기 표시만 다룬다. 파일 내용을 바꾸지 않는다.',
  next:'데이터10행 표시와 헤더 처리 기준을 확인한다.',checks:'원본 바이트와 오류행 선택은 임의로 바꾸지 않는다.'},qa);
p=d.answer(p,tasks.A,'[합성32 답변] 헤더는 따로 표시하고 데이터 행만 행 수에 포함해 주세요.');
request('B','B','[합성32·처음 남긴 요청] 오류행에서 중단할지 제외하고 계속할지 아직 정하지 않았어요. 먼저 물어봐 주세요.',{
  understanding:'오류행의 처리 방식은 아직 사용자가 선택하지 않았다.',scope:'중단 또는 제외 중 어느 것도 임의로 적용하지 않는다.',
  next:'오류행 처리 방식을 사용자에게 확인한다.',checks:'답변하지 않은 선택을 완료·확정으로 표시하지 않는다.'},qb);
request('C','C','[합성32] 검토 결과의 CSV와 XLSX 내보내기 범위를 확인해 주세요.',{
  understanding:'검토 결과를 파일로 내보내는 부분이다.',scope:'CSV와 XLSX 지원 범위를 확인한다.',
  next:'내보내기 지원 범위를 확인하고 현재 상태를 설명한다.',checks:'원본 파일을 수정하거나 자동 전송하지 않는다.'});
request('D','output','[합성32] 출력 안내 문구의 표현을 검토해 주세요. 지금 이어갈 별도 작업입니다.',{
  understanding:'출력 안내 문구를 검토하는 별도 작업이다.',scope:'안내 문구만 검토한다. 미리보기와 오류행 정책은 바꾸지 않는다.',
  next:'저장 위치 안내 문구를 확인한다.',checks:'실행·전송됐다고 오해하게 표현하지 않는다.'});
function exported(label,task){
  const H='H_SYN32_'+label,text=d.handoffText(p,task,H),anchor=d.exportAnchor(p,d.taskOf(p,task));
  p=d.markHandoff(p,task,text,'clipboard',p.revision,H,anchor);
  const record=d.taskOf(p,task).handoffs.at(-1);assert.equal(record.digest,v.digest(text));
  const x={label,task,H,text,record:structuredClone(record)};exports.push(x);return x;
}
function received(x,summary,changes){
  const file=returnFromH(x.text,{report:`[합성32 보고 ${x.label}] ${summary} 이 문장은 준비자가 만든 상태 주장이고 실제 구현·검사·AI 실행 증거가 아니다.`,summary,changes});
  const raw=JSON.stringify(file,null,2);v.parseResultFile(raw);const inspected=d.inspectResultFile(p,raw);assert.equal(inspected.task.id,x.task);assert.equal(inspected.record.returnId,x.H);assert.equal(inspected.duplicate,undefined);
  const before=new Set(p.tasks.map(t=>t.id));p=d.importResultFile(p,raw);const added=p.tasks.filter(t=>!before.has(t.id));assert.equal(added.length,1);
  const item={label:x.label,task:added[0].id,raw,file};receipts.push(item);return item;
}
received(exported('B1',tasks.B),'오류행 처리 방식은 아직 선택되지 않았다. 중단/제외 중 어느 것도 적용하지 않은 상태다.',[]);
received(exported('C1',tasks.C),'검토 결과의 파일 내보내기 범위를 확인하는 부분이다. CSV/XLSX 지원은 이 설명만으로 검증되지 않았다.',[]);
const lateC=exported('C_LATE',tasks.C);
// A genuine user-written scope change makes C's existing description stale before T0.
p=d.editTask(p,tasks.C,'scope','[합성32 명시 조건 변경] 이번에는 CSV만 다룬다. XLSX 지원은 이번 작업에서 제외한다.');
received(exported('A1',tasks.A),'미리보기는 데이터10행을 표시하고 헤더는 따로 표시한다. 원본 파일은 바꾸지 않는다.',[]);
const draft='[합성32 미전송] 읽기 화면의 안내 문구를 더 검토하고 싶다. 이 입력은 아직 보내지 않는다.';
p=d.setDraftTarget(d.editDraft(d.focusTask(p,tasks.D),draft),ids.read);
const t0=v.parseProject(JSON.stringify(p));
// Explicit U/N edit, with S/C preserved, then a fresh exact export for each real description revision.
p=d.editTask(p,tasks.A,'understanding','파일의 데이터20행을 미리 읽는 부분이다.');
p=d.editTask(p,tasks.A,'next','데이터20행 표시 상태를 확인하고 헤더는 따로 표시하는 기준을 유지한다.');
received(exported('A2',tasks.A),'미리보기는 데이터20행을 표시하고 헤더는 따로 표시한다. 원본 파일은 바꾸지 않는다.',['미리보기 데이터 행 표시가10행에서20행으로 바뀌었다.']);
received(exported('A3',tasks.A),'미리보기는 데이터20행을 표시하고 헤더는 따로 표시한다. 원본 파일은 바꾸지 않는다.',[]);
received(lateC,'CSV와 XLSX 내보내기를 함께 다룬다는 늦은 설명이다. 현재 CSV 한정 조건을 반영하기 전 자료다.',[]);
const t2=v.parseProject(JSON.stringify(p));
const describe=(project,id)=>{const z=d.areaDescription(project,id);return {current:z.current?{revision:z.current.entry.revision,valid:z.current.valid,summary:z.current.summary,changes:z.current.changes,taskId:z.current.entry.taskId,returnId:z.current.entry.returnId}:null,previous:z.previous.map(x=>({revision:x.entry.revision,summary:x.summary,changes:x.changes})),held:z.held.map(x=>({held:x.entry.held,revision:x.entry.revision,summary:x.summary,returnId:x.entry.returnId}))};};
const facts={synthetic:true,notObserverInput:true,notPreferredAction:'B is not the only correct choice. This table describes records, not which task the observer should select.',ids,tasks,
  purpose:t2.space.brief.text,relations:t2.space.relations,containment:t2.space.containment,positions:t2.space.layout.positions,
  description:{T0:Object.fromEntries(['A','B','C'].map(k=>[k,describe(t0,ids[k])])),T2:Object.fromEntries(['A','B','C'].map(k=>[k,describe(t2,ids[k])]))},
  questions:['A','B'].map(k=>({key:k,taskId:tasks[k],answered:d.questionAnswered(t2,d.taskOf(t2,tasks[k])),applicability:d.questionApplicability(t2,d.taskOf(t2,tasks[k])),question:d.taskOf(t2,tasks[k]).advice.question})),
  work:Object.fromEntries(['A','B','C','D'].map(k=>[k,{T0:d.taskOf(t0,tasks[k]).manual,T2:d.taskOf(t2,tasks[k]).manual}])),
  current:{taskId:tasks.D,owner:ids.output,draftTarget:ids.read,draft},
  exports:exports.map(({text,...x})=>({...x,textSHA256:sha(text),utf16Chars:text.length})),
  receipt:receipts.map(({raw,file,...x})=>({...x,H:file.returnId,basedOn:file.understanding.basedOn,rawSHA256:sha(raw)})),
  limitations:['B is older by event order, not backdated by days. Public APIs provide no timestamp edit.','T0/T2 are separate recovery snapshots with one Project.id. Normal imports create different workspace entryId values, not live sync.','No last-read baseline, unread status, external implementation or validation is invented.']};
assert.equal(facts.description.T0.A.current.revision,1);assert.equal(facts.description.T2.A.current.revision,3);assert.equal(facts.description.T2.A.current.valid,true);assert.deepEqual(facts.description.T2.A.current.changes,[]);
assert.equal(facts.description.T2.A.previous.find(x=>x.revision===2).summary,facts.description.T2.A.current.summary);
assert.deepEqual(facts.questions.map(x=>[x.answered,x.applicability]),[[true,'answered'],[false,'active']]);
assert.deepEqual(describe(t0,ids.B),describe(t2,ids.B));assert.deepEqual(facts.description.T0.C.current,facts.description.T2.C.current);assert.equal(facts.description.T2.C.held[0].held,'plan-changed');
for(const z of [t0,t2]){assert.equal(z.currentTaskId,tasks.D);assert.equal(z.draft,draft);assert.equal(z.space.draftTarget.area,ids.read);assert.notEqual(d.areaOf(z,d.taskOf(z)),z.space.draftTarget.area);v.parseProject(JSON.stringify(z));}
assert.equal(a.subtreeSignals(t2,ids.A)[0].questions.length,1);assert.equal(a.subtreeSignals(t2,ids.B)[0].questions.length,1);
assert.deepEqual(t0.space.relations,t2.space.relations);assert.deepEqual(t0.space.layout,t2.space.layout);assert.deepEqual(t0.space.containment,t2.space.containment);
for(const task of t0.tasks)assert.deepEqual(d.taskOf(t0,task.id).handoffs,d.taskOf(t2,task.id).handoffs.filter(x=>!['H_SYN32_A2','H_SYN32_A3'].includes(x.returnId)));
await mkdir(new URL('observer-input/',output),{recursive:true});await mkdir(new URL('sealed-answer/',output));await mkdir(new URL('preparer-artifacts/',output));
const write=(name,value)=>writeFile(new URL(name,output),typeof value==='string'?value:JSON.stringify(value,null,2),'utf8');
await write('observer-input/T0.json',JSON.stringify(t0));await write('observer-input/T2.json',JSON.stringify(t2));
await write('observer-input/READ_ME_FIRST.txt','합성32 파일 검토 도구 자료입니다. 실제 구현·실행 증거가 아닙니다. T0/T2는 정상 백업 파일 불러오기로만 열어 주세요. 프로젝트 목표와 실제 화면을 먼저 읽고 본 내용·판단 근거를 기록하세요. 준비자의 sealed-answer나 내부 식별자 표를 먼저 읽지 마세요. 어느 한 부분 선택을 정답으로 정하지 않습니다.');
await write('sealed-answer/FACTS.json',facts);await write('preparer-artifacts/MODULE_BINDING.json',{runtime:process.version,binding:api.binding,source:'compiled public modules; no source copies'});
for(const x of exports)await write(`preparer-artifacts/${x.label}-original-H.md`,x.text);
for(const x of receipts)await write(`preparer-artifacts/${x.label}-return.2.json`,x.raw);
console.log(JSON.stringify({status:'pure public API generation and assertions passed',output:fileURLToPath(output),areas:t2.space.areas.length,parents:2,children:3,ARevisions:[1,2,3],recordedQuestions:2,currentAndDraftDifferentOwners:true}));
