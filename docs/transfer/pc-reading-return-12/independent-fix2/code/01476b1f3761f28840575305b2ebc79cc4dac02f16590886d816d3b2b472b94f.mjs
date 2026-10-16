import * as D from '../../product12-candidate-fix2/app/continuity/dist/public/shared/domain.js';
import {parseProject} from '../../product12-candidate-fix2/app/continuity/dist/public/shared/validation.js';
import {mockAdvice} from '../../product12-candidate-fix2/app/continuity/server/mock.mjs';
import {writeFileSync} from 'node:fs';
const save=(name,p,ids)=>{parseProject(JSON.stringify(p));writeFileSync(new URL(name+'.json',import.meta.url),JSON.stringify(p,null,2));writeFileSync(new URL(name+'-ids.json',import.meta.url),JSON.stringify(ids));};
let p=D.createProject();p=D.setBrief(p,'공개 전에 담당자가 판단하도록 소개글 한 편의 확인 작업만 정리한다. 실제 운영 배포는 하지 않는다.');
p=D.addArea(p,'소개글 영역','소개글 확인: 입력을 다시 옮기는 일을 줄인다. 게시 여부는 담당자가 선택한다. '.repeat(8));const area=p.space.areas.at(-1).id;
p=D.addArea(p,'별도 알림 영역','알림은 이번 소개글 확인과 다른 범위이다.');const other=p.space.areas.at(-1).id;
p=D.addArea(p,'빈 구상 영역','');const empty=p.space.areas.at(-1).id;
const req=(text,id)=>{p=D.submit(D.editDraft(D.setKind(p,'request'),text),undefined,id);return p.currentTaskId;};
const rep=text=>{p=D.submit(D.editDraft(D.setKind(p,'report'),text));return p.currentTaskId;};
const A=req('A: 소개글 한 편을 확인한다. 공개 여부는 담당자가 선택하며 운영 배포는 하지 않는다. '+'요청 원문의 조건을 보존합니다. '.repeat(55)+'A_원문끝',area),R=rep('R: A에 대한 직접 보고. 외부 실행 성공은 미확인. '+'보고의 원문을 유지한다. '.repeat(70)+'R_보고끝');
const B=req('B: 다른 요청의 알림 제목만 정리한다.',other),RB=rep('RB: B에 대한 보고이며 A와 별개이다.');
for(const id of [A,R,B,RB])for(const key of ['understanding','scope','next','checks'])p=D.editTask(p,id,key,`${id===A?'A':id===R?'R':id===B?'B':'RB'} 초기 ${key}: 다른 대상에 섞지 않는다.`);
p=D.setDraftTarget(p,other);p=D.editDraft(D.setKind(p,'report'),'아직 보내지 않은 보고 초안. 연결 대상은 B이다.');let ids={area,other,empty,A,R,B,RB};save('direct',D.focusTask(p,R),ids);save('other',D.focusTask(p,RB),ids);
// Synthetic boundaries: public domain operations + explicit imported representation for absent old snapshot.
let q=D.focusTask(p,A);let started=D.begin(q);q=D.receive(started.project,started.request,{mode:'mock',ticket:started.request.ticket,advice:mockAdvice(started.request)});q=D.recordBasis(q,'추가 확인: 게시 여부는 담당자만 선택한다.');q=D.editTask(q,A,'understanding','');q.tasks.find(t=>t.id===A).manual.scope=null; q.tasks.find(t=>t.id===A).background=null; // explicit offline synthetic import, not app-state mutation
q=D.editArea(q,other,'별도 알림 영역','요청 당시와 달라진 현재 알림 구상');save('boundary',q,ids);

