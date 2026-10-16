import * as D from '../product12-candidate-fix2/app/continuity/dist/public/shared/domain.js';
import {checkItems} from '../product12-candidate-fix2/app/continuity/dist/public/shared/attention.js';
import {parseProject} from '../product12-candidate-fix2/app/continuity/dist/public/shared/validation.js';
import {mockAdvice} from '../product12-candidate-fix2/app/continuity/server/mock.mjs';
import {writeFileSync} from 'node:fs';
const variants={both:[true,true],question:[true,false],report:[false,true],zero:[false,false]};let summary={};
for(const [name,[question,report]] of Object.entries(variants)){
 let p=D.createProject();p=D.setBrief(p,'작은 공방의 소개와 예약 안내를 정리한다.');
 for(const [title,note] of [['소개','소개글 한 편을 읽고 게시 여부는 담당자가 선택한다.'],['예약','대기자 안내의 선택을 확인한다.'],['알림','운영시간 안내만 정리한다.']])p=D.addArea(p,title,note);
 const ids={areas:p.space.areas.map(a=>a.id)};
 if(question){p=D.submit(D.editDraft(p,'빈자리가 나면 대기자에게 자동으로 예약을 이어 주세요'),undefined,ids.areas[1]);let b=D.begin(p);p=D.receive(b.project,b.request,{mode:'mock',ticket:b.request.ticket,advice:mockAdvice(b.request)});ids.question=p.currentTaskId;}
 if(report){p=D.submit(D.editDraft(D.setKind(p,'request'),'소개글 한 편의 문장을 확인해 주세요.'),undefined,ids.areas[0]);ids.request=p.currentTaskId;p=D.submit(D.editDraft(D.setKind(p,'report'),'문장을 정리했다고 보고받았다. 실제 공개나 실행은 확인하지 않았다.'));ids.report=p.currentTaskId;}
 const expected={decision:question?1:0,report:report?1:0},items=checkItems(p);for(const kind of ['decision','report'])if(items.filter(x=>x.kind===kind).length!==expected[kind])throw Error('independent fixture expectation mismatch '+name+kind);
 parseProject(JSON.stringify(p));writeFileSync(new URL(name+'.json',import.meta.url),JSON.stringify(p,null,2));summary[name]={ids,expected,actualItems:items,synthetic_handoffs:0,fixture_setup:'public domain APIs + deterministic mockAdvice, not AI or real delivery'};
}
writeFileSync(new URL('fixture-check.json',import.meta.url),JSON.stringify(summary,null,2));
