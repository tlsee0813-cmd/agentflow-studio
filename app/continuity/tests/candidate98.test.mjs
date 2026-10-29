// AF98: known-unfixed instruction/receiver mismatch. Synthetic replies test the contract, not model quality.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import { studioView } from '../dist/public/shared/studio.js';
import { MAP6_FIRST_PROMPT, MAP6_PROMPT, MAP5_FIRST_PROMPT } from '../server/map-prompt.mjs';
import { createStudioHandler, mapPromptId } from '../server/studio.mjs';

const p = D.pasteRecord(D.createProject(), 'Alpha는 입력을 읽는다.\n\nBeta는 결과를 보관한다.\n\n보정 작업을 정리했다.', null).project;
const input = M.buildMapAsk(p, studioView(p), [], undefined, M.MAP6_SCHEMA);
const spans = input.ask.records[0].spans;
const at = words => spans.find(s => s.t.includes(words)).s;
const part = name => ({ref:'new:'+name.toLowerCase(),name,parent:null,role:name+'의 역할',roleAbout:null,roleReplaces:null,basis:[at(name)],claims:[]});
function wire(target) {
  return {summary:'',parts:[part('Alpha'),part('Beta')],relations:[],gaps:[],matches:[],material:[],candidates:[{
    text:'보정 대상의 '+target+' 경계가 미정입니다.',target,parts:target==='holds'?['new:alpha']:['new:alpha','new:beta'],at:null,
    statement:['holds','attribution'].includes(target)?{key:'s1',kind:'reported',text:'보정 작업을 정리했다.',at:at('보정'),about:null}:null
  }]};
}

test('98 effective first/later instructions declare the complete candidate shape; prompt identity changes', async () => {
  const valid = wire('attribution');
  for (const prompt of [MAP6_FIRST_PROMPT, MAP6_PROMPT]) {
    const match = prompt.match(/후보 객체의 키는 정확히 (\{[^}]+\})/);
    assert.ok(match, 'candidate-level shape must be stated even when the final example is []');
    const keys = JSON.parse('['+match[1].slice(1,-1)+']');
    assert.deepEqual(keys.sort(), Object.keys(valid.candidates[0]).sort());
    assert.ok(prompt.includes('statement.text는 미정인 진술의 내용이며 후보의 text를 대신하지 않는다'));
  }
  assert.ok(!MAP5_FIRST_PROMPT.includes('후보 객체의 키는 정확히'), 'legacy prompt stays unchanged');
  assert.notEqual(createHash('sha256').update(MAP6_FIRST_PROMPT).digest('hex'),'81d6e96834d7c245270785dafe2861bcc010779f12ec14f6b9472b378a8ff846');
  assert.notEqual(await mapPromptId(),'m6-33ff86d5f2da');
});

for (const target of ['attribution','holds','identity','parent']) test('98 receiver preserves independent question text for '+target+' and rejects its omission', async () => {
  const original = JSON.stringify(input.ask), valid = wire(target), requestBodies=[];
  const variants = [valid,...[undefined,null,'', '   ','😀'.repeat(121)].map(value=>{
    const r=structuredClone(valid); if(value===undefined)delete r.candidates[0].text; else r.candidates[0].text=value; return r;
  })];
  for (const [index,r] of variants.entries()) {
    const handle=createStudioHandler({env:{DEEPSEEK_API_KEY:'test-98-not-real'},fetchImpl:async(_url,init)=>{
      requestBodies.push(JSON.parse(init.body));
      return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(r)}}]}));
    }});
    const response=await handle(new Request('https://studio.example/api/studio/map',{method:'POST',headers:{'content-type':'application/json','x-agentflow-request':'1'},body:original}));
    const body=await response.json();
    assert.equal(response.status,index===0?200:502);
    if(index===0){assert.equal(body.reply.candidates[0].text,valid.candidates[0].text);}
    else assert.equal(body.error.code,'INVALID_RESPONSE');
  }
  assert.equal(JSON.stringify(input.ask),original,'no input repair');
  assert.ok(requestBodies.every(b=>b.messages[0].content===MAP6_FIRST_PROMPT),'actual handler selects corrected FIRST');
  const edge=wire(target);edge.candidates[0].text='😀'.repeat(120);assert.doesNotThrow(()=>M.validateMapReply(edge,input.ask));
});
