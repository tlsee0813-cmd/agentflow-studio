// FLOW083: several projects in one browser. Payloads stay byte-for-byte in their own keys; the pre-workspace key
// is listed in place (never moved or removed); trash is an index state; every index write re-reads the stored index.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import {ProjectStore,WorkspaceStore,STORAGE_KEY,WORKSPACE_KEY,slotKey,serializeProject} from '../dist/public/shared/storage.js';
class Memory { constructor(seed={}){this.map=new Map(Object.entries(seed));this.fail=()=>false;} getItem(k){return this.map.get(k)??null;} setItem(k,v){if(this.fail(k))throw Object.assign(new Error('full'),{name:'QuotaExceededError'});this.map.set(k,String(v));} }
let n=0;const ids=()=>`W_test-${String(++n).padStart(8,'0')}`;
const project=text=>D.submit(D.editDraft(D.createProject(),text));

test('F083-S1 the pre-workspace project is listed in place once, its bytes untouched', () => {
  const raw=serializeProject(project('기존 프로젝트'));const storage=new Memory({[STORAGE_KEY]:raw});
  const a=new WorkspaceStore(storage,ids),b=new WorkspaceStore(storage,ids);
  assert.deepEqual(a.load().map(s=>[s.slot,s.state]),[['legacy','active']]);
  assert.deepEqual(b.load().map(s=>s.slot),['legacy'],'a second tab or load never lists it twice');
  assert.equal(storage.getItem(STORAGE_KEY),raw);
  assert.equal(JSON.parse(storage.getItem(WORKSPACE_KEY)).slots.length,1);
});

test('F083-S2 first project keeps the original key; later ones get their own; trash and restore keep payload bytes', () => {
  const storage=new Memory(),w=new WorkspaceStore(storage,ids);w.load();
  const first=w.newSlot();assert.equal(first,'legacy');new ProjectStore(storage,slotKey(first)).save(project('첫 프로젝트'));w.register(first);
  const second=w.newSlot();assert.match(second,/^W_/);new ProjectStore(storage,slotKey(second)).save(project('둘째 프로젝트'));w.register(second);
  const bytes=storage.getItem(slotKey(second));
  w.trash(second);assert.equal(w.stateOf(second),'trashed');assert.equal(storage.getItem(slotKey(second)),bytes);
  w.restoreSlot(second);assert.equal(w.stateOf(second),'active');assert.equal(storage.getItem(slotKey(second)),bytes);
  assert.equal(w.peek(first).name,'나의 프로젝트');
});

test('F083-S3 an older tab sees a trash made elsewhere and cannot list it back by writing a stale index', () => {
  const storage=new Memory(),a=new WorkspaceStore(storage,ids),b=new WorkspaceStore(storage,ids);a.load();
  const s1=a.newSlot();new ProjectStore(storage,slotKey(s1)).save(project('하나'));a.register(s1);
  b.load();const s2=b.newSlot();new ProjectStore(storage,slotKey(s2)).save(project('둘'));
  a.trash(s1);
  assert.equal(b.stateOf(s1),'trashed','fresh read, not b\'s in-memory list');
  b.register(s2); // b's own write re-reads first: a's trash survives
  assert.equal(new WorkspaceStore(storage,ids).load().find(s=>s.slot===s1).state,'trashed');
});

test('F083-S4 a payload written without its listing is reported unlisted and listed again, never copied', () => {
  const storage=new Memory(),w=new WorkspaceStore(storage,ids);w.load();
  storage.fail=k=>k===WORKSPACE_KEY;
  const s=w.newSlot();new ProjectStore(storage,slotKey(s)).save(project('목록 실패'));
  assert.throws(()=>w.register(s));assert.equal(w.stateOf(s),'unlisted');
  storage.fail=()=>false;w.register(s);w.register(s);
  assert.deepEqual(JSON.parse(storage.getItem(WORKSPACE_KEY)).slots.map(x=>x.slot),[s]);
});

test('F083-S5 an unreadable index is never overwritten; the original key stays listed and reachable', () => {
  const raw=serializeProject(project('기존'));const storage=new Memory({[STORAGE_KEY]:raw,[WORKSPACE_KEY]:'{broken'});
  const w=new WorkspaceStore(storage,ids);
  assert.deepEqual(w.load().map(s=>s.slot),['legacy']);assert.equal(w.blocked,true);
  assert.throws(()=>w.register('W_test-blocked1'),/STORAGE_BLOCKED/);assert.throws(()=>w.trash('legacy'),/STORAGE_BLOCKED/);
  assert.equal(storage.getItem(WORKSPACE_KEY),'{broken');assert.equal(storage.getItem(STORAGE_KEY),raw);
});

test('F083-S6 a project store writes only its own key and still refuses another tab\'s newer bytes', () => {
  const storage=new Memory(),key=slotKey('W_test-conflict');
  const a=new ProjectStore(storage,key),b=new ProjectStore(storage,key);a.save(project('a'));
  b.load();a.save(D.rename(a.load(),'a2'));
  assert.throws(()=>b.save(project('b')),/STORAGE_CONFLICT/);
  assert.equal(storage.getItem(STORAGE_KEY),null,'never touches the original key');
});
