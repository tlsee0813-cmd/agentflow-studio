import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, editDraft, setKind, submit, editTask, recordBasis, markHandoff, handoffText, returnTargets, returnTargetId, taskOf, begin } from '../dist/public/shared/domain.js';
import { returnPreview } from '../dist/public/client/presentation.js';
import { parseProject } from '../dist/public/shared/validation.js';
import { serializeProject } from '../dist/public/shared/storage.js';
const input=(p,text,kind='request')=>editDraft(setKind(p,kind),text);
const exported=(p,text)=>{p=submit(input(p,text));p=editTask(p,p.currentTaskId,'next',text+' 수동값');return markHandoff(p,p.currentTaskId,handoffText(p),'download');};
function pair(){let p=exported(createProject(),'A 요청');const A=p.currentTaskId;p=exported(p,'B 요청');return {p,A,B:p.currentTaskId};}
test('S035-1 explicit report/evidence parent equals preview; sources, bases, history and manual values survive JSON recovery',()=>{
  for(const kind of ['report','evidence']) {
    let {p,A,B}=pair();p=recordBasis(p,'이후 기록');p=input(p,'  A 원문\n그대로  ',kind);
    const before=structuredClone(p),preview=returnPreview(p,A),n=submit(p,A);
    assert.equal(preview.targetTaskId,A);assert.equal(preview.exportedAt,p.tasks[0].handoffs.at(-1).at);
    assert.deepEqual(preview.recordedBases,p.bases.filter(b=>b.revision>p.tasks[0].handoffs.at(-1).revision));
    assert.equal(taskOf(n).parentTaskId,A);assert.notEqual(A,B);assert.equal(n.sources.at(-1).text,p.draft);
    assert.equal(n.sources.at(-1).kind,kind);assert.equal(n.sources.at(-1).replyTo,null);
    assert.deepEqual(n.sources.slice(0,-1),p.sources);assert.deepEqual(n.bases,p.bases);assert.deepEqual(n.tasks.slice(0,-1),p.tasks);
    assert.deepEqual(p,before);assert.equal(taskOf(parseProject(serializeProject(n))).parentTaskId,A);
  }
});
test('S035-2 invalid, unexported and other-project IDs fail atomically in submit and preview',()=>{
  let {p}=pair();p=submit(input(p,'내보내지 않은 작업'));const unexported=p.currentTaskId;
  const foreign=exported(createProject(),'다른 프로젝트').currentTaskId;
  for(const kind of ['report','evidence'])for(const id of ['',unexported,foreign,'missing']) {
    const draft=input(p,'원문',kind),before=JSON.stringify(draft);
    assert.throws(()=>submit(draft,id),/INVALID_RETURN_TARGET/);assert.throws(()=>returnPreview(draft,id),/INVALID_RETURN_TARGET/);
    assert.equal(JSON.stringify(draft),before);
  }
});
test('S035-3 omitted target preserves zero/single/multiple fallback and reverse task order, not export date',()=>{
  let p=input(createProject(),'첫 결과','report');assert.equal(returnTargetId(p),null);assert.equal(taskOf(submit(p)).parentTaskId,null);
  p=submit(input(createProject(),'미내보낸 요청'));const first=p.currentTaskId;p=input(p,'결과','evidence');assert.equal(taskOf(submit(p)).parentTaskId,first);
  p=exported(createProject(),'하나');assert.equal(returnTargets(p).length,1);assert.equal(taskOf(submit(input(p,'결과','report'))).parentTaskId,p.currentTaskId);
  let {p:q,A,B}=pair();q=markHandoff(q,A,handoffText(q,A),'download');assert.deepEqual(returnTargets(q).map(t=>t.id),[B,A]);
  assert.equal(taskOf(submit(input(q,'결과','report'))).parentTaskId,B);
  assert.equal(taskOf(submit(input(q,'일반 요청'),'invalid ignored for normal request')).parentTaskId,q.currentTaskId);
});
test('S035-4 next B request context contains B return and excludes A return without removing global A request basis',()=>{
  let {p,A,B}=pair();p=submit(input(p,'A 반환 원문','report'),A);p=submit(input(p,'B 반환 원문','evidence'),B);
  p=submit(input(p,'B 다음 요청'));const started=begin(p);const request=JSON.stringify(started.request),handoff=handoffText(p);
  for(const raw of [request,handoff]){assert.match(raw,/B 반환 원문/);assert.doesNotMatch(raw,/A 반환 원문/);assert.match(raw,/A 요청/);}
  assert.equal(p.sources.find(s=>s.text==='A 반환 원문').kind,'report');
});
