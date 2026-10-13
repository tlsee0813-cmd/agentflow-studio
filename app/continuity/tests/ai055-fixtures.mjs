// Hand-authored semantic fixture ONLY, not product mock intelligence or model-quality evidence.
import {mockAdvice} from '../dist/public/shared/mock.js';
import {cases} from './ai055-cases.mjs';
export function fixtureAdvice(req) {
 const base=mockAdvice(req),text=req.sources.filter(s=>s.taskId===req.ticket.taskId).at(-1)?.text;
 const index=cases[0].turns.indexOf(text);
 if(index<0)return base;
 const intent={version:'intent.1',relation:index===0?'start':index===1?'revise':'continue',
  goal:index===0?'가입한 고객이 예약을 취소한다.':'문자로 받은 링크로 가입 없이 예약을 취소한다.',
  conditions:index===0?[]:['환불은 이번 범위에서 제외한다.'],retired:index===0?[]:['예약 취소에 회원가입 필수'],
  basisRefs:req.bases.filter(b=>!b.partial).map(b=>({basisId:b.id,sourceId:b.sourceId,revision:b.revision}))};
 return {...base,intent,understanding:index<2?intent.goal:text,scope:intent.conditions.join(' / ')||'예약 취소 요청 범위',next:index===2?'취소 버튼 색만 빨간색으로 수정하고 확인한다.':index===3?'오타만 수정하고 확인한다.':'요청 범위를 코드에서 확인하고 최소 수정·검증한다.',checks:'이번 요청과 유지 조건을 확인한다.',question:null};
}

// Existing localhost app with a labelled synthetic provider; no alternate production route.
import {pathToFileURL} from 'node:url';
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
 const {createContinuityApp}=await import('../server/app.mjs');
 const {readConfig}=await import('../../server/config.mjs');
 const config=readConfig({AI_MODE:'mock',ALLOW_PAID_AI:'false',PORT:'0',AI_REQUESTS_PER_MINUTE:'60',AI_PROCESS_CALL_CAP:'100'});
 const server=createContinuityApp({config,mockImpl:fixtureAdvice,fetchImpl:()=>{throw new Error('External access forbidden in synthetic fixture');}});
 server.listen(0,'127.0.0.1',()=>console.log(`AI055 SYNTHETIC MOCK http://127.0.0.1:${server.address().port}`));
}
