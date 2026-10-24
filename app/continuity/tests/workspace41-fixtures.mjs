// WORK41: one isolated synthetic project (never user data) for the map -> part -> work -> map round trip. Built with the app's
// own domain code: a parent with two children whose long names share a prefix and differ only at the end, a relation, a request
// with an export and a long pasted report (its follow-up draft edited by hand), and an unsent request kept for another part.
// Usage (from app/): node continuity/tests/workspace41-fixtures.mjs <out-dir> [nospace]
import { writeFileSync, mkdirSync } from 'node:fs';
import { createProject, rename, setBrief, addArea, addChildArea, addRelation, editDraft, setKind, submit, editTask, begin, receive,
  taskOf, handoffText, markHandoff, setDraftTarget } from '../dist/public/shared/domain.js';
import { parseProject, validateRequest, validateAdvice } from '../dist/public/shared/validation.js';
import { mockAdvice } from '../dist/public/shared/mock.js';
const out=process.argv[2];if(!out)throw new Error('out dir required');mkdirSync(out,{recursive:true});
// 60 characters, the area-name limit: the names differ only in their last word.
export const PREFIX='예약 화면에서 손님이 휴대폰으로 이미 잡아 둔 예약을 직접 바꾸거나 없애는 흐름의 마지막 단계인';
const nospace=process.argv[3]==='nospace';
// nospace: the same project with legal 60-character names that have no spaces at all.
export const CHANGE=nospace?`${'가'.repeat(56)}예약변경`:`${PREFIX} 예약 변경`,CANCEL=nospace?`${'가'.repeat(56)}예약취소`:`${PREFIX} 예약 취소`;
export const MANUAL='[합성41] 변경 가능 시간만 보여 주고, 취소 흐름은 건드리지 않는다.';
export const DRAFT='[합성41 미전송] 알림 문자에 변경된 시간을 함께 적어 주세요.';
export const REPORT=['[합성41 보고 · 실제 실행 아님]','변경 화면에서 바꿀 수 있는 시간만 목록에 보이게 했어요.',
  ...Array.from({length:40},(_,i)=>`세부 ${i+1}: 영업시간·휴무일·이미 잡힌 예약을 차례로 걸러 남은 시간만 보여 준다는 설명이 이어집니다.`),'끝 문장: 취소 화면은 바꾸지 않았어요.'].join('\n');
let p=rename(createProject(),'[합성41] 미용실 예약 변경·취소');
p=setBrief(p,'손님이 휴대폰으로 잡은 미용실 예약을 직접 바꾸거나 취소하고, 바뀐 내용을 문자로 받는 서비스.');
p=addArea(p,'예약','손님이 시술과 날짜·시간을 고르고 예약을 확정한다.');const book=p.space.areas.at(-1).id;
p=addArea(p,'알림','예약 확정·변경·취소를 문자로 알린다.');const notify=p.space.areas.at(-1).id;
p=addChildArea(p,book,CHANGE,'이미 잡은 예약의 날짜·시간을 바꾼다.');const change=p.space.areas.at(-1).id;
p=addChildArea(p,book,CANCEL,'이미 잡은 예약을 취소하고 자리를 비운다.');const cancel=p.space.areas.at(-1).id;
p=addArea(p,'결제','예약금과 현장 결제를 나눠 받는다.');p=addArea(p,'후기','시술 뒤 손님이 짧은 후기를 남긴다.');
p=addRelation(p,book,notify,'flow','예약이 바뀌면 알림을 보낸다.');
p=submit(editDraft(p,'예약 변경 화면에서 바꿀 수 있는 시간만 고를 수 있게 해 주세요.'),undefined,change);
const started=begin(p,p.currentTaskId),request=validateRequest(started.request);
p=receive(started.project,started.request,{mode:'mock',ticket:request.ticket,advice:validateAdvice(mockAdvice(request),request.bases.map(b=>b.id))});
const task=p.currentTaskId;p=markHandoff(p,task,handoffText(p,task,null),'clipboard',p.revision,null,null);
p=submit(editDraft(setKind(p,'report'),REPORT));const ret=p.currentTaskId;
p=editTask(p,ret,'next',MANUAL);
p=editDraft(setDraftTarget(setKind(p,'request'),notify),DRAFT);
parseProject(JSON.stringify(p));
const entry={entryId:'E_work41-0001',state:'active',lifecycle:1,seq:1,createdAt:'2026-10-24T00:00:00.000Z',trashedAt:null,origin:'new',project:p};
writeFileSync(`${out}/workspace41${nospace?'-nospace':''}.json`,JSON.stringify({version:'agentflow.workspace.1',migratedFromLegacy:true,entries:[entry]}),'utf8');
writeFileSync(`${out}/workspace41${nospace?'-nospace':''}-ids.json`,JSON.stringify({book,notify,change,cancel,task,ret}),'utf8');
console.log('workspace41 fixture written');
