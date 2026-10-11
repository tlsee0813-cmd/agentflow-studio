// NEW synthetic fixtures, not actual DeepSeek output or reconstructed rejected raw.
import { readFileSync } from 'node:fs';
import { createProject, editBrief, beginRequest, applyResponse, answerQuestion, reviseAnswer,
  storageQuestion } from '../dist/public/shared/project.js';
export const fixtures = JSON.parse(readFileSync(new URL('../fixtures/init008/dialogue-regressions.json',import.meta.url),'utf8'));
export function syntheticResult(request, persona = 'p01') {
  const f = fixtures[persona];
  const result = { projectId:request.projectId, baseVersion:request.baseVersion, requestId:request.requestId,
    summary:f.firstSummary, question:null, proposals:[], ideas:[], openItems:[] };
  if (request.stage === 'discover') {
    result.question = persona === 'p03' ? storageQuestion('Q-reading-storage') : {
      id:'Q-reading-core', topic:'core-scene', text:'어떤 일을 가장 먼저 할 수 있으면 좋을까요?',
      reason:'먼저 만들 작은 흐름을 정하려고 물어요.',example:'예: 떠오른 생각을 적고 나중에 다시 읽기.',
      options:[{id:'record',label:'적고 다시 보기',consequence:'기록과 목록 확인을 첫 초안으로 제안합니다.'},
        {id:'organize',label:'주제별로 모아 보기',consequence:'주제 구분이 필요한지 살펴봅니다.'}],recommendation:null };
  } else {
    result.summary = persona === 'p03' ? f.misleadingSummary : f.followupSummary;
    const input = request.sources.find(s => s.kind === 'customer-input');
    const current = request.answers.at(-1);
    result.proposals = [{key:'reading-core',topic:'core-scene',kind:'functional',text:f.text,acceptance:f.acceptance,
      sourceIds:persona === 'p01' ? [input.id,current.sourceId] : [input.id]}];
    result.openItems = ['데이터 보관 범위와 실패 처리 기준은 아직 정하지 않았습니다.'];
  }
  return result;
}
export function firstState(persona='p01') {
  const first = beginRequest(editBrief(createProject(),fixtures[persona].brief));
  return applyResponse(first.state,first.request,{mode:'deepseek',result:syntheticResult(first.request,persona)});
}
export function followup(persona='p01') {
  let state = firstState(persona);
  if (persona === 'p03') {
    state = answerQuestion(state,{optionId:null,disposition:'unknown',text:fixtures.p03.unknown});
    state = reviseAnswer(state,{optionId:null,disposition:'deferred',text:fixtures.p03.deferred});
  } else state = answerQuestion(state,{optionId:null,disposition:'answered',text:fixtures.p01.answer});
  return beginRequest(state);
}
export function healthyUpstream(result) {
  return new Response(JSON.stringify({model:'deepseek-flash',choices:[{finish_reason:'stop',message:{content:JSON.stringify(result)}}],
    usage:{prompt_tokens:1400,completion_tokens:600,total_tokens:2000,prompt_cache_hit_tokens:0,prompt_cache_miss_tokens:1400,
      completion_tokens_details:{reasoning_tokens:0}}}),{status:200,headers:{'Content-Type':'application/json'}});
}
