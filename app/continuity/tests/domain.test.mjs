import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import { validateProject,parseProject,validateAdvice,validateRequest } from '../dist/public/shared/validation.js';
import { ProjectStore,STORAGE_KEY,LEGACY_BACKUP_KEY,serializeProject,storageErrorCode } from '../dist/public/shared/storage.js';
import { REQUEST_BYTES,FILE_LIMIT,EXCERPT_CHARS,ITEM_LIMIT } from '../dist/public/shared/types.js';
import { cycles,longRequests,toLegacy,LONG_REQUEST,shortRequests,synthetic } from './fixtures.mjs';
import { mockAdvice } from '../server/mock.mjs';
function request(text='예약은 참여 확인 뒤 확정해줘.',p=D.createProject(),kind='request') {return D.submit(D.editDraft(D.setKind(p,kind),text));}
function start(p){return D.begin(p);}
function respond(p){const s=start(p);return D.receive(s.project,s.request,{mode:'mock',ticket:s.request.ticket,advice:mockAdvice(s.request)});}
const clone=v=>structuredClone(v);
function memory(){const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};}
test('I15-D01 exact free input preserved; immutable requested origin, not confirmed; small wording change no question',()=>{
  let p=request('  버튼 문구만 “예약 완료”로 바꿔줘.  ');assert.equal(p.sources[0].text,'  버튼 문구만 “예약 완료”로 바꿔줘.  ');
  p=respond(p);assert.equal(p.bases[0].status,'requested');assert.equal(p.bases[0].sourceId,p.sources[0].id);assert.equal(D.taskOf(p).advice.question,null);validateProject(p);
});
test('I15-D02 meaningful choice and unknown technical fact use separate paths, no compulsory alternatives',()=>{
  let p=respond(request('빈자리가 나면 대기자를 자동으로 예약해줘.'));assert.equal(D.taskOf(p).advice.question.kind,'choice');assert.equal(D.taskOf(p).advice.question.options.length,2);
  p=respond(request('결제가 실패했는데 원인을 모르겠어요.'));assert.equal(D.taskOf(p).advice.question.kind,'fact');assert.deepEqual(D.taskOf(p).advice.question.options,[]);
});
test('I15-D03 actual answer attached to real question and no new forced confirmation',()=>{
  let p=respond(request('빈자리가 나면 대기자를 자동으로 예약해줘.'));
  const old=clone(p.bases),q=D.taskOf(p).advice.question.text;
  p=D.answer(p,p.currentTaskId,'참여 확인 뒤에만 예약을 확정해줘.');p=respond(p);
  assert.equal(D.taskOf(p).advice.question,null);assert.equal(p.sources.at(-1).kind,'answer');assert.equal(p.sources.at(-1).replyTo,q);assert.deepEqual(p.bases.slice(0,old.length),old);assert.equal(p.bases.at(-1).status,'answered');
  assert.match(D.handoffText(p),/참여 확인 뒤에만/);
});
test('I15-D04 unknown/defer applies only to answer; untouched old bases survive, no repeat question',()=>{
  for(const disp of ['unknown','deferred']) {
    let p=respond(request('결제 오류의 원인을 모르겠어요.'));p=D.recordBasis(p,'결제 정보는 외부에 공개하지 않는다.');const before=clone(p.bases);
    p=D.answer(p,p.currentTaskId,'확인할 항목만 남겨 주세요.',disp);p=respond(p);
    assert.equal(D.taskOf(p).advice.question,null);assert.deepEqual(p.bases.slice(0,before.length),before);assert.equal(p.bases.at(-1).status,'answered');assert.match(D.handoffText(p),/결제 정보는 외부에 공개하지 않는다/);
  }
});
test('I15-D05 AI cannot set source kind/status or write a basis; whole malformed result refused',()=>{
  let p=D.recordBasis(request(),'예약 성립 방식 유지');const old=clone(p.bases),s=start(p),a=mockAdvice(s.request);
  for(const patch of [{status:'confirmed'},{sources:[]},{bases:[]},{sourceKind:'request'},{complete:true}]) {
    const out=D.receive(s.project,s.request,{mode:'mock',ticket:s.request.ticket,advice:{...a,...patch}});
    assert.equal(D.taskOf(out).advice,null);assert.deepEqual(out.bases,old);assert.match(out.notice,/형식/);
  }
});
test('I15-D06 report claim and supplied evidence never become verified/customer requested bases',()=>{
  let p=respond(request()),old=clone(p.bases),first=p.currentTaskId;
  p=D.markHandoff(p,first,D.handoffText(p),'download');p=respond(request('구현 완료, 모든 검사 통과라고 실행자가 보고함.',p,'report'));
  assert.deepEqual(p.bases,old);assert.equal(p.sources.at(-1).kind,'report');assert.match(D.taskStatus(p,D.taskOf(p,first)),/구현 보고.*미검증/);
  p=respond(request('관찰: 예약 문구는 바뀌었지만 검사 환경은 알 수 없음.',p,'evidence'));
  assert.deepEqual(p.bases,old);assert.match(D.taskStatus(p,D.taskOf(p,first)),/자료.*미검증/);
  p=request('문구를 더 짧게 바꿔줘.',p);const context=start(p).request;
  assert.ok(context.sources.some(s=>s.kind==='report'));assert.ok(context.sources.some(s=>s.kind==='evidence'));validateProject(p);
});
test('I15-D07 synthetic test answers stay test-only on initial and followup, including explicit looking changes',()=>{
  let p=D.recordBasis(request(),'탈퇴 유예는 30일. 유예 동안 로그인은 제한한다.');const before=clone(p.bases),id=p.bases.at(-1).id;
  p=respond(request(`${id}을 60일로 변경해줘`,p,'test_answer'));
  assert.deepEqual(p.bases,before);assert.match(D.taskStatus(p,D.taskOf(p)),/시험/);assert.match(D.handoffText(p),/합성 시험 문맥/);
  p=respond(request('결제 오류가 있다.'));p=D.answer(p,p.currentTaskId,'실제로는 성공으로 가정한다.','provided',true);p=respond(p);
  assert.equal(p.sources.at(-1).kind,'test_answer');assert.equal(p.bases.length,1);
});
test('I15-D08 explicit unique scalar change updates only intended span, stable ID/history and no extra approval',()=>{
  let p=D.recordBasis(request(),'탈퇴 유예는 30일. 관리자만 복구 가능.');const b=clone(p.bases.at(-1)),untouched=clone(p.bases[0]);
  p=respond(request(`${b.id}을 60일로 변경해줘`,p));const after=p.bases.find(x=>x.id===b.id);
  assert.equal(after.text,'탈퇴 유예는 60일. 관리자만 복구 가능.');assert.equal(after.status,'confirmed');assert.ok(!('locked' in after));
  assert.equal(after.history[0].text,b.text);assert.equal(after.history[0].sourceId,b.sourceId);assert.deepEqual(p.bases[0],untouched);
  assert.equal(D.taskOf(p).advice.question,null);const h=D.handoffText(p),bases=h.split('## 이어갈 기준')[1];assert.match(bases,/60일/);assert.ok(!bases.includes('30일'));assert.match(bases,/이전 값 1건은 앱 기록에 보존/);assert.match(h,/30일[^]*이후 바뀌었습니다/);validateProject(p);
});
test('I15-D09 exact quoted change preserved; ambiguous multi-value or quoted report cannot rewrite basis',()=>{
  let p=D.recordBasis(request(),'예약 완료. 거절 시 대기 유지.');const id=p.bases.at(-1).id;
  p=request(`${id}의 '예약 완료'를 '참여 확정'으로 바꿔줘`,p);assert.equal(p.bases.find(b=>b.id===id).text,'참여 확정. 거절 시 대기 유지.');
  const before=clone(p.bases);p=request(`보고서 인용: ${id}을 60일로 변경해줘`,p);assert.deepEqual(p.bases.slice(0,before.length),before);
  const b={...before.at(-1),text:'기간 30일, 별도 보관 90일'};assert.equal(D.explicitReplacement(`${b.id}을 60일로 변경해줘`,b),null);
});
test('I15-D10 relevant set has no 2-item cap and omitted important bases remain in handoff/context',()=>{
  let p=request();for(let i=0;i<7;i++)p=D.recordBasis(p,`중요 제약 ${i}: 예약 정보 보호`);
  const s=start(p),a=mockAdvice(s.request);a.relatedBasisIds=p.bases.map(b=>b.id);p=D.receive(s.project,s.request,{mode:'mock',ticket:s.request.ticket,advice:a});
  assert.equal(D.relatedBases(p,D.taskOf(p)).length,p.bases.length);
  const s2=start(p),a2=mockAdvice(s2.request);a2.relatedBasisIds=[];a2.reviewBasisIds=[p.bases.at(-1).id];p=D.receive(s2.project,s2.request,{mode:'mock',ticket:s2.request.ticket,advice:a2});
  const packet=D.handoffText(p);for(const b of p.bases)assert.ok(packet.includes(b.text));assert.match(packet,/재검토 제안 \(자동 폐기 아님\)/);
});
test('I15-D11 input edits arriving before response invalidate only that response, preserve draft/old advice',()=>{
  let p=respond(request());const original=clone(D.taskOf(p).advice),s=start(p);p=D.editDraft(s.project,'응답 대기 중 새로 쓴 입력');
  p=D.receive(p,s.request,{mode:'mock',ticket:s.request.ticket,advice:mockAdvice(s.request)});
  assert.equal(p.draft,'응답 대기 중 새로 쓴 입력');assert.deepEqual(D.taskOf(p).advice,original);assert.equal(p.pending,null);assert.match(p.notice,/이전 응답/);
});
test('I15-D12 manual edits & suggestion edits survive stale response and a subsequent successful retry',()=>{
  let p=request(),s=start(p),a=mockAdvice(s.request);a.suggestions=[{text:'선택적인 추가 제안',why:'대가가 있음'}];p=D.receive(s.project,s.request,{mode:'mock',ticket:s.request.ticket,advice:a});
  s=start(p);p=D.editTask(s.project,p.currentTaskId,'scope','수동 범위만');p=D.editTask(p,p.currentTaskId,'next','전문가가 직접 작성한 인계');p=D.editSuggestion(p,p.currentTaskId,0,'text','수동 제안');
  p=D.receive(p,s.request,{mode:'mock',ticket:s.request.ticket,advice:mockAdvice(s.request)});p=respond(p);
  assert.equal(D.taskValues(D.taskOf(p)).scope,'수동 범위만');assert.equal(D.taskValues(D.taskOf(p)).next,'전문가가 직접 작성한 인계');assert.equal(D.taskSuggestions(D.taskOf(p))[0].text,'수동 제안');
  assert.match(D.handoffText(p),/수동 제안/);validateProject(p);
});
test('I15-D13 retry reuses sources; duplicate/stale ticket cannot overwrite new ticket',()=>{
  let p=request(),one=start(p),failed=D.failed(one.project,one.request.ticket,'실패'),two=start(failed);
  const old=D.receive(two.project,one.request,{mode:'mock',ticket:one.request.ticket,advice:mockAdvice(one.request)});
  assert.equal(old.pending.requestId,two.request.ticket.requestId);assert.equal(old.sources.length,1);
  p=D.receive(old,two.request,{mode:'mock',ticket:two.request.ticket,advice:mockAdvice(two.request)});assert.equal(p.sources.length,1);
  assert.deepEqual(D.receive(p,two.request,{mode:'mock',ticket:two.request.ticket,advice:mockAdvice(two.request)}),p);
});
test('I15-D14 cancellation and reload preserve inputs, do not automatically dispatch',()=>{
  let p=request(),s=start(p);p=D.editDraft(s.project,'아직 보내지 않은 다음 입력');const c=D.cancel(p);assert.equal(c.draft,p.draft);assert.equal(c.pending,null);
  const stored=parseProject(JSON.stringify(p)),restored=D.restore(stored);assert.equal(restored.pending,null);assert.equal(restored.draft,p.draft);assert.match(restored.notice,/자동으로 다시/);
});
test('I15-D15 lossless JSON roundtrip includes history, manual fields, source kinds and export records',()=>{
  let p=respond(request());p=D.recordBasis(p,'실제 사용자 기준');p=D.editTask(p,p.currentTaskId,'next','전문가 작성');p=D.markHandoff(p,p.currentTaskId,D.handoffText(p),'download');
  p=request('구현했다고 보고함',p,'report');p=D.editDraft(p,'미전송 입력');assert.deepEqual(parseProject(JSON.stringify(p)),p);
});
test('I15-D16 malformed/version/foreign refs/cycle/authority promotion import rejected without mutating old project',()=>{
  const p=request(),before=clone(p);
  for(const mutate of [v=>v.schemaVersion='future',v=>v.tasks[0].sourceIds=['missing'],v=>v.tasks[0].parentTaskId=v.tasks[0].id,
    v=>v.sources[0].kind='test_answer',v=>v.bases.push({...v.bases[0]})]){
    const bad=clone(p);mutate(bad);assert.throws(()=>parseProject(JSON.stringify(bad)));assert.deepEqual(p,before);
  }
});
test('I15-D17 storage failure and cross-tab conflict leave memory and previous valid persisted data intact',()=>{
  const m=memory(),a=new ProjectStore(m),b=new ProjectStore(m);a.load();b.load();const p=request();a.save(p);
  assert.throws(()=>b.save(request('다른 탭')),/STORAGE_CONFLICT/);assert.deepEqual(parseProject(m.getItem(STORAGE_KEY)),p);
  const broken={getItem:m.getItem,setItem(){throw new Error('quota');}},s=new ProjectStore(broken);s.load();assert.throws(()=>s.save(D.editDraft(p,'메모리에만')),/quota/);assert.deepEqual(parseProject(m.getItem(STORAGE_KEY)),p);
});
test('I15-D18 corrupted stored file is not overwritten automatically; explicit replacement can recover',()=>{
  const m=memory();m.setItem(STORAGE_KEY,'broken');const s=new ProjectStore(m);assert.throws(()=>s.load());assert.throws(()=>s.save(request()),/STORAGE_BLOCKED/);assert.equal(m.getItem(STORAGE_KEY),'broken');s.replace(request());assert.ok(parseProject(m.getItem(STORAGE_KEY)));
});
test('I15-D19 full unrelated chat is not sent; known bases and adjacent return group are retained',()=>{
  let p=request();p=D.markHandoff(p,p.currentTaskId,D.handoffText(p),'download');p=request('예전 보고',p,'report');p=respond(p);p=request('이번 문구 수정',p);p=respond(p);p=D.markHandoff(p,p.currentTaskId,D.handoffText(p),'download');p=request('새 보고',p,'report');p=request('새 문구 변경',p);
  const r=start(p).request;assert.ok(!r.sources.some(s=>s.text==='예전 보고'));assert.ok(r.sources.some(s=>s.text==='새 보고'));assert.equal(r.bases.length,p.bases.length);validateRequest(r);
});
test('I15-D20 invalid reference, authority key or control character in AI text rejected',()=>{
  const r=start(request()).request,a=mockAdvice(r);
  for(const bad of [{...a,relatedBasisIds:['MISSING']},{...a,understanding:'bad\u0000'},{...a,decision:{state:'confirmed'}}])assert.throws(()=>validateAdvice(bad,r.bases.map(b=>b.id)));
});

test('I15-D21 real choice/unknown answers remain available after several later changes without another confirmation',()=>{
  let p=respond(request('빈자리가 생기면 대기자를 자동으로 예약해줘.'));p=D.answer(p,p.currentTaskId,'참여 확인 뒤 확정하고 미응답 시간은 보류한다.');p=respond(p);
  for(const value of ['문구만 바꿔줘.','CSV 출력 추가해줘.','라벨만 더 짧게 바꿔줘.'])p=respond(request(value,p));
  assert.ok(start(p).request.bases.some(b=>b.status==='answered'&&b.text.includes('참여 확인 뒤 확정')));assert.match(D.handoffText(p),/미응답 시간은 보류/);validateProject(p);
});
test('I15-D22 after a pasted report, the next change still carries the handed-off work and its user-edited scope',()=>{
  let p=respond(request('회원 목록에 CSV 다운로드 추가해줘.'));const t1=p.currentTaskId;
  p=D.editTask(p,t1,'scope','결제 화면과 권한 로직은 건드리지 말 것');p=D.markHandoff(p,t1,D.handoffText(p),'clipboard');
  p=respond(request('CSV 버튼 추가 완료, 테스트 통과',p,'report'));p=respond(request('CSV 파일명에 날짜 붙여줘.',p));
  const r=start(p).request;assert.equal(r.previousWork.taskId,t1);assert.equal(r.previousWork.scope,'결제 화면과 권한 로직은 건드리지 말 것');
  assert.ok(r.sources.some(s=>s.text==='CSV 버튼 추가 완료, 테스트 통과'));assert.match(D.handoffText(p),/결제 화면과 권한 로직은 건드리지 말 것/);validateRequest(r);
});
test('I15-D23 explicit quoted change inserts the typed text literally ($$, $& are not replacement patterns)',()=>{
  let p=D.recordBasis(request('시작'),'표시 가격은 10달러');
  p=request("D2 '10달러'를 '$$9.99 ($&)'로 바꿔줘",p);assert.equal(p.bases.find(b=>b.id==='D2').text,'표시 가격은 $$9.99 ($&)');validateProject(p);
});
// --- IDEA015-R2: advice revision, long-use storage, answers, storage messages ---
const section=(h,title)=>{const i=h.indexOf(title);assert.ok(i>=0,title);const j=h.indexOf('\n## ',i+title.length);return h.slice(i,j<0?undefined:j);};
function withAdvice(p,patch){const s=start(p);return D.receive(s.project,s.request,{mode:'mock',ticket:s.request.ticket,advice:{...mockAdvice(s.request),...patch}});}
test('I15-D24 AI text written before a basis change is withheld from the current handoff, also after reload; user text stays',()=>{
  let p=withAdvice(request('탈퇴 30일 뒤 계정 삭제 배치를 추가해줘.'),{understanding:'탈퇴 30일 뒤 삭제 배치',next:'30일 지난 계정을 삭제하는 nightly job 구현',checks:'30일 경과 계정만 삭제되는지 확인'});
  assert.match(section(D.handoffText(p),'## 이번 작업'),/30일 지난 계정/);const r=D.taskOf(p).adviceRevision;assert.equal(typeof r,'number');
  p=D.recordBasis(p,'탈퇴 14일 뒤 계정 삭제','confirmed','D1');
  for(const q of [p,parseProject(serializeProject(p))]) {
    const t=D.taskOf(q),w=D.currentWork(q,t),h=D.handoffText(q);
    assert.equal(w.aiExcluded,true);assert.deepEqual(D.changedSinceAdvice(q,t).map(b=>b.id),['D1']);
    assert.ok(!section(h,'## 이번 작업').includes('30일'));assert.ok(!section(h,'## 이어갈 기준').includes('30일'));assert.match(section(h,'## 이어갈 기준'),/14일/);
    assert.match(h,/AI 정리는 기준 r\d+에서 작성돼 그 뒤 바뀐 기준\(D1 r\d+\)/);assert.match(h,/30일[^]*이후 바뀌었습니다/);
    assert.equal(t.advice.next,'30일 지난 계정을 삭제하는 nightly job 구현'); // kept in the project, not exported as current
  }
  p=D.editTask(p,p.currentTaskId,'next','14일 지난 계정을 삭제하는 nightly job 구현');
  const h=D.handoffText(p);assert.match(section(h,'## 이번 작업'),/14일 지난 계정/);assert.ok(!section(h,'## 이번 작업').includes('30일'));
  p=D.markHandoff(p,p.currentTaskId,h,'download');const rec=D.taskOf(p).handoffs.at(-1);
  assert.equal(rec.work.next,'14일 지난 계정을 삭제하는 nightly job 구현');assert.equal(rec.aiExcluded,true);assert.equal(rec.chars,h.length);assert.ok(!('text' in rec));
  p=withAdvice(p,{next:'14일 기준 배치 구현'});assert.equal(D.currentWork(p,D.taskOf(p)).aiStale,false);assert.equal(D.currentWork(p,D.taskOf(p)).values.next,'14일 지난 계정을 삭제하는 nightly job 구현');
});
test('I15-D25 previous work AI text is withheld after its basis changed; user-edited previous scope is still carried',()=>{
  let p=withAdvice(D.recordBasis(request('정산 배치 추가'),'정산 마감은 매월 25일'),{next:'25일 마감 배치 구현'});const t1=p.currentTaskId;
  p=D.editTask(p,t1,'scope','환불 로직은 건드리지 않는다');p=D.markHandoff(p,t1,D.handoffText(p),'clipboard');p=request('구현 완료',p,'report');p=request('D2을 20일로 변경해줘',p);
  const r=start(p).request;assert.equal(r.previousWork.taskId,t1);assert.equal(r.previousWork.next,'');assert.equal(r.previousWork.scope,'환불 로직은 건드리지 않는다');assert.equal(r.previousWork.aiTextExcluded,true);
  assert.ok(!D.handoffText(p).includes('25일 마감 배치 구현'));validateRequest(r);
});
test('I15-D26 project.1 files migrate without losing records; old AI text is treated as unknown-revision',()=>{
  const c=cycles(3),legacy=toLegacy(c),raw=JSON.stringify(legacy,null,2),p=parseProject(raw);
  assert.equal(p.schemaVersion,'idea015.project.2');assert.match(p.notice,/project\.1/);assert.ok(p.bases.every(b=>!('locked' in b)));
  assert.deepEqual(p.bases.map(b=>[b.id,b.text,b.history]),c.project.bases.map(b=>[b.id,b.text,b.history]));assert.deepEqual(p.sources,c.project.sources);
  assert.deepEqual(p.tasks.flatMap(t=>t.handoffs.map(h=>h.legacyText)),c.texts);
  const t=p.tasks.find(t=>t.advice);assert.equal(D.changedSinceAdvice(p,t),'unknown');assert.equal(D.currentWork(p,t).aiStale,true);
  assert.deepEqual(parseProject(serializeProject(p)),p);
  const bad=structuredClone(legacy);delete bad.bases[0].locked;assert.throws(()=>parseProject(JSON.stringify(bad)));
});
test('I15-D27 68 report/export cycles and 54 long requests keep editing, export, AI context and backup->import working',()=>{
  const {project}=cycles(68),raw=serializeProject(project),bytes=new TextEncoder().encode(raw).length;
  assert.ok(bytes<FILE_LIMIT/4,`project ${bytes} bytes`);assert.equal(project.tasks.flatMap(t=>t.handoffs).length,68);
  const back=parseProject(raw);assert.deepEqual(back,project);let p=D.editDraft(back,'계속 편집');p=D.recordBasis(p,'새 제약','confirmed');
  assert.ok(D.handoffText(p).includes('새 제약'));assert.ok(new TextEncoder().encode(JSON.stringify(start(p).request)).length<=REQUEST_BYTES);
  const growth=[20,40,60].map(n=>new TextEncoder().encode(serializeProject(cycles(n).project)).length);
  assert.ok(growth[2]-growth[1] < (growth[1]-growth[0])*1.5,`linear growth ${growth}`);
  let l=longRequests(54);const req=start(l).request,handoff=D.handoffText(l);
  assert.ok(new TextEncoder().encode(JSON.stringify(req)).length<=REQUEST_BYTES);assert.equal(req.bases.length,54);
  assert.ok(req.bases.filter(b=>b.partial).every(b=>Array.from(b.text).length<=EXCERPT_CHARS+2));assert.ok(!req.bases.at(-1).partial);
  for(const b of l.bases)assert.ok(handoff.includes(b.text));assert.deepEqual(parseProject(serializeProject(l)),l);
  for(let i=0;i<120;i++)l=request(LONG_REQUEST+'추가'+i,l);assert.ok(D.handoffText(l).length>0);assert.deepEqual(parseProject(serializeProject(l)),l);
});
test('I15-D28 important confirmed/answered/edited bases are never shortened in the AI context; only old untouched requests are',()=>{
  const long='중요 확정 제약: 개인정보는 외부로 보내지 않는다. '.repeat(30);
  let p=D.recordBasis(request(`유일문구. ${LONG_REQUEST}`),long);p=request('D1의 \'유일문구\'를 \'바뀐문구\'로 바꿔줘',p);for(let i=0;i<3;i++)p=request(`다음 작은 변경 ${i}`,p);
  const bases=start(p).request.bases,byId=Object.fromEntries(bases.map(b=>[b.id,b]));
  assert.equal(byId.D2.text,long);assert.equal(byId.D2.partial,false);assert.equal(byId.D1.partial,false);assert.equal(byId.D1.previousVersions,1);
  p=request(LONG_REQUEST+'B',p);for(let i=0;i<2;i++)p=request(`또 다른 변경 ${i}`,p);const old=start(p).request.bases.find(b=>b.text.startsWith('회원 관리 화면 개선 요청')&&b.partial);
  assert.ok(old);assert.ok(old.text.endsWith('…'));
});
test('I15-D29 a reply is recorded once even when re-organisation fails and is retried',()=>{
  let p=respond(request('결제가 실패하는데 원인을 모르겠어요.'));const id=p.currentTaskId;p=D.answer(p,id,'어제 오후부터 카드 결제만 실패');
  const s=start(p);p=D.failed(s.project,s.request.ticket,'실패');const count=p.bases.length;
  assert.equal(D.questionAnswered(p,D.taskOf(p)),true);assert.throws(()=>D.answer(p,id,'어제 오후부터 카드 결제만 실패'),/ALREADY_ANSWERED/);assert.equal(p.bases.length,count);
  assert.doesNotMatch(D.taskStatus(p,D.taskOf(p)),/항목 있음/);p=respond(p);assert.equal(p.sources.filter(s=>s.kind==='answer').length,1);
});
test('I15-D30 storage reports why it did not save; legacy browser data is kept before the first project.2 write',()=>{
  const m=memory();m.setItem(STORAGE_KEY,'broken');const s=new ProjectStore(m);assert.throws(()=>s.load());
  try{s.save(request());assert.fail();}catch(e){assert.equal(storageErrorCode(e),'STORAGE_BLOCKED');}
  assert.equal(storageErrorCode({name:'QuotaExceededError'}),'QUOTA');assert.equal(storageErrorCode(new Error('x')),'WRITE_FAILED');
  const c=cycles(2),legacy=JSON.stringify(toLegacy(c)),l=memory();l.setItem(STORAGE_KEY,legacy);const store=new ProjectStore(l),loaded=store.load();
  assert.match(loaded.notice,/project\.1/);assert.equal(l.getItem(LEGACY_BACKUP_KEY),legacy);store.save(D.editDraft(loaded,'계속'));
  assert.equal(JSON.parse(l.getItem(STORAGE_KEY)).schemaVersion,'idea015.project.2');assert.equal(l.getItem(LEGACY_BACKUP_KEY),legacy);
  const full=memory();full.setItem(STORAGE_KEY,legacy);const tight={getItem:full.getItem,setItem(k,v){if(k===LEGACY_BACKUP_KEY)throw Object.assign(new Error('quota'),{name:'QuotaExceededError'});full.setItem(k,v);}};
  const t=new ProjectStore(tight),kept=t.load();assert.match(kept.notice,/자동 저장을 멈췄습니다/);
  try{t.save(D.editDraft(kept,'덮어쓰기 시도'));assert.fail();}catch(e){assert.equal(storageErrorCode(e),'LEGACY_UNPRESERVED');}assert.equal(full.getItem(STORAGE_KEY),legacy);
});
// --- IDEA015-R3: persisted array bound follows the 8MB policy; save/backup/import share one acceptance test ---
const bytesOf=v=>new TextEncoder().encode(v).length;
function largestUnder(limit,make){let lo=1,hi=2;while(bytesOf(serializeProject(make(hi)))<=limit){lo=hi;hi*=2;}
  while(hi-lo>1){const mid=(lo+hi)>>1;if(bytesOf(serializeProject(make(mid)))<=limit)lo=mid;else hi=mid;}return lo;}
test('I15-D31 1001 short requests saved through the app reopen after save and after backup->import',()=>{
  const p=shortRequests(1001),m=memory();new ProjectStore(m).save(p);
  const reopened=new ProjectStore(m).load();assert.equal(reopened.tasks.length,1001);assert.deepEqual(reopened.bases,p.bases);
  assert.deepEqual(parseProject(serializeProject(p)),p);assert.ok(D.handoffText(reopened).includes('짧은 요청 1001'));
  const next=D.submit(D.editDraft(reopened,'1002번째 요청'));assert.equal(next.bases.at(-1).id,'D1002');new ProjectStore(m).load();
});
test('I15-D32 byte boundary: largest project under 8MB saves, reopens and imports; one step over is refused without touching storage',()=>{
  const n=largestUnder(FILE_LIMIT,synthetic),under=synthetic(n),over=synthetic(n+1);
  assert.ok(n>ITEM_LIMIT/10&&n<ITEM_LIMIT,`n=${n}`);
  const m=memory(),store=new ProjectStore(m),t0=Date.now();store.save(under);const raw=m.getItem(STORAGE_KEY);
  const reopened=new ProjectStore(m).load();assert.equal(reopened.tasks.length,n);assert.equal(parseProject(raw).sources.length,n);
  assert.ok(Date.now()-t0<5000,`save+load+import of ${bytesOf(raw)} bytes took ${Date.now()-t0}ms`);
  assert.throws(()=>store.save(over),/FILE_TOO_LARGE/);assert.equal(m.getItem(STORAGE_KEY),raw);
  assert.throws(()=>parseProject(serializeProject(over)),/FILE_TOO_LARGE/);assert.equal(over.tasks.length,n+1); // memory copy intact
});
test('I15-D33 item boundary: ITEM_LIMIT elements in one array are accepted, one more is refused by save and import alike',()=>{
  // Hand-crafted minimal elements (1-char id) are the only way to reach the cap under 8MB; app-made ones cannot (D34).
  const base=D.recordBasis(request('항목 경계'),'경계 기준'),old=base.bases.at(-1).sourceId;
  base.sources.find(s=>s.id===old).id='x';base.tasks.forEach(t=>t.sourceIds=t.sourceIds.map(id=>id===old?'x':id));base.bases.at(-1).sourceId='x';
  const make=k=>{const p=structuredClone(base);p.bases.at(-1).history=Array.from({length:k},()=>({text:'a',status:'confirmed',sourceId:'x',revision:0}));return p;};
  const at=make(ITEM_LIMIT),past=make(ITEM_LIMIT+1);assert.ok(bytesOf(serializeProject(past))<FILE_LIMIT,'item cap tested below the byte cap');
  const m=memory(),store=new ProjectStore(m);store.save(at);const raw=m.getItem(STORAGE_KEY);assert.equal(new ProjectStore(m).load().bases.at(-1).history.length,ITEM_LIMIT);
  assert.throws(()=>store.save(past),/INVALID_DATA/);assert.equal(m.getItem(STORAGE_KEY),raw);
  try{store.save(past);}catch(e){assert.equal(storageErrorCode(e),'INVALID_DATA');}
  assert.throws(()=>parseProject(serializeProject(past)),/INVALID_DATA/);
});
test('I15-D34 app-made elements stay above FILE_LIMIT/ITEM_LIMIT bytes, so the byte limit binds before the item cap',()=>{
  let p=cycles(3).project;p=respond(request('결제가 실패하는데 원인을 모르겠어요.',p));p=D.answer(p,p.currentTaskId,'모름','unknown');p=D.recordBasis(p,'결제 정보는 저장하지 않는다','confirmed','D1');
  const min=FILE_LIMIT/ITEM_LIMIT,size=v=>bytesOf(JSON.stringify(v))+1;
  const groups={sources:p.sources,bases:p.bases,tasks:p.tasks,history:p.bases.flatMap(b=>b.history),handoffs:p.tasks.flatMap(t=>t.handoffs)};
  for(const [name,items] of Object.entries(groups)){assert.ok(items.length>0,name);for(const item of items)assert.ok(size(item)>min,`${name} element ${size(item)} bytes`);}
  // A sourceIds entry is ~41 bytes, but each must name a distinct existing source, so their count is bounded by sources.
  for(const t of p.tasks)assert.ok(t.sourceIds.length<=p.sources.length);
});
