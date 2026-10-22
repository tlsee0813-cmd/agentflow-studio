import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import {parseProject,parseResultFile} from '../dist/public/shared/validation.js';
import {WorkspaceStore,serializeProject} from '../dist/public/shared/storage.js';
import {cases,sample} from './understanding17-fixtures.mjs';
const bring=(p,f)=>D.importResultFile(p,JSON.stringify(f));
const read=p=>parseProject(serializeProject(p));
const latest=(p,a)=>D.areaDescription(p,a).current;
for(const c of cases)test(`AREA17 ${c.id}: one receipt updates one part, preserves user values, proposal stays unadopted and backup roundtrip is exact`,()=>{
  let {p,area,other,file}=sample(c);p=D.editDraft(p,'아직 보내지 않은 보고');p=D.setKind(p,'report');
  const old=structuredClone(p);p=bring(p,file);
  assert.equal(latest(p,area).summary,c.summary);assert.equal(latest(p,area).valid,true);assert.equal(latest(p,area).proposal,c.proposal);
  assert.deepEqual(p.space.areas,old.space.areas);assert.deepEqual(p.bases,old.bases);assert.deepEqual(p.tasks.slice(0,old.tasks.length),old.tasks);
  assert.deepEqual(p.space.relations,old.space.relations);assert.deepEqual(p.space.layout,old.space.layout);
  assert.equal(p.draft,old.draft);assert.equal(p.draftKind,'report');assert.deepEqual(p.space.draftTarget,old.space.draftTarget);assert.equal(D.areaDescription(p,other).current,null);
  const text=D.handoffText(p);assert.ok(text.includes(c.summary)&&text.includes(c.note)&&text.includes('실행·반영하지 말 것'));
  assert.deepEqual(read(p),p);assert.strictEqual(bring(p,file),p);
});
test('AREA17 same returnId supports successive revised interpretations without dropping report history',()=>{
  let {p,area,file}=sample();for(let i=0;i<4;i++){file={...file,understanding:{...file.understanding,summary:`정리 수정 ${i}`}};p=bring(p,file);assert.equal(latest(p,area).summary,`정리 수정 ${i}`);assert.equal(latest(p,area).valid,true);}
  assert.equal(p.space.understanding[area].revision,4);assert.equal(p.tasks.filter(t=>t.resultFile).length,4);assert.deepEqual(read(p),p);
});
test('AREA17 an explicit same-text user correction owns a new revision; old/revised returns cannot overwrite it',()=>{
  let {p,area,file}=sample();p=bring(p,file);p=D.correctUnderstanding(p,area,file.understanding.summary);
  assert.equal(latest(p,area).entry.by,'user');assert.equal(latest(p,area).entry.revision,2);assert.strictEqual(bring(p,file),p);
  p=bring(p,{...file,understanding:{...file.understanding,summary:'외부 수정'}});
  assert.equal(latest(p,area).entry.by,'user');assert.equal(D.areaDescription(p,area).held[0].entry.held,'superseded');assert.deepEqual(read(p),p);
});
for(const [name,change] of [
  ['name',(p,a,t)=>D.editArea(p,a,'바뀐 이름',p.space.areas[0].note)],
  ['note',(p,a,t)=>D.editArea(p,a,p.space.areas[0].name,'바뀐 구상')],
  ['purpose',(p)=>D.setBrief(p,'바뀐 목적')],
  ['user intent correction',(p,a,t)=>D.correctIntent(p,t,'사용자가 고친 목적','보존할 새 조건')],
  ['manual work condition',(p,a,t)=>D.editTask(p,t,'scope','바뀐 직접 조건')],
  ['recorded decision',(p)=>D.recordBasis(p,'새 사용자 기준')],
  ['same-area user request',(p,a)=>D.submit(D.editDraft(p,'사용자가 추가한 유지 조건'),undefined,a)]
])test(`AREA17 late description after ${name} is held, report remains readable and user values survive`,()=>{
  let {p,area,task,file}=sample();p=change(p,area,task);const old=structuredClone(p);p=bring(p,file);
  assert.equal(D.areaDescription(p,area).current,null);assert.equal(D.areaDescription(p,area).held[0].entry.held,'plan-changed');
  assert.equal(p.tasks.at(-1).resultFile.rawText,JSON.stringify(file));assert.deepEqual(p.space.areas,old.space.areas);assert.deepEqual(p.bases,old.bases);assert.deepEqual(read(p),p);
});
test('AREA17 unrelated work, unsent draft, layout and reading do not invalidate the target explanation',()=>{
  let {p,area,other,file}=sample();p=D.submit(D.editDraft(p,'다른 영역 요청'),undefined,other);p=D.recordBasis(p,'다른 영역 전용 기준');p=D.editTask(p,p.currentTaskId,'scope','다른 영역 작업범위');p=D.editDraft(p,'미전송 문장');p=D.moveArea(p,area,{x:800,y:300});
  p=bring(p,file);assert.equal(latest(p,area).valid,true);assert.deepEqual(read(p),p);
});
test('AREA17 current user plan is sent separately while Background stays immutable',()=>{
  let {p,area,task}=sample();const old=structuredClone(D.taskOf(p,task).background);p=D.editArea(p,area,'지금 이름','지금 구상');p=D.setBrief(p,'지금 목적');
  const text=D.handoffText(p,task,'H_current');assert.ok(text.includes('지금 구상')&&text.includes('지금 목적')&&text.includes('지금 이름'));p=D.markHandoff(p,task,text,'download',p.revision,'H_current');
  assert.deepEqual(D.taskOf(p,task).background,old);assert.deepEqual(D.taskOf(p,task).handoffs.at(-1).background,old);assert.equal(D.taskOf(p,task).handoffs.at(-1).anchor.stamp.name,'지금 이름');
});
test('AREA17 plan change makes a previous explanation stale and excludes its text from the next handoff',()=>{
  let {p,area,task,file}=sample();file.understanding.summary='OLD_DESCRIPTION_SENTINEL';p=bring(p,file);p=D.editArea(p,area,p.space.areas[0].name,'최신 구상');
  assert.equal(latest(p,area).valid,false);const text=D.handoffText(p,task);assert.ok(!text.includes('OLD_DESCRIPTION_SENTINEL'));assert.ok(text.includes('현재 설명으로 쓰지 않습니다'));assert.ok(text.includes('최신 구상'));
});
test('AREA17 wrong area/basis and archived/moved work hold only the derived description',()=>{
  for(const kind of ['area','basis','archived','moved']){let {p,area,other,task,file}=sample();if(kind==='area')file.understanding.areaId=other;if(kind==='basis')file.understanding.basedOn=99;if(kind==='archived')p=D.setAreaArchived(p,area,true);if(kind==='moved')p=D.placeTask(p,task,other);
    p=bring(p,file);const st=D.areaDescription(p,kind==='moved'?other:area);assert.equal(st.current,null);assert.equal(st.held.length,1);assert.ok(p.tasks.at(-1).resultFile);assert.deepEqual(read(p),p);}
});
test('AREA17 syntactically valid wrong-area prose is not claimed as detected; user can correct it separately',()=>{
  let {p,area,file,metadata}=sample();file.understanding.summary=metadata.conflict;p=bring(p,file);assert.equal(latest(p,area).valid,true);
  const note=p.space.areas[0].note;p=D.correctUnderstanding(p,area,'사용자가 오류를 고친 설명');assert.equal(p.space.areas[0].note,note);assert.equal(D.areaDescription(p,area).previous[0].summary,metadata.conflict);assert.deepEqual(read(p),p);
});
test('AREA17 recovery cannot move a wrong-target held description into another area as applied',()=>{
  let {p,area,other,task,file}=sample();file.understanding.areaId=other;p=bring(p,file);const entry=p.space.understanding[area].entries[0];delete p.space.understanding[area];
  p.space.understanding[other]={revision:1,entries:[{...entry,revision:1,held:null,stamp:D.planStamp(p,other)}]};assert.throws(()=>read(p));
});
test('AREA17 strict return shapes and byte limits are retained',()=>{
  let {p,file}=sample();assert.deepEqual(parseResultFile(JSON.stringify(file)),file);
  for(const bad of [{...file,bogus:true},{...file,understanding:{...file.understanding,status:'done'}},{...file,understanding:{...file.understanding,changes:['a','b','c','d']}},{...file,understanding:{...file.understanding,summary:'가'.repeat(2001)}}])assert.throws(()=>parseResultFile(JSON.stringify(bad)));
  assert.throws(()=>parseResultFile('\uFEFF'+JSON.stringify(file)));assert.throws(()=>parseResultFile(JSON.stringify({...file,report:'한'.repeat(50000)})));
});
test('AREA17 return.1 and project.1 through project.5 migrate without invented descriptions or export anchors',()=>{
  let {p,task,returnId,file}=sample();const legacy={...file,schemaVersion:'agentflow.return.1'};delete legacy.understanding;p=bring(p,legacy);
  for(const version of [1,2,3,4,5]){let old=structuredClone(p);old.schemaVersion=`idea015.project.${version}`;delete old.space.understanding;for(const t of old.tasks)for(const h of t.handoffs)delete h.anchor;
    if(version<=4)for(const t of old.tasks){delete t.background;for(const h of t.handoffs)delete h.background;}
    if(version<=3)delete old.space;
    if(version<=2){for(const t of old.tasks){delete t.resultFile;for(const h of t.handoffs)delete h.returnId;}}
    if(version===1){for(const t of old.tasks){delete t.adviceRevision;for(const h of t.handoffs){h.text='과거 인계 전문';for(const k of ['chars','digest','work','aiExcluded','legacyText'])delete h[k];}}for(const b of old.bases)b.locked=true;}
    for(const t of old.tasks)if(version<=3)delete t.areaId;
    const migrated=parseProject(JSON.stringify(old));assert.equal(migrated.schemaVersion,'idea015.project.6');assert.deepEqual(migrated.space.understanding,{});assert.ok(migrated.tasks.every(t=>t.handoffs.every(h=>h.anchor===null)));assert.deepEqual(read(migrated),migrated);
  }
});
test('AREA17 cross-tab seq rejection preserves the external project including its description',async()=>{
  const memory=new Map(),storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)},lock={request:async(_k,fn)=>fn()};
  const first=new WorkspaceStore(storage,lock);await first.init();let {p,area,file}=sample();const ref=await first.create(p,'new');const stale={...ref};p=bring(p,file);await first.save(ref,p);
  const bytes=[...memory.values()];await assert.rejects(()=>first.save(stale,D.editArea(p,area,'오래된 탭','덮기')),/STORAGE_CONFLICT/);assert.deepEqual([...memory.values()],bytes);
});
