import test from 'node:test';
import assert from 'node:assert/strict';
import { posix, win32 } from 'node:path';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { initial, questionState, config, upstream } from './helpers.mjs';
import { createProject, editBrief, beginRequest, applyResponse, answerQuestion, reviseAnswer, decideRequirement, failRequest } from '../dist/public/shared/project.js';
import { ANSWER_MAX_LENGTH, REQUIREMENT_MAX_LENGTH } from '../dist/public/shared/contracts.js';
import { validateRequest, validateResult } from '../dist/public/shared/validation.js';
import { mockInterview } from '../server/providers/mock.mjs';
import { callDeepSeek } from '../server/providers/deepseek.mjs';
import { systemPrompt } from '../server/prompt.mjs';
import { createApp } from '../server/app.mjs';
import { resolvePublicFile, isWithinRoot, readPublicFile } from '../server/static-files.mjs';
const reply = state => {
  const b = beginRequest(state);
  return applyResponse(b.state,b.request,{mode:'mock',result:mockInterview(b.request)});
};
const tool = state => state.requirements.find(r=>r.id.endsWith(':REQ-tools'));
const core = state => state.requirements.find(r=>r.id.endsWith(':REQ-proposal-core-flow'));
const generic = () => reply(editBrief(createProject(),{idea:'동네 가게 비교 서비스',tools:'codex-only',constraints:''}));
const input = text => ({optionId:null,disposition:'answered',text});

test('R1.1 Codex -> Claude -> Codex reuses provenance, preserves ID, applies current selection',()=>{
  const first=generic(); const source=first.sources.find(s=>s.kind==='customer-input');
  const second=reply(editBrief(first,{...first.brief,tools:'claude-only'}));
  assert.match(tool(second).text,/Claude만/);
  const back=reply(editBrief(second,first.brief));
  assert.equal(back.brief.tools,'codex-only'); assert.match(tool(back).text,/Codex만/);
  assert.equal(tool(back).id,tool(first).id); assert.equal(tool(back).status,'confirmed');
  assert.equal(tool(back).needsReview,false);
  assert.equal(back.sources.filter(s=>s.kind==='customer-input').length,2);
  assert.equal(back.sources.find(s=>s.id===source.id),source);
  assert.ok(tool(back).sourceIds.includes(source.id));
  assert.ok(tool(second).sourceIds.every(id=>tool(back).sourceIds.includes(id)));
});
test('R1.2 tool -> undecided invalidates old confirmation immediately and after request',()=>{
  const first=generic();const edited=editBrief(first,{...first.brief,tools:'undecided'});
  for(const state of [edited,reply(edited)]) {
    assert.equal(tool(state).id,tool(first).id); assert.equal(tool(state).status,'deferred');
    assert.match(tool(state).text,/미정/);assert.doesNotMatch(tool(state).text,/Codex만 사용/);
  }
});
test('R1.3 conflicting locked tools remain preserved with explicit current selection and source',()=>{
  let state=generic();const id=tool(state).id;
  state=decideRequirement(state,id,'confirmed','고객이 잠근 도구 제약'); const original=tool(state);
  state=reply(editBrief(state,{...state.brief,tools:'claude-only'}));
  assert.equal(tool(state).text,original.text);assert.equal(tool(state).locked,true);
  assert.deepEqual(tool(state).sourceIds,original.sourceIds);
  assert.equal(state.conflicts.length,1);assert.equal(state.conflicts[0].requirementId,id);
  assert.match(state.conflicts[0].expectedText,/Claude만/);
  assert.ok(state.sources.some(s=>s.id===state.conflicts[0].sourceId));
  state=decideRequirement(state,id,'confirmed');assert.equal(tool(state).needsReview,true);
  state=reply(editBrief(state,{...state.brief,tools:'undecided'}));
  assert.match(state.conflicts[0].expectedText,/미정/); assert.equal(tool(state).text,original.text);
});
test('R1.4 locked canonical choice returning to same choice resolves only that conflict',()=>{
  let state=generic();state=decideRequirement(state,tool(state).id,'confirmed',tool(state).text);
  const original=state;
  state=reply(editBrief(state,{...state.brief,tools:'claude-only'}));assert.equal(state.conflicts.length,1);
  state=reply(editBrief(state,original.brief));assert.equal(state.conflicts.length,0);
  assert.equal(tool(state).locked,true);assert.equal(tool(state).needsReview,false);
});
test('R2.1 new answer refines actual proposed requirement + acceptance + source, same ID',()=>{
  const first=generic(), original=core(first);const sources=[...original.sourceIds];
  const answered=answerQuestion(first,{optionId:'record',disposition:'answered',text:'내용을 기록하고 다시 확인하기'});
  const state=reply(answered); const current=core(state);
  assert.equal(current.id,original.id); assert.equal(current.status,'proposed');assert.equal(current.locked,false);
  assert.match(current.text,/내용을 기록하고 다시 확인/);assert.doesNotMatch(current.text,/TBD/);
  assert.match(current.acceptance,/입력.*조회/);assert.ok(current.version>original.version);
  assert.ok(sources.every(id=>current.sourceIds.includes(id)));
  assert.ok(current.sourceIds.includes(answered.answers[0].sourceId));
  assert.ok(current.sourceIds.some(id=>state.sources.find(s=>s.id===id)?.kind==='mock-response'));
});
for(const status of ['confirmed','deferred','rejected']) test(`R2.2 ${status} is not overwritten by answer refinement`,()=>{
  let state=generic();state=decideRequirement(state,core(state).id,status);const old=core(state);
  state=reply(answerQuestion(state,{optionId:'record',disposition:'answered',text:'record'}));
  assert.equal(core(state).text,old.text);assert.equal(core(state).acceptance,old.acceptance);
  assert.deepEqual(core(state).sourceIds,old.sourceIds);assert.equal(core(state).status,status);
  assert.equal(core(state).needsReview,true);assert.ok(state.openItems.some(s=>s.includes('보존')));
});
test('R2.3 even proposed drafts are protected when manually locked',()=>{
  let state=generic();state=decideRequirement(state,core(state).id,'proposed','수동 초안');
  state=reply(answerQuestion(state,{optionId:'record',disposition:'answered',text:'record'}));
  assert.equal(core(state).text,'수동 초안');assert.equal(core(state).locked,true);assert.equal(core(state).needsReview,true);
});
test('R2.4 simulated DeepSeek uses matching prompt, validated JSON and same draft policy (NOT live AI)',async()=>{
  const answered=answerQuestion(generic(),input('가게 정보를 저장하고 다시 검색한다.'));
  const b=beginRequest(answered); const prompt=systemPrompt(b.request);
  assert.match(prompt,/proposed AND unlocked/);assert.match(prompt,/SAME stable proposal key/);
  assert.match(prompt,/sourceIds including the new answer/);assert.match(prompt,/confirmed, locked, deferred or rejected/);
  const result=await callDeepSeek(b.request,config(),{fetchImpl:async(_url,opts)=>{
    assert.match(JSON.parse(opts.body).messages[0].content,/proposed AND unlocked/);
    return upstream(mockInterview(b.request));
  }});
  const state=applyResponse(b.state,b.request,{mode:'deepseek',result});
  assert.match(core(state).text,/저장하고 다시 검색/);assert.equal(core(state).status,'proposed');
  assert.equal(core(state).origin,'ai');assert.ok(core(state).sourceIds.includes(answered.answers[0].sourceId));
});
test('R2.5 same key with a different topic/kind is a review conflict, not a silent replacement',()=>{
  const first=generic();const b=beginRequest(first);const result=mockInterview(b.request);
  result.proposals[0].topic='audience';result.proposals[0].text='다른 의도의 요구';
  const next=applyResponse(b.state,b.request,{mode:'mock',result});
  assert.equal(core(next).topic,core(first).topic);assert.equal(core(next).text,core(first).text);
  assert.equal(core(next).needsReview,true);
});
for(const size of [788,789,790,799,800,801,1000,1499,1500]) test(`R3.1 ${size} Korean chars retain full answer and valid next request`,()=>{
  const raw='가'.repeat(size);const saved=answerQuestion(questionState(),input(raw));
  assert.equal(saved.answers[0].text,raw);
  const source=saved.sources.find(s=>s.id===saved.answers[0].sourceId);
  assert.ok(source.text.endsWith('\n'+raw));
  const storage=saved.requirements.find(r=>r.topic==='storage');
  assert.ok(storage.text.length<=REQUIREMENT_MAX_LENGTH);
  if(size+11>REQUIREMENT_MAX_LENGTH) assert.match(storage.text,/전체 보존.*아직 요약/);
  const b=beginRequest(saved); assert.doesNotThrow(()=>validateRequest(b.request));
  assert.ok(Buffer.byteLength(JSON.stringify(b.request),'utf8')<32768);
  const result=mockInterview(b.request);assert.doesNotThrow(()=>validateResult(result,b.request));
  assert.equal(applyResponse(b.state,b.request,{mode:'mock',result}).answers[0].text,raw);
});
test('R3.2 1501 chars rejected atomically; leading/trailing whitespace in accepted raw is preserved',()=>{
  const state=questionState(),before=structuredClone(state);
  assert.throws(()=>answerQuestion(state,input('가'.repeat(ANSWER_MAX_LENGTH+1))),/INVALID_ANSWER/);
  assert.deepEqual(state,before);
  const raw='  원문\n보존  ';assert.equal(answerQuestion(state,input(raw)).answers[0].text,raw);
});
test('R3.3 failed response -> edit saved answer -> successful retry; preserve prior source and answer ID',()=>{
  const raw='가'.repeat(1500);const first=answerQuestion(questionState(),input(raw));
  const b=beginRequest(first);const failed=applyResponse(b.state,b.request,{mode:'mock',result:{}});
  assert.equal(failed.error,'INVALID_RESPONSE');
  const edited=reviseAnswer(failed,input('회사 안에서 공유하고 집에서는 오프라인으로 본다.'));
  assert.equal(edited.answers.length,1);assert.equal(edited.answers[0].id,first.answers[0].id);
  assert.notEqual(edited.answers[0].sourceId,first.answers[0].sourceId);
  assert.equal(edited.sources.find(s=>s.id===first.answers[0].sourceId).text,first.sources.find(s=>s.id===first.answers[0].sourceId).text);
  const next=reply(edited); assert.equal(next.phase,'summary');assert.equal(next.error,null);
  assert.match(next.requirements.find(r=>r.topic==='storage').text,/오프라인/);
  assert.strictEqual(applyResponse(edited,b.request,{mode:'mock',result:mockInterview(b.request)}),edited);
  assert.strictEqual(failRequest(edited,b.request,'AI_TIMEOUT'),edited);
});
test('R3.4 invalid answer revision does not destroy last valid answer or sources',()=>{
  const state=answerQuestion(questionState(),input('가'.repeat(1500)));const before=structuredClone(state);
  assert.throws(()=>reviseAnswer(state,input('가'.repeat(1501))),/INVALID_ANSWER/);assert.deepEqual(state,before);
});
test('R3.5 generic long answer remains bounded, sourced, proposed; does not fabricate a mock interpretation',()=>{
  const answered=answerQuestion(generic(),input('나'.repeat(1500)));const next=reply(answered);
  assert.ok(core(next).text.length<=800);assert.match(core(next).text,/임의로 축약하지/);
  assert.ok(core(next).sourceIds.includes(answered.answers[0].sourceId));
  assert.equal(core(next).status,'proposed');assert.equal(next.answers[0].text.length,1500);
});
async function server(t) {
  const app=createApp({config:config({mode:'mock',rate:60,cap:100})});
  await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{app.close(resolve);app.closeAllConnections();}));
  const url=`http://127.0.0.1:${app.address().port}`;
  const post=body=>fetch(url+'/api/interview',{method:'POST',headers:{Origin:url,'Content-Type':'application/json','X-AgentFlow-Request':'1'},body});
  return {url,post};
}
test('R3.6 real HTTP receives 1500 Korean chars; 32KiB UTF-8 byte limit accepted at boundary, rejected above',async t=>{
  const s=await server(t);
  const b=beginRequest(answerQuestion(questionState(),input('한'.repeat(1500))));
  const body=JSON.stringify(b.request);const bytes=Buffer.byteLength(body,'utf8');
  assert.ok(bytes>body.length);assert.ok(bytes<32768);
  const res=await s.post(body+' '.repeat(32768-bytes));assert.equal(res.status,200);
  const state=applyResponse(b.state,b.request,await res.json());assert.equal(state.answers[0].text,'한'.repeat(1500));
  const bigger=await s.post(body+' '.repeat(32769-bytes));assert.equal(bigger.status,413);
  assert.equal((await bigger.json()).error.code,'INPUT_TOO_LARGE');
});
for(const [flavor,paths,root] of [['posix',posix,'/srv/studio/dist/public/'],['win32',win32,'C:\\studio\\dist\\public\\'],['win32-UNC',win32,'\\\\host\\share\\studio\\dist\\public\\']]) {
  test(`R4.1 ${flavor}: exact path implementation accepts HTML/CSS/JS, including trailing separator`,()=>{
    for(const resource of ['/','/index.html','/styles.css','/client/app.js','/shared/project.js']) {
      const expected=paths.resolve(root,resource==='/'?'index.html':resource.slice(1));
      assert.equal(resolvePublicFile(root,resource,paths),expected);
      assert.equal(isWithinRoot(root,expected,paths),true);
    }
  });
  test(`R4.2 ${flavor}: rejects traversal, sibling prefix, drive/UNC, dotfiles, server sources and double encoding`,()=>{
    for(const resource of ['/../server/app.mjs','/client/../../server/app.mjs','/..%2f..%2fserver%2fconfig.mjs','/..%5cserver%5cconfig.mjs',
      '/%2e%2e/server/app.mjs','/%252e%252e/server/app.mjs','/server/app.mjs','/.env','/.env.js','/client/.env.js','/package.json',
      '/C:/server/app.js','//host/share/app.js','/client/app.js%00','/client/app.js:secret','/%zz']) {
      assert.throws(()=>resolvePublicFile(root,resource,paths),{code:'NOT_FOUND'});
    }
    assert.equal(isWithinRoot(root,paths.resolve(root,'../public-other/client/app.js'),paths),false);
    assert.equal(isWithinRoot(root,paths.resolve(root),paths),false);
    if(flavor.startsWith('win32')) assert.equal(isWithinRoot(root,'D:\\private\\app.js',paths),false);
  });
}
test('R4.3 real HTTP GET and HEAD assets work, raw traversal and sensitive resources do not',async t=>{
  const s=await server(t);
  for(const [resource,type] of [['/','text/html'],['/styles.css','text/css'],['/client/app.js','text/javascript'],['/shared/project.js','text/javascript']]) {
    const get=await fetch(s.url+resource);assert.equal(get.status,200);assert.match(get.headers.get('content-type'),new RegExp(type));
    const bytes=Buffer.byteLength(await get.text());assert.ok(bytes>0);
    const head=await fetch(s.url+resource,{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
    assert.equal(Number(head.headers.get('content-length')),bytes);
  }
  for(const resource of ['/../server/app.mjs','/..%2fserver/app.mjs','/server/config.mjs','/.env','/client/.secret.js']) {
    // Node HTTP preserves the raw path; fetch/URL normalization can remove ../.
    const status=await new Promise((resolve,reject)=>{
      const req=http.get(s.url,{path:resource},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);
    });
    assert.equal(status,404);
  }
});
test('R4.4 symlink from public JS family cannot leak outside public root',async t=>{
  const dir=await mkdtemp(path.join(tmpdir(),'agentflow-static-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const pub=path.join(dir,'public');await mkdir(path.join(pub,'client'),{recursive:true});
  await mkdir(path.join(dir,'private'));await writeFile(path.join(dir,'private','secret.js'),'NOT_PUBLIC');
  // Directory junctions need no Windows symlink privilege. Also valid on POSIX.
  await symlink(path.join(dir,'private'),path.join(pub,'client','escape'),'junction');
  await assert.rejects(readPublicFile(pub,'/client/escape/secret.js'),{code:'NOT_FOUND'});
});
