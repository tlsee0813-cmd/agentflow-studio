import * as D from '../product12-candidate-v0/app/continuity/dist/public/shared/domain.js';
import {parseProject} from '../product12-candidate-v0/app/continuity/dist/public/shared/validation.js';
import {writeFileSync} from 'node:fs';
let p=D.createProject();p=D.addArea(p,'독립 경계 영역',('소개글의 내용과 게시 담당자 확인을 보존합니다.\n').repeat(100).slice(0,2000));let area=p.space.areas[0].id;
p=D.submit(D.editDraft(p,'A 소개글 한 편의 공개 여부는 담당자가 선택합니다.'),undefined,area);let A=p.currentTaskId;
p=D.editTask(p,A,'understanding','이해 앞부분. '.repeat(50)+'이해끝조건_U_END_보존');p=D.editTask(p,A,'scope','범위 앞부분. '.repeat(50)+'범위끝조건_S_END_게시선택');
p=D.submit(D.editDraft(D.setKind(p,'report'),'R: A의 직접 보고이며 외부 실행 여부는 미확인입니다.'));let R=p.currentTaskId;
p=D.editTask(p,R,'understanding','R만의 이해');p=D.editTask(p,R,'scope','R만의 범위');p=D.setKind(p,'request');p=D.editDraft(p,'미전송 초안 보존');
parseProject(JSON.stringify(p));writeFileSync(new URL('fixture.json',import.meta.url),JSON.stringify(p,null,2));writeFileSync(new URL('ids.json',import.meta.url),JSON.stringify({A,R,area}));
