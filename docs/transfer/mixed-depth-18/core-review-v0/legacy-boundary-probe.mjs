// Narrow independent compatibility probes, not full regressions. No storage/server writes.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as D from '../product18-author/app/continuity/dist/public/shared/domain.js';
import {parseProject,parseResultFile} from '../product18-author/app/continuity/dist/public/shared/validation.js';
import {hierarchySample} from '../product18-author/app/continuity/tests/hierarchy18-fixtures.mjs';
const round=p=>parseProject(JSON.stringify(p));
const base=new URL('../product18-author/app/continuity/tests/fixtures/hierarchy18/',import.meta.url);
const raw=fs.readFileSync(new URL('project6-accepted.json',base),'utf8'),old=JSON.parse(raw);
const origin=JSON.parse(fs.readFileSync(new URL('project6-origin.json',base),'utf8'));
assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),origin.fixtureSha256);
let p=parseProject(raw);
assert.deepEqual(p.tasks,old.tasks);assert.deepEqual(p.space.understanding,old.space.understanding);
for(const [id,expected] of Object.entries(origin.expected)) {
  const d=D.areaDescription(p,id);
  assert.deepEqual({valid:d.current?.valid??null,summary:d.current?.summary??null,by:d.current?.entry.by??null,held:d.held.map(x=>x.entry.held)},expected);
}
const id=origin.areaIds['유효한 기존 설명'],parent=origin.areaIds['사용자 정정된 기존 설명'];
p=round(D.setAreaParent(D.setAreaParent(p,id,parent),id,null));
assert.equal(D.areaDescription(p,id).current.valid,false);
console.log('fixed_old6_history_and_attach_detach_reload: PASS');

let {p:q,area,file}=hierarchySample();
q=D.importResultFile(q,JSON.stringify(file));q=D.correctUnderstanding(q,area,'Independent user correction');
q=D.importResultFile(q,JSON.stringify({...file,understanding:{...file.understanding,summary:'Late old interpretation'}}));
q=round(q);assert.equal(D.areaDescription(q,area).current.entry.by,'user');
const st=q.space.understanding[area],held=st.entries.at(-1),rt=q.tasks.find(t=>t.id===held.taskId);
const anchor=q.tasks.find(t=>t.id===rt.parentTaskId).handoffs.find(h=>h.returnId===held.returnId).anchor;
Object.assign(held,{revision:3,held:null,stamp:anchor.stamp});st.revision=3;assert.throws(()=>round(q));
console.log('anchor2_recovery_cannot_skip_user_correction: PASS');

for(const mutate of [q=>q.space.containment={},q=>q.tasks.find(t=>t.handoffs.length).handoffs[0].anchor.stamp.version='plan.2',q=>q.space.areas[0].revision=0]) {
  q=structuredClone(old);mutate(q);assert.throws(()=>round(q));
}
const one={...file,schemaVersion:'agentflow.return.1'};assert.throws(()=>parseResultFile(JSON.stringify(one)));
delete one.understanding;assert.equal(parseResultFile(JSON.stringify(one)).schemaVersion,'agentflow.return.1');
const missing={...file};delete missing.understanding;assert.throws(()=>parseResultFile(JSON.stringify(missing)));
assert.equal(parseResultFile(JSON.stringify({...file,understanding:null})).understanding,null);
console.log('old6_future_keys_and_return_exact_keys: PASS');

q=structuredClone(old);q.schemaVersion='idea015.project.5';delete q.space.understanding;
for(const t of q.tasks)for(const h of t.handoffs)delete h.anchor;
q=round(q);const t=q.tasks.find(t=>t.handoffs.length),h=t.handoffs[0];
const f={...file,projectId:q.id,taskId:t.id,returnId:h.returnId,report:'Independent old export return',understanding:{...file.understanding,areaId:t.areaId,basedOn:0}};
const formatted=JSON.stringify(f,null,3);q=D.importResultFile(q,formatted);
assert.equal(q.tasks.at(-1).resultFile.rawText,formatted);
assert.equal(D.areaDescription(q,t.areaId).held[0].entry.held,'no-anchor');assert.deepEqual(round(q),q);
console.log('old5_late_return_exact_raw_and_no_anchor: PASS');
console.log(`Node ${process.version}; supplementary domain observations only`);
