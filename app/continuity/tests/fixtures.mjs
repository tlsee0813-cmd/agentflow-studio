// Deterministic long-use fixtures for domain and browser checks. Mock advice only; no network.
// CLI: node continuity/tests/fixtures.mjs <outDir>  -> cycles-68.json, long-54.json, legacy-68.json
import * as D from '../dist/public/shared/domain.js';
import { mockAdvice } from '../server/mock.mjs';
import { SCHEMA } from '../dist/public/shared/types.js';
const submit=(p,text,kind='request')=>D.submit(D.editDraft(D.setKind(p,kind),text));
const respond=p=>{const s=D.begin(p);return D.receive(s.project,s.request,{mode:'mock',ticket:s.request.ticket,advice:mockAdvice(s.request)});};
export const CYCLE_REQUEST='회원 목록 화면에서 필터와 정렬을 조정하고, 기존 권한 규칙은 유지해줘. 관리자만 볼 수 있어야 하고 모바일 레이아웃도 깨지지 않게. '.repeat(3);
export const CYCLE_REPORT='변경 파일: src/members.ts, src/list.tsx. 실행한 검사: npm test 통과. 못 한 일: 모바일 실기기 확인. '.repeat(8);
export const LONG_REQUEST='회원 관리 화면 개선 요청. '.repeat(60);
/** One cycle = ~225-char request, AI/mock re-organisation, clipboard export, ~616-char pasted report.
 * Returns the exported texts too, so a faithful project.1 file (full snapshot per export) can be derived. */
export function cycles(n, {ai=true}={}) {
  let p=D.recordBasis(submit(D.createProject(),'관리자 화면 작업 시작'),'결제 화면과 권한 로직은 바꾸지 않는다.');const texts=[];
  for(let i=1;i<=n;i++){
    p=submit(p,`${CYCLE_REQUEST}${i}`); if(ai)p=respond(p);
    const text=D.handoffText(p);texts.push(text);p=D.markHandoff(p,p.currentTaskId,text,'clipboard');
    p=submit(p,`${CYCLE_REPORT}${i}`,'report');
  }
  return {project:p,texts};
}
/** n short requests through the real submit path (the reported 1001-item revisit failure). */
export function shortRequests(n) { let p=D.createProject();for(let i=1;i<=n;i++)p=submit(p,`짧은 요청 ${i}`);return p; }
/** Same shape as submit() output, built without per-step cloning so boundary sizes near 8MB are cheap to make.
 * Each task holds one request source and its 'requested' basis; ids have the app's real length. */
export function synthetic(n, text='짧은 요청') {
  const p=D.createProject(),at='2026-10-11T00:00:00.000Z',pad=i=>String(i).padStart(36,'0');
  for(let i=1;i<=n;i++){
    const t=`T_${pad(i)}`,s=`S_${pad(i)}`;
    p.tasks.push({id:t,sourceIds:[s],parentTaskId:i>1?`T_${pad(i-1)}`:null,advice:null,adviceRevision:null,mode:null,manual:{understanding:null,scope:null,next:null,checks:null},suggestions:null,handoffs:[],resultFile:null});
    p.sources.push({id:s,kind:'request',text:`${text} ${i}`,at,taskId:t,replyTo:null,disposition:'provided'});
    p.bases.push({id:`D${i}`,text:`${text} ${i}`,status:'requested',sourceId:s,revision:i,history:[]});
  }
  p.revision=n+1;p.currentTaskId=n?`T_${pad(n)}`:null;return p;
}
export function longRequests(n) { let p=D.createProject();for(let i=1;i<=n;i++)p=submit(p,`${LONG_REQUEST}${i}`);return p; }
/** Down-convert to the shipped project.1 shape: lock flag, no advice revision, full handoff text per export. */
export function toLegacy({project,texts}) {
  let k=0;const v=structuredClone(project);v.schemaVersion='idea015.project.1';delete v.space;for(const t of v.tasks)delete t.areaId; // project.1 predates the plan space
  v.bases=v.bases.map(({id,text,status,sourceId,revision,history})=>({id,text,status,sourceId,locked:true,revision,history}));
  v.tasks=v.tasks.map(({adviceRevision,resultFile,handoffs,...t})=>({...t,handoffs:handoffs.map(h=>({at:h.at,text:texts[k++],revision:h.revision,method:h.method}))}));
  if(k!==texts.length||project.schemaVersion!==SCHEMA)throw new Error('fixture mismatch');
  return v;
}
if(process.argv[1]?.endsWith('fixtures.mjs')) {
  const { writeFileSync }=await import('node:fs');const out=process.argv[2];if(!out)throw new Error('outDir required');
  const c=cycles(68);
  writeFileSync(`${out}/cycles-68.json`,JSON.stringify(c.project));
  writeFileSync(`${out}/long-54.json`,JSON.stringify(longRequests(54)));
  writeFileSync(`${out}/requests-1001.json`,JSON.stringify(shortRequests(1001)));
  writeFileSync(`${out}/legacy-68.json`,JSON.stringify(toLegacy(c),null,2)); // the old recovery file was pretty-printed
}
