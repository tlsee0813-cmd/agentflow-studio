// FLOW083 workspace storage: one envelope key written inside a shared lock. Project payloads and backup files keep
// their format; the wrapper adds entryId, active/trashed, lifecycle (trash/restore) and seq (saves).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import {WorkspaceStore,STORAGE_KEY,WORKSPACE_KEY,LEGACY_BACKUP_KEY,serializeProject} from '../dist/public/shared/storage.js';
import {inspectResultFile} from '../dist/public/shared/domain.js';
class Memory { constructor(seed={}){this.map=new Map(Object.entries(seed));this.fail=()=>false;} getItem(k){return this.map.get(k)??null;} setItem(k,v){if(this.fail(k,v))throw Object.assign(new Error('full'),{name:'QuotaExceededError'});this.map.set(k,String(v));} }
// Same contract as navigator.locks.request for one name: callbacks run one at a time, in order.
class Locks { tail=Promise.resolve(); names=[]; request(name,cb){this.names.push(name);const run=this.tail.then(()=>cb());this.tail=run.catch(()=>{});return run;} }
let n=0;const ids=()=>`E_test-${String(++n).padStart(8,'0')}`;
const project=text=>D.submit(D.editDraft(D.createProject(),text));
const env=storage=>JSON.parse(storage.getItem(WORKSPACE_KEY));

test('F083-S1 the old key is migrated once, never written; a valid workspace never re-imports it', async () => {
  const raw=serializeProject(project('기존 프로젝트')),storage=new Memory({[STORAGE_KEY]:raw}),locks=new Locks();
  const a=new WorkspaceStore(storage,locks,ids);await a.init();
  assert.deepEqual(a.entries().map(e=>[e.origin,e.state,e.project.sources[0].text]),[['legacy','active','기존 프로젝트']]);
  await a.trash(a.entries()[0].entryId);
  const b=new WorkspaceStore(storage,locks,ids);await b.init();
  assert.equal(env(storage).entries.length,1,'everything trashed and nothing selected still means: do not migrate again');
  assert.equal(storage.getItem(STORAGE_KEY),raw);assert.equal(b.legacy,null);
  assert.ok(locks.names.every(name=>name==='agentflow.idea015.workspace'));
});

test('F083-S2 an unreadable old value, or a migration that does not fit, stays as is: readable where possible, nothing written', async () => {
  const v1=JSON.stringify({schemaVersion:'idea015.project.1',name:'x'}); // unreadable here: stays as is
  const broken=new Memory({[STORAGE_KEY]:v1}),w=new WorkspaceStore(broken,new Locks(),ids);await w.init();
  assert.equal(broken.getItem(WORKSPACE_KEY),null);assert.equal(w.legacy.error,'STORAGE_BLOCKED');
  const raw=serializeProject(project('큰 기존 프로젝트')),full=new Memory({[STORAGE_KEY]:raw});full.fail=k=>k===WORKSPACE_KEY;
  const q=new WorkspaceStore(full,new Locks(),ids);await q.init();
  assert.equal(q.legacy.error,'QUOTA','wrapper overhead may not fit: no truncation, no empty workspace');
  assert.equal(full.getItem(WORKSPACE_KEY),null);assert.equal(full.getItem(STORAGE_KEY),raw);assert.equal(q.legacy.project.name,'나의 프로젝트');
  assert.equal(full.getItem(LEGACY_BACKUP_KEY),null,'a current-format value needs no extra copy');
});

test('F083-S3 a damaged workspace is never overwritten with an empty one', async () => {
  const storage=new Memory({[WORKSPACE_KEY]:'{"version":"agentflow.workspace.1","entries":[{"entryId":"bad"}]}'}),w=new WorkspaceStore(storage,new Locks(),ids);
  await w.init();assert.equal(w.readError,'STORAGE_BLOCKED');assert.equal(w.writable,false);
  await assert.rejects(w.create(project('새것'),'new'),/STORAGE_BLOCKED/);
  assert.match(storage.getItem(WORKSPACE_KEY),/"bad"/);
});

test('F083-S4 without Web Locks nothing is written (no unprotected fallback); reading still works', async () => {
  const raw=serializeProject(project('잠금 없음')),storage=new Memory({[STORAGE_KEY]:raw}),w=new WorkspaceStore(storage,null,ids);
  await w.init();assert.equal(w.writable,false);assert.equal(w.legacy.project.sources[0].text,'잠금 없음');
  await assert.rejects(w.create(project('x'),'new'),/LOCKS_UNAVAILABLE/);assert.equal(storage.getItem(WORKSPACE_KEY),null);
});

test('F083-S5 an imported copy gets only a new entryId; an exact result file matches inside that entry', async () => {
  const storage=new Memory(),locks=new Locks(),w=new WorkspaceStore(storage,locks,ids);await w.init();
  let p=project('반환 파일 대상');const t=p.currentTaskId,returnId='H_00000000-0000-4000-8000-000000000001';
  p=D.markHandoff(p,t,D.handoffText(p,t,returnId),'download',p.revision,returnId);
  const original=await w.create(p,'new'),copy=await w.create(JSON.parse(serializeProject(p)),'import');
  const [a,b]=w.entries();assert.notEqual(a.entryId,b.entryId);assert.equal(serializeProject(a.project),serializeProject(b.project),'Project.id, tasks, sources, returnIds unchanged');
  const file=JSON.stringify({schemaVersion:'agentflow.return.1',projectId:p.id,taskId:t,returnId,report:'완료 보고',evidence:null});
  assert.equal(inspectResultFile(b.project,file).task.id,t);assert.ok(original.entryId&&copy.entryId);
});

test('F083-S6 autosave edits only its active entry in the lifecycle it opened; trash+restore elsewhere blocks a late save', async () => {
  const storage=new Memory(),locks=new Locks(),a=new WorkspaceStore(storage,locks,ids),b=new WorkspaceStore(storage,locks,ids);await a.init();
  const ref=await a.create(project('하나'),'new');await b.init();
  const saved=await a.save(ref,D.rename(a.entries()[0].project,'a1'));assert.equal(saved.seq,2);
  await b.trash(ref.entryId);await assert.rejects(a.save(saved,D.rename(a.entries()[0].project,'trashed-write')),/TRASHED/);
  await b.restoreEntry(ref.entryId);
  await assert.rejects(a.save(saved,D.rename(a.entries()[0].project,'late')),/TRASHED/,'restored, but a newer lifecycle than this tab opened');
  const e=env(storage).entries[0];assert.equal(e.project.name,'a1');assert.equal(e.lifecycle,3);assert.equal(e.state,'active');
  assert.equal(e.project.revision,a.entries()[0].project.revision,'trash/restore never touch Project.revision');
  await assert.rejects(a.save({entryId:'E_test-missing0',lifecycle:1,seq:1},project('x')),/ENTRY_MISSING/,'autosave never adds an entry');
});

test('F083-S7 another tab\'s newer save of the same entry is not overwritten; concurrent trash and autosave serialise', async () => {
  const storage=new Memory(),locks=new Locks(),a=new WorkspaceStore(storage,locks,ids),b=new WorkspaceStore(storage,locks,ids);await a.init();
  const ref=await a.create(project('같은 프로젝트'),'new');await b.init();
  await b.save(ref,D.rename(b.entries()[0].project,'b'));
  await assert.rejects(a.save(ref,D.rename(a.entries()[0].project,'a')),/STORAGE_CONFLICT/);
  const [trashed,late]=await Promise.allSettled([a.trash(ref.entryId),b.save({...ref,seq:2},D.rename(b.entries()[0].project,'b2'))]);
  assert.equal(trashed.status,'fulfilled');assert.equal(late.status,'rejected');
  assert.equal(env(storage).entries[0].project.name,'b');assert.equal(env(storage).entries[0].state,'trashed');
});

test('F083-S8 a quota failure keeps the stored workspace and reports it; nothing is half-written', async () => {
  const storage=new Memory(),w=new WorkspaceStore(storage,new Locks(),ids);await w.init();
  const ref=await w.create(project('공간'),'new');const before=storage.getItem(WORKSPACE_KEY);
  storage.fail=k=>k===WORKSPACE_KEY;
  await assert.rejects(w.save(ref,D.rename(w.entries()[0].project,'x')),e=>e.name==='QuotaExceededError');
  await assert.rejects(w.create(project('둘'),'import'),e=>e.name==='QuotaExceededError');
  await assert.rejects(w.trash(ref.entryId),e=>e.name==='QuotaExceededError');
  assert.equal(storage.getItem(WORKSPACE_KEY),before);
});
