// Synthetic exchange data only. No provider/CLI/account access.
import * as D from '../dist/public/shared/domain.js';
import { RESULT_SCHEMA } from '../dist/public/shared/types.js';
export const put=(p,text,kind='request',target)=>D.submit(D.editDraft(D.setKind(p,kind),text),target);
export function fileFor(p,taskId,returnId,report='  합성 A 보고\n수정은 주장일 뿐. 못 한 일: 실기기 검사.  ',evidence='합성 검사 출력\n실제 CLI 증거 아님') {
  return {schemaVersion:RESULT_SCHEMA,projectId:p.id,taskId,returnId,report,evidence};
}
export function fixture() {
  let p=D.rename(D.createProject(),'CONNECT039 합성 프로젝트');p=put(p,'A: 버튼 문구 변경. 결제 흐름 유지.');const A=p.currentTaskId;
  p=D.editTask(p,A,'scope','A 직접 쓴 범위');p=D.editTask(p,A,'checks','A 직접 쓴 확인 조건');
  p=D.recordBasis(p,'승인 정책은 보류한다.','deferred');p=D.recordBasis(p,'보존할 현재 값','confirmed');
  const H1='H_connect039_A1',H2='H_connect039_A2',HB='H_connect039_B1';
  const firstText=D.handoffText(p,A,H1);p=D.markHandoff(p,A,firstText,'download',p.revision,H1);
  p=D.editTask(p,A,'next','A 두 번째 인계: 문구만 변경');p=D.recordBasis(p,'보존할 새 값','confirmed',p.bases.at(-1).id);
  p=D.markHandoff(p,A,D.handoffText(p,A,H2),'download',p.revision,H2);
  p=put(p,'B: 검색 입력 UI만 정리.');const B=p.currentTaskId;
  p=D.editTask(p,B,'next','B 검색 입력만 정리');p=D.markHandoff(p,B,D.handoffText(p,B,HB),'download',p.revision,HB);
  p=D.editDraft(p,'보존할 일반 요청 초안');p=D.editAuxDraft(p,'answerDraft','보존할 답변 초안');p=D.editAuxDraft(p,'basisDraft','보존할 기준 초안');p=D.editBasisDraft(p,p.bases[0].id,'보존할 기준 편집 초안');
  return {p,A,B,H1,H2,HB,firstText,raw:JSON.stringify(fileFor(p,A,H1),null,2)};
}
export function v2(p) {
  // project.2 predates the FLOW090 plan space and task areas.
  const old=structuredClone(p);old.schemaVersion='idea015.project.2';delete old.pasted;delete old.readings;delete old.space;for(const t of old.tasks){delete t.areaId;delete t.background;for(const h of t.handoffs)delete h.background;}
  for(const t of old.tasks){delete t.resultFile;for(const h of t.handoffs){delete h.returnId;delete h.anchor;}}
  return old;
}
export function v1(p) {
  const old=v2(p);old.schemaVersion='idea015.project.1';delete old.pasted;delete old.readings;for(const b of old.bases)b.locked=false;
  for(const t of old.tasks){delete t.adviceRevision;t.handoffs=t.handoffs.map(h=>({at:h.at,method:h.method,revision:h.revision,text:'합성 이전 작업문 원문'}));}
  return old;
}
if(process.argv[1]?.endsWith('connect039-fixtures.mjs')) {
  const {mkdir,writeFile}=await import('node:fs/promises');const out=process.argv[2];if(!out)throw Error('outDir required');await mkdir(out,{recursive:true});
  const f=fixture();
  for(const [name,value] of Object.entries({'before.json':JSON.stringify(f.p),'A-H1.result.json':f.raw,'A-H1.handoff.md':f.firstText,'v1.json':JSON.stringify(v1(f.p),null,2),'v2.json':JSON.stringify(v2(f.p),null,2),'refs.json':JSON.stringify({A:f.A,B:f.B,H1:f.H1,H2:f.H2,HB:f.HB})}))await writeFile(`${out}/${name}`,value,'utf8');
}
