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
  // A new request alone is not a plan change (see the next-request test below); an explicit revision of an existing basis is.
  ['explicit revision of the request basis',(p)=>D.recordBasis(p,'사용자가 직접 고친 유지 조건','confirmed',p.bases[0].id)]
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
  for(const version of [1,2,3,4,5]){let old=structuredClone(p);old.schemaVersion=`idea015.project.${version}`;delete old.pasted;delete old.readings;delete old.space.understanding;delete old.space.containment;for(const t of old.tasks)for(const h of t.handoffs)delete h.anchor;
    if(version<=4)for(const t of old.tasks){delete t.background;for(const h of t.handoffs)delete h.background;}
    if(version<=3)delete old.space;
    if(version<=2){for(const t of old.tasks){delete t.resultFile;for(const h of t.handoffs)delete h.returnId;}}
    if(version===1){for(const t of old.tasks){delete t.adviceRevision;for(const h of t.handoffs){h.text='과거 인계 전문';for(const k of ['chars','digest','work','aiExcluded','legacyText'])delete h[k];}}for(const b of old.bases)b.locked=true;}
    for(const t of old.tasks)if(version<=3)delete t.areaId;
    const migrated=parseProject(JSON.stringify(old));assert.equal(migrated.schemaVersion,'idea015.project.9');assert.deepEqual(migrated.space.understanding,{});assert.ok(migrated.tasks.every(t=>t.handoffs.every(h=>h.anchor===null)));assert.deepEqual(read(migrated),migrated);
  }
});
test('AREA17 cross-tab seq rejection preserves the external project including its description',async()=>{
  const memory=new Map(),storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)},lock={request:async(_k,fn)=>fn()};
  const first=new WorkspaceStore(storage,lock);await first.init();let {p,area,file}=sample();const ref=await first.create(p,'new');const stale={...ref};p=bring(p,file);await first.save(ref,p);
  const bytes=[...memory.values()];await assert.rejects(()=>first.save(stale,D.editArea(p,area,'오래된 탭','덮기')),/STORAGE_CONFLICT/);assert.deepEqual([...memory.values()],bytes);
});
// ---------- Claude Code continuation: stamp representation, export-anchor invariant, current-plan references ----------
import {createHash} from 'node:crypto';
import {sha256} from '../dist/public/shared/validation.js';
import {FILE_LIMIT} from '../dist/public/shared/types.js';
test('AREA17 sha256 equals Node crypto on quote/backslash/emoji/unpaired-surrogate text and on block boundaries',()=>{
  const samples=['','abc','"\\'.repeat(3000),'가"\\\n😀'.repeat(1500),'\uD800x','a'.repeat(55),'a'.repeat(56),'a'.repeat(63),'a'.repeat(64),'a'.repeat(65)];
  for(let i=0;i<200;i++)samples.push(Array.from({length:i*7},(_,k)=>String.fromCharCode((k*7919+i*131)%0xD7FF+1)).join(''));
  for(const s of samples)assert.equal(sha256(s),createHash('sha256').update(s,'utf8').digest('hex'));
});
test('AREA17 plan stamp stays fixed-size and valid for maximal quote/backslash-heavy manual and intent values, and still detects a one-character change',()=>{
  let {p,area,task}=sample();const heavy=k=>('"\\'+k).repeat(2000).slice(0,6000);
  // Several tasks of the area with every allowed user-written field at its 6000 limit, escaping-heavy.
  for(let i=0;i<3;i++){p=D.submit(D.editDraft(p,`[합성] 같은 영역 요청 ${i}`),undefined,area);const t=p.currentTaskId;
    for(const key of ['understanding','scope','next','checks'])p=D.editTask(p,t,key,heavy(key+i));p=D.correctIntent(p,t,heavy('goal'+i),heavy('cond'+i));}
  const t=p.currentTaskId,stamp=D.planStamp(p,area);assert.equal(stamp.work.length,3);for(const w of stamp.work)assert.match(w,/^[A-Za-z0-9_-]+:[0-9a-f]{64}$/);
  assert.ok(JSON.stringify(stamp).length<1000,'the stamp does not copy the values');
  // A return-file export of that task records the anchor; the project stays valid and roundtrips exactly.
  const rid='H_heavy',anchor=D.exportAnchor(p,D.taskOf(p,t)),text=D.handoffText(p,t,rid);p=D.markHandoff(p,t,text,'download',p.revision,rid,anchor);
  assert.deepEqual(read(p),p);assert.ok(serializeProject(p).length<FILE_LIMIT);
  // Ten more anchored exports grow the file by fixed-size stamps only (no copy of the 24,000+ characters per task).
  const before=serializeProject(p).length;for(let i=0;i<10;i++){const r=`H_more${i}`;p=D.markHandoff(p,t,D.handoffText(p,t,r),'download',p.revision,r,D.exportAnchor(p,D.taskOf(p,t)));}
  assert.ok((serializeProject(p).length-before)/10<text.length+2000,'per-export growth is the record, not copied work values');
  // A received description applies under that exact plan; one changed character of one field holds the next one.
  const f={schemaVersion:'agentflow.return.2',projectId:p.id,taskId:t,returnId:rid,report:'[합성] 보고',evidence:null,understanding:{version:'understanding.1',areaId:area,basedOn:anchor.understanding,summary:'[합성] 설명',changes:[],proposal:null,origin:'합성'}};
  const applied=bring(p,f);assert.equal(latest(applied,area).valid,true);
  const changed=D.editTask(p,t,'checks',heavy('checks2').slice(0,5999)+'x');assert.notDeepEqual(D.planStamp(changed,area),D.planStamp(p,area));
  assert.equal(D.areaDescription(bring(changed,f),area).held[0].entry.held,'plan-changed');
  // Strict shape: a stamp entry that is not '<id>:<sha256>' (e.g. the earlier raw serialized value) is refused.
  const bad=JSON.parse(serializeProject(p));bad.tasks.find(x=>x.id===t).handoffs.at(-1).anchor.stamp.work[0]=JSON.stringify({id:t});assert.throws(()=>parseProject(JSON.stringify(bad)));
});
test('AREA17 an explicitly passed export anchor must be the one this project state gives, with the text it gives',()=>{
  let {p,area,other,task}=sample();const rid='H_inv',anchor=D.exportAnchor(p,D.taskOf(p,task)),text=D.handoffText(p,task,rid);
  for(const wrong of [{...anchor,areaId:other},{...anchor,understanding:anchor.understanding+1},{...anchor,stamp:{...anchor.stamp,note:'다른 구상'}},null])
    assert.throws(()=>D.markHandoff(p,task,text,'clipboard',p.revision,rid,wrong),/ANCHOR_MISMATCH/);
  assert.throws(()=>D.markHandoff(p,task,text+' ',`clipboard`,p.revision,rid,anchor),/ANCHOR_MISMATCH/,'text other than the one this state gives');
  assert.throws(()=>D.markHandoff(p,task,D.handoffText(p,task),'clipboard',p.revision,null,anchor),/ANCHOR_MISMATCH/,'no anchor without a return id');
  // Captured before a change, passed after it: refused rather than recorded against the new state.
  const later=D.editArea(p,area,p.space.areas[0].name,'그 사이 바뀐 구상');assert.throws(()=>D.markHandoff(later,task,text,'clipboard',p.revision,rid,anchor),/ANCHOR_MISMATCH/);
  const n=D.markHandoff(p,task,text,'clipboard',p.revision,rid,anchor),h=D.taskOf(n,task).handoffs.at(-1);
  assert.deepEqual(h.anchor,anchor);assert.equal(h.chars,text.length);assert.equal(h.returnId,rid);
  assert.ok(text.includes(`"basedOn": ${anchor.understanding}`)&&text.includes(`"areaId": "${area}"`)&&text.includes('agentflow.return.2'),'template carries the same anchor');
});
test('AREA17 current plan in the handoff: identical text points to the request-time copy, a different value is printed in full',()=>{
  let {p,area,task}=sample();const note=p.space.areas[0].note,brief=p.space.brief.text,count=(h,s)=>h.split(s).length-1;
  const same=D.handoffText(p,task,'H_same');assert.equal(count(same,note),1,'identical idea printed once');assert.equal(count(same,brief),1,'identical purpose printed once');
  const cur=same.slice(same.indexOf('## 현재 사용자 구상'));assert.ok(cur.includes('요청 당시 영역 구상 원문과 같고, 지금도 현재 값')&&cur.includes('요청 당시 프로젝트 목적 원문과 같고'));
  // One character differs (editArea trims spaces): the current value is printed in full and the copy above is unchanged.
  const q=D.editArea(p,area,p.space.areas[0].name,note+'!');const diff=D.handoffText(q,task,'H_diff'),cur2=diff.slice(diff.indexOf('## 현재 사용자 구상'));
  assert.ok(cur2.includes(`현재 영역 구상:\n${note}!`));assert.ok(diff.slice(0,diff.indexOf('## 현재 사용자 구상')).includes(`영역 구상 원문:\n${note}`));
  assert.deepEqual(D.taskOf(q,task).background,D.taskOf(p,task).background);
  // A plain (not file) handoff without any area description keeps the earlier contract: only the request-time copy.
  assert.ok(!D.handoffText(q,task).includes('## 현재 사용자 구상'));
});
test('AREA17 a description made before a plan change cannot be re-saved as a correction (no adopt-stale shortcut)',()=>{
  let {p,area,file}=sample();p=bring(p,file);p=D.editArea(p,area,p.space.areas[0].name,'바뀐 구상');assert.equal(latest(p,area).valid,false);
  assert.throws(()=>D.correctUnderstanding(p,area,file.understanding.summary),/NOTHING_TO_CORRECT/);
});
test('AREA17 next handoff: valid description attributed below the user plan, proposal unadopted, stale text never sent',()=>{
  for(const c of cases){let {p,area,task,file}=sample(c);p=bring(p,file);const h=D.handoffText(p,task);
    const i=h.indexOf('## 현재 사용자 구상'),j=h.indexOf('## 영역 현재 설명 — 전달 기록을 정리한 참고 설명 · 앱 미검증');assert.ok(i>0&&j>i,'user plan first, then the attributed description');
    assert.ok(h.includes(c.summary)&&h.includes(c.origin));assert.ok(h.includes('미채택 제안 · 사용자가 채택하지 않음 · 실행·반영하지 말 것')&&h.includes(c.proposal));
    assert.ok(!h.slice(0,j).includes(c.proposal),'the proposal never appears as the user plan or the request');
    const stale=D.handoffText(D.editArea(p,area,p.space.areas[0].name,'바뀐 구상'),task);assert.ok(!stale.includes(c.summary)&&!stale.includes(c.proposal));}
});

// ---------- coordinator review of 98bc009: next request keeps a valid description; history contradictions are refused ----------
test('AREA17 a plain new request in the same area keeps the description valid and the next handoff carries it attributed',()=>{
  for(const c of cases){let {p,area,file}=sample(c);p=bring(p,file);const basisCount=p.bases.length;
    p=D.submit(D.editDraft(p,'[합성] 같은 영역의 다음 요청 · 구상과 조건은 그대로'),undefined,area);assert.equal(p.bases.length,basisCount+1,'the request adds its own requested basis');
    assert.equal(latest(p,area).valid,true,'a new request is not a plan change');
    const h=D.handoffText(p);assert.ok(h.includes('## 영역 현재 설명 — 전달 기록을 정리한 참고 설명 · 앱 미검증')&&h.includes(c.summary)&&h.includes(c.origin),'next work handoff carries the description');
    assert.ok(h.indexOf('## 현재 사용자 구상')<h.indexOf('## 영역 현재 설명'));assert.ok(!h.slice(0,h.indexOf('## 영역 현재 설명')).includes(c.proposal));
    // Explicit user changes still exclude it: a decision, an answer-like revision of a basis, the idea, a manual condition.
    for(const change of [q=>D.recordBasis(q,'[합성] 새 사용자 결정'),q=>D.recordBasis(q,'[합성] 고친 요청 기준','confirmed',q.bases.at(-1).id),
      q=>D.editArea(q,area,q.space.areas[0].name,'[합성] 바뀐 구상'),q=>D.editTask(q,q.currentTaskId,'scope','[합성] 바뀐 직접 조건')]){
      const q=change(p);assert.equal(latest(q,area).valid,false);const hq=D.handoffText(q);assert.ok(!hq.includes(c.summary)&&hq.includes('현재 설명으로 쓰지 않습니다'));}
  }
});
test('AREA17 a late description after a plain new request in the same area still applies; an explicit request revision holds it',()=>{
  let {p,area,file}=sample();p=D.submit(D.editDraft(p,'[합성] 다음 요청'),undefined,area);assert.equal(latest(bring(p,file),area).valid,true);
  // A request that explicitly revises the earlier request basis (exact quoted replacement) is a plan change.
  let {p:q,area:a2,file:f2}=sample();const d1=q.bases[0];assert.ok(d1.text.includes('키를 고르는'));
  q=D.submit(D.editDraft(q,`${d1.id}의 '키를 고르는'을 '키를 확정하는'으로 변경해줘`),undefined,a2);
  assert.equal(q.bases[0].history.length,1,'the existing basis was revised, no new basis');assert.equal(q.bases.length,1);
  assert.equal(D.areaDescription(bring(q,f2),a2).held[0].entry.held,'plan-changed');
});
test('AREA17 recovery refuses an applied external description that skips a user correction in its own history',()=>{
  let {p,area,file}=sample();p=bring(p,file);p=D.correctUnderstanding(p,area,'[합성] 사용자 정정');
  p=bring(p,{...file,understanding:{...file.understanding,summary:'[합성] 같은 반환의 늦은 수정본'}});
  const st=p.space.understanding[area];assert.deepEqual(st.entries.map(e=>[e.by,e.revision,e.held]),[['external',1,null],['user',2,null],['external',null,'superseded']]);
  assert.deepEqual(read(p),p,'the honest history roundtrips');
  const forged=JSON.parse(serializeProject(p)),fs=forged.space.understanding[area],held=fs.entries[2],anchor=D.taskOf(p,p.tasks.find(t=>t.id===held.taskId).parentTaskId).handoffs.find(h=>h.returnId===held.returnId).anchor;
  Object.assign(held,{revision:3,held:null,stamp:anchor.stamp});fs.revision=3;
  assert.throws(()=>parseProject(JSON.stringify(forged)),'r3 external after a user r2 contradicts its own history');
  // The legitimate chain (successive interpretations of one export, nothing in between) is still accepted.
  let {p:c,file:g}=sample();for(let i=0;i<3;i++)c=bring(c,{...g,understanding:{...g.understanding,summary:`[합성] 해석 ${i}`}});assert.deepEqual(read(c),c);
});
