import { createProject, editBrief, beginRequest, applyResponse, answerQuestion } from '../dist/public/shared/project.js';
import { mockInterview } from '../server/providers/mock.mjs';
import { readConfig } from '../server/config.mjs';
export function initial(idea = '나만 쓸 개인 할 일 서비스를 만들고 싶다. 등록과 완료 표시가 필요하다.') {
  const state = editBrief(createProject(), {idea,tools:'codex-only',constraints:''});
  return beginRequest(state);
}
export function questionState() {
  const {state,request} = initial();
  return applyResponse(state,request,{mode:'mock',result:mockInterview(request)});
}
export function branch(optionId = 'browser', disposition = 'answered', text = '사용자 답변') {
  const answered = answerQuestion(questionState(),{optionId,disposition,text});
  const {state,request} = beginRequest(answered);
  return {state,request,result:mockInterview(request)};
}
export function config(overrides = {}) {
  // Deliberately non-secret placeholder, never a real credential. Only injected fetch tests use it.
  return { ...readConfig({AI_MODE:'deepseek',PORT:'0'}), apiKey:'test-placeholder-not-a-key',allowPaid:true,...overrides };
}
export function upstream(result, options = {}) {
  return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(result)}}]}),{
    status:200,headers:{'Content-Type':'application/json'},...options
  });
}
