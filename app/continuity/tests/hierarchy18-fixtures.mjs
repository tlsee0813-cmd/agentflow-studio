// Bounded analyst reconstructions, not original users' hierarchy plans or automatic extraction.
import * as D from '../dist/public/shared/domain.js';
export const hierarchyCases=[{
 id:'powertoys',title:'PowerToys 키 매핑 편집기의 제한된 구성 재서술',
 nature:'공개 리뷰·XAML·고정 코드의 분석자 구성. reusable type와 개별 instance를 복제 노드로 중복 생성하지 않음.',
 nodes:[['editor','키 매핑 편집기','검색·선택과 녹화 종료를 다른 동작으로 다룬다.',null],['search','키 검색·선택','제출한 검색어로 필터링한 키를 고른다.','editor'],['input','검색 입력과 결과','검색 입력과 결과목록은 KeyDropDownButton 내부의 사용자 대면 구성이다.','search'],['record','녹화 종료 판단','Tab 누름만 녹화를 종료하고 정상 key-up 처리는 보존한다.','editor'],['hook','공통 입력 훅','여러 화면을 지원하는 별도 공통 부분이다.',null]],
 relations:[['hook','record','flow','고정 코드의 이벤트 종류 전달']],
 target:'input',parent:'editor',leafParent:'search',other:'hook',
 summary:'제출한 검색어로 목록을 동기 필터링해 선택한다. 녹화 종료 수정은 별도이며 a964 커밋이 두 리뷰 요구를 함께 다뤘다.',
 changes:['제출된 검색어를 기존 결과 목록 대신 선택 기준으로 쓴다.'],
 origin:'PowerToys 공개 고정 소스 일부의 한국어 재서술 · 분석자 구성',
 links:['https://github.com/microsoft/PowerToys/blob/a964f08cc6fbecb3b9f9d4fe6c1d7481330c7938/src/modules/keyboardmanager/KeyboardManagerEditorUI/Controls/UnifiedMappingControl.xaml#L74','https://github.com/microsoft/PowerToys/blob/a964f08cc6fbecb3b9f9d4fe6c1d7481330c7938/src/modules/keyboardmanager/KeyboardManagerEditorUI/Controls/KeyDropDownButton.xaml#L22','https://github.com/microsoft/PowerToys/pull/51150#discussion_r4255501266','https://github.com/microsoft/PowerToys/pull/51150#discussion_r4255501287'],
 limits:'원래 사용자3층 계획·실행성공·한쪽만 수정된 실제 중간본이 아님. 실제 질문 신호는 없으므로 별도 합성으로만 주입한다.'
},{
 id:'product13',title:'제품13 전체 공간의 포함 구성 재서술',
 nature:'총괄 AI 배정과 코드·보고를 분석자가 대응한 내부 제품 표본. 사람 원발화나 유일한 정답 분할이 아님.',
 nodes:[['space','전체 공간 읽기','목적과 영역 구상을 기본에서 읽는다.',null],['purpose','프로그램 목적 읽기','짧게 읽고 원문에 접근한다.','space'],['map','영역 지도와 선택상세','현재 영역과 관계를 읽고 선택한다.','space'],['records','질문·보고 기록 읽기','기록 종류를 구별하며 개발 미완료로 합산하지 않는다.','space'],['add','영역 추가','사용자 명시 입력으로 추가한다.','space'],['tools','지도 조작','확대·축소·맞춤은 포함 깊이와 별개이다.','map'],['cards','영역 카드','영역 ID를 유지하는 선택·진입 대상이다.','map'],['panel','선택 상세','선택한 영역의 구상·요청을 읽는다.','map']],
 relations:[['add','cards','flow','추가 후 표시되는 카드와의 정밀 대응은 분석자 판단']],
 target:'tools',parent:'map',leafParent:'map',other:'add',
 summary:'PC 지도 조작부는 fix1에서 위 오른쪽으로 옮겼다. v0의 선택 카드 가림 관측과 fix1 작성자의 잔여 제한은 따로 남는다.',
 changes:['조작부 위치 수정은 선택 카드 clipping 해결을 뜻하지 않는다.'],
 origin:'제품13 총괄 AI 배정·고정 반환의 분석자 한국어 재서술',
 links:['https://github.com/tlsee0813-cmd/agentflow-studio/blob/9aeb4599aa0060e2d43143c4f1150884d7bcc7b3/app/continuity/src/client/app.ts#L1053','https://github.com/tlsee0813-cmd/agentflow-studio/blob/709dab4d730c87b44e1a08a1cddd0cb9832b807a/docs/transfer/pc-map-space-13/independent-v0/REPORT.md#L19','https://github.com/tlsee0813-cmd/agentflow-studio/blob/827f029e0dab79b48ebe8818fb15d32db7ed8d06/docs/transfer/pc-map-space-13/author-fix1/REPORT.md'],
 limits:'SPACE1+4와MAP하위3은 분석자 재구성. 과거 내부3영역 검사자료는 합성이며 실제 고객 구성으로 쓰지 않는다.'
}];
export function hierarchySample(c=hierarchyCases[0]){
 let p=D.setBrief(D.createProject(),c.title);const ids={};
 for(const [key,name,note]of c.nodes){p=D.addArea(p,name,note);ids[key]=p.space.areas.at(-1).id;}
 for(const [key,, ,parent]of c.nodes)if(parent)p=D.setAreaParent(p,ids[key],ids[parent]);
 for(const [from,to,kind,note]of c.relations)p=D.addRelation(p,ids[from],ids[to],kind,note);
 const area=ids[c.target];p=D.submit(D.editDraft(p,'[분석자 재서술 표본] 이 부분의 명시 범위만 확인한다. 조상 참고로 실행 범위를 확대하지 않는다.'),undefined,area);
 const task=p.currentTaskId,returnId=`H_hierarchy_${c.id}`,anchor=D.exportAnchor(p,D.taskOf(p));
 const text=D.handoffText(p,task,returnId);p=D.markHandoff(p,task,text,'clipboard',p.revision,returnId,anchor);
 const file={schemaVersion:'agentflow.return.2',projectId:p.id,taskId:task,returnId,report:`[고정자료 재서술] ${c.summary}`,evidence:null,understanding:{version:'understanding.1',areaId:area,basedOn:anchor.understanding,summary:c.summary,changes:c.changes,proposal:'[합성 경계 · 실제 제안 아님] 조상 참고를 자식의 전체 구현 명령으로 바꾸자는 제안.',origin:c.origin}};
 return {p,ids,area,task,returnId,file,text,metadata:{nature:c.nature,links:c.links,limits:c.limits}};
}
