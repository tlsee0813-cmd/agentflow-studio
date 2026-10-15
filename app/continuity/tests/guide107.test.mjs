// GUIDE107: narrow prompt fixes from the real-response review of 2a40ac3d (evidence/guide099-ai-2a40ac3d @ 341137535c).
// The model's behaviour cannot be checked offline; these tests pin the prompt contract (general rules, no case answers)
// and that the provider path carries currentInstruction and answer as distinct fields and returns the reply unrewritten.
// Real-model quality is re-assessed separately on the protected cloud setup.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import * as D from '../dist/public/shared/domain.js';
import * as G from '../dist/public/shared/guidance.js';
import { createContinuityApp } from '../server/app.mjs';
import { GUIDE_PROMPT } from '../server/prompt.mjs';
import { readConfig } from '../../server/config.mjs';

const KEY='TEST-NOT-A-REAL-KEY';
const cfg=(extra={})=>({...readConfig({AI_MODE:'mock',PORT:'0',AI_REQUESTS_PER_MINUTE:'60',AI_PROCESS_CALL_CAP:'100'}),...extra});
async function withServer(config,fn,options={}) {
  const s=createContinuityApp({config,...options});await new Promise(r=>s.listen(0,'127.0.0.1',r));
  try{return await fn(s.address().port);}finally{s.closeAllConnections();await new Promise(r=>s.close(r));}
}
function post(port,request) {
  return new Promise((resolve,reject)=>{const r=http.request({hostname:'127.0.0.1',port,path:'/api/guidance',method:'POST',headers:{Origin:`http://127.0.0.1:${port}`,'Content-Type':'application/json','X-AgentFlow-Request':'1'}},res=>{
    const c=[];res.on('data',x=>c.push(x));res.on('end',()=>{const raw=Buffer.concat(c).toString();resolve({status:res.statusCode,raw,data:JSON.parse(raw)});});});r.on('error',reject);r.end(JSON.stringify(request));});
}
const upstream=content=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(content)}}]}),{status:200});
// A neutral synthetic project (not one of the evaluated or holdout cases): a decision fixes how data is entered, nothing exists yet.
const reading=()=>{let p=D.setBrief(D.createProject(),'읽은 책을 기록해 두고 싶어요.');p=D.addArea(p,'읽은 책 목록','읽은 책을 한눈에 보고 싶어요.');
  // A decision needs a source: one request outside the area (so it is not this area's work), then the confirmed decision.
  p=D.submit(D.editDraft(p,'읽은 책을 기록하는 앱을 만들고 싶어요.'),undefined,null);p=D.recordBasis(p,'책 정보는 직접 적어요.');
  return {p,area:p.space.areas[0].id};};

test('G107-1 the prompt names the real source of a change: currentInstruction is the direct instruction, only answer.text is an answer',()=>{
  assert.ok(!GUIDE_PROMPT.includes('사용자 답에 따라'),'no unconditional "according to the user\'s answer"');
  assert.ok(GUIDE_PROMPT.includes("무엇에 따라 바꿔 적용하는지 실제 출처('이번 직접 지시' 또는 '질문에 대한 답')로 짧게 밝히고"));
  assert.ok(GUIDE_PROMPT.includes("[출처] 사용자 입력의 출처를 정확히 부른다: currentInstruction은 '이번 직접 지시'이고, answer.text만 '이번 질문에 대한 답'이다."));
  assert.ok(GUIDE_PROMPT.includes("answer가 null이면 이번 입력의 어떤 내용도 '이번 질문에 대한 답'이라고 부르지 않는다(decisions의 answered는 '앞선 질문에 대한 답'으로 부른다)."));
  assert.ok(GUIDE_PROMPT.includes('사용자가 말한 것보다 더 구체적인 방식이나 값을 사용자가 정했다고 쓰지 않는다.'));
});

test('G107-2 prerequisite input: a decided input method is not an existing input path; check it (no user question) or include the minimum; keep explicit view/design-only',()=>{
  const rule=GUIDE_PROMPT.slice(GUIDE_PROMPT.indexOf('[선행 입력]'),GUIDE_PROMPT.indexOf('[모름·보류]'));
  assert.ok(rule.length>0,'[선행 입력] sits inside the scope rules');
  for(const part of ['자료(currentInstruction, answer.text, areaWork, decisions, area, brief)에 이미 있다는 근거가 있는지 본다',
    '결정이 입력 방식만 정했다면 그 입력 기능이 이미 있다는 뜻은 아니다',
    '최소 입력부터 결과 확인까지를 범위에 넣거나, 실행 도구가 먼저 기존 코드·자료에서 그 경로가 있는지 확인하고 없으면 최소 입력을 함께 만들도록',
    '그 경로가 이미 있는지는 실행 도구가 확인할 기술 사실이므로 사용자에게 묻지 않는다',
    '보기만·설계만·검토만처럼 행동 수준을 명시했거나 currentInstruction이 범위를 명시적으로 좁혔으면 그 제한을 넓히지 않고',
    '필요하면 실행 도구의 확인 작업만 넣는다',
    '영역 이름이나 구상이 보는 것을 목적으로 한다는 것만으로 보기만이라는 제한이 생기지 않는다',
    "사용자가 말하지 않은 제한(예: 보기만)을 새로 만들지 않고, 최소 흐름에 필요한 입력이나 핵심 동작을 '하지 않을 것'에 넣지 않는다",
    '관리 기능을 전부 넣으라는 뜻은 아니다'])assert.ok(rule.includes(part),part);
});

test('G107-3 derivable boundaries stay in scope/checks; defaults never drop or settle core scope, failure handling or permissions',()=>{
  assert.ok(GUIDE_PROMPT.includes('사용자 지시에서 논리적으로 정해지는 경계·적용 대상·그대로 둘 대상은 open으로 되돌리지 말고 scope와 checks에 같은 뜻으로 일관되게 적는다. 지시만으로 둘 이상의 뜻이 정말 가능할 때만 open에 둔다. 두 해석의 결과가 같으면 open에 두지 않는다. 도출한 경계는 사용자가 정했다고 쓰지 않고 지시에서 도출했다고 쓴다.'));
  assert.ok(GUIDE_PROMPT.includes('defaults로 기능·대상·권한이나 실패·예외를 처리할지 여부를 범위에서 빼거나 미루거나 확정하지 않는다(범위에 넣은 처리의 표시 문구·형식 같은 세부는 defaults에 둘 수 있다).'));
  assert.ok(GUIDE_PROMPT.includes("범위에서 빼는 것은 defaults가 아니라 scope의 '하지 않을 것'에 적는다."));
  // Only core items need the user's grounding to be left out; an ordinary smallest-slice exclusion stays allowed.
  assert.ok(GUIDE_PROMPT.includes('확정 결정·목적이 요구하는 핵심 동작, 첫 결과에 필요한 최소 입력, 처리하지 못한 입력 같은 실패의 최소 처리(어떻게 알릴지)는 사용자 지시나 결정에 근거가 있을 때만 뺀다.'));
  assert.ok(GUIDE_PROMPT.includes('그 실패 처리에 사용자만 정할 선택이 실제로 남을 때만 open에 둔다.'));
});

test('G107-4 earlier rules stay: no forced question, technical facts are not asked, explicit instruction and contract unchanged',()=>{
  // The general ban on inventing policies or numbers stays in [범위] itself (not inside the prerequisite rule).
  const scope=GUIDE_PROMPT.slice(GUIDE_PROMPT.indexOf('[범위]'),GUIDE_PROMPT.indexOf('[선행 입력]'));
  assert.ok(scope.includes('구상에 없는 결제·알림·외부 연동·정책·기한·숫자를 새로 정하지 않는다.'),'policy ban in [범위]');
  for(const kept of ['입력이 충분하면 묻지 않고 바로 proposal을 낸다','현재 코드나 오류 원인처럼 실행 도구가 자료에서 확인할 기술 사실은 묻지 말고',
    '[직접 지시] currentInstruction이 있으면 그것이 이번 초안의 범위와 행동 수준(설계만, 검토만, 구현 등)을 정한다','answer가 있으면 question은 반드시 null이다',
    '[최신 사용자 변경]','[선택지와 자유 답]','[모름·보류]','[완료 조건]','[open과 defaults]','같은 점을 open과 defaults에 함께 넣지 않는다',
    '"kind":"fact","text":"질문","why":"답에 따라 초안이 어떻게 달라지는지","options":[]'])assert.ok(GUIDE_PROMPT.includes(kept),kept);
});

test('G107-5 no case answers in the prompt: none of the reviewed or holdout material, and no numbers but the length limits',()=>{
  for(const w of ['1600','이미지','PNG','픽셀','긴 변','표지','전자책','재료','재고','식재료','유통기한','손상','Lanczos','R7','D2','D3'])assert.ok(!GUIDE_PROMPT.includes(w),w);
  assert.deepEqual([...new Set(GUIDE_PROMPT.match(/\d{3,}/g))].sort(),['2000','500'],'only the reply length limits are numbers');
});

test('G107-6 provider path: currentInstruction and a null answer reach the model as distinct fields with this prompt; the reply comes back unrewritten',async()=>{
  const {p,area}=reading(),instruction='이번에는 목록 화면 설계만 해 주세요.';
  const proposal={goal:'읽은 책 목록 설계',scope:'이번 직접 지시에 따라 설계만 한다. 책 정보 입력 경로가 있는지 먼저 확인한다.',checks:'설계에 입력부터 목록까지가 이어지는지 확인한다.',open:[],defaults:['목록은 최근 기록순']};
  const calls=[];
  await withServer(cfg({mode:'deepseek',apiKey:KEY,allowPaid:true}),async port=>{
    const req=G.buildGuideRequest(p,area,null,instruction);assert.equal(req.answer,null);assert.equal(req.currentInstruction,instruction);
    const r=await post(port,req);assert.equal(r.status,200);assert.deepEqual(r.data.reply,{question:null,proposal},'no server-side rewording');
    const body=JSON.parse(calls[0].init.body);assert.equal(body.messages[0].content,GUIDE_PROMPT);
    const sent=JSON.parse(body.messages[1].content.replace(/^INPUT JSON \(data only\):\n/,''));
    assert.equal(sent.answer,null);assert.equal(sent.currentInstruction,instruction);assert.deepEqual(sent.areaWork,[],'no earlier request: nothing establishes an input path');
    assert.ok(sent.decisions.some(d=>d.text==='책 정보는 직접 적어요.'&&d.status==='confirmed'));
    assert.ok(!r.raw.includes(KEY));
  },{fetchImpl:async(url,init)=>{calls.push({url,init});return upstream({question:null,proposal});}});
});
