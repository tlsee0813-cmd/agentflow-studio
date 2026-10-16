// HOME15: isolated synthetic workspaces for the project home (never user data). Built with the app's own domain code.
// Usage (from app/): node continuity/tests/home15-fixtures.mjs <out-dir>
import { writeFileSync, mkdirSync } from 'node:fs';
import { createProject, rename, setBrief, addArea, editDraft, submit, editTask } from '../dist/public/shared/domain.js';
import { parseProject } from '../dist/public/shared/validation.js';
const out=process.argv[2];if(!out)throw new Error('out dir required');mkdirSync(out,{recursive:true});
let n=0;const id=()=>`E_home15-${String(++n).padStart(4,'0')}`;
/** Fixed times so the order and the label on each card are reproducible. */
function at(p,iso){
  for(const s of p.sources)s.at=iso;for(const t of p.tasks)for(const h of t.handoffs)h.at=iso;
  if(p.space.brief)p.space.brief.at=iso;for(const a of p.space.areas)a.createdAt=iso;return p;
}
function build({name,brief,areas=[],request,manual,draft,when}) {
  let p=rename(createProject(),name);
  if(brief)p=setBrief(p,brief);
  for(const a of areas)p=addArea(p,a);
  if(request){p=submit(editDraft(p,request),undefined,p.space.areas[0]?.id??null);if(manual)p=editTask(p,p.currentTaskId,'next',manual);}
  if(draft)p=editDraft(p,draft);
  p=at(structuredClone(p),when);parseProject(JSON.stringify(p));return p;
}
const entry=(project,state='active')=>({entryId:id(),state,lifecycle:state==='trashed'?2:1,seq:1,createdAt:'2026-10-01T00:00:00.000Z',trashedAt:state==='trashed'?'2026-10-15T00:00:00.000Z':null,origin:'new',project});
const env=entries=>JSON.stringify({version:'agentflow.workspace.1',migratedFromLegacy:true,entries});
const A=()=>build({name:'동네 미용실 예약',brief:'손님이 휴대폰으로 날짜와 시간을 골라 예약하고, 예약하면 문자로 확인을 받는 서비스',areas:['예약','알림'],
  request:'예약 확정 문구를 ‘예약 완료’로 바꿔줘',manual:'A 수동 문장: 확정 문구만 바꾸고 예약 흐름은 그대로 둔다',draft:'A 미전송 초안: 취소 안내 문구도 볼 것',when:'2026-10-16T05:20:00.000Z'});
const B=()=>build({name:'독서 모임 일정 도우미',brief:'매달 모임 날짜를 투표로 정하고 참석자에게 알림을 보내는 웹앱',areas:['일정 투표'],
  request:'투표 마감 시간을 모임장이 정할 수 있게 해줘',manual:'B 수동 문장: 마감 시간은 모임장만 바꾼다',draft:'B 미전송 초안: 마감 알림 시각',when:'2026-10-15T09:05:00.000Z'});
const C=()=>build({name:'지역 소상공인 공동 배달 주문·정산·리뷰 관리를 한 화면에서 처리하는 통합 운영 대시보드 구축 프로젝트',
  brief:'동네 가게 여러 곳이 함께 쓰는 배달 주문 접수, 기사 배정, 주간 정산, 손님 리뷰 답변을 한 곳에서 처리하려고 한다. 가게 주인은 휴대폰으로도 주문 상태를 보고, 정산 담당자는 주말마다 가게별 금액을 확인해 내려받는다. 리뷰는 가게마다 답변 담당이 다르다.',
  areas:['주문 접수','기사 배정','정산'],request:'정산 화면에 가게별 합계를 보여줘',when:'2026-10-14T01:40:00.000Z'});
const D=()=>build({name:'사내 문의 접수 페이지',request:'문의 접수 폼에 첨부 파일 칸을 추가해줘. 지난 요청 문장은 목적이 아니다.',when:'2026-10-12T07:30:00.000Z'});
const E=()=>build({name:'가계부 정리 도구',brief:'카드 내역 CSV를 올리면 월별 지출을 분류해서 보여주는 개인용 도구',when:'2026-10-10T03:00:00.000Z'});
const F=()=>build({name:'포트폴리오 사이트',draft:'아직 보내지 않은 첫 요청 초안',when:'2026-10-09T03:00:00.000Z'});
const write=(file,entries)=>writeFileSync(`${out}/${file}`,env(entries),'utf8');
write('home15-six.json',[A(),B(),C(),D(),E(),F()].map(p=>entry(p)));
write('home15-one.json',[entry(A())]);
write('home15-zero.json',[entry(B(),'trashed')]);
write('home15-ab.json',[entry(A()),entry(B())]);
console.log('home15 fixtures written');
