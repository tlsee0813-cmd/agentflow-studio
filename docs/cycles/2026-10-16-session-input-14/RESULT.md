# 입력14 — 원본 정보 범위와 기존 지도 재사용
2026-10-16 15:05 KST 판단 시점. 현재 배정·진행은 [ACTIVE](../ACTIVE.md)에서만 갱신한다.

## 이번에 확인한 것
첫 실제 Cloud 발췌는 배정·명령/출력·완료 주장을 구별할 수 있었지만 프로그램 부분의 의미가 부족했다. [비연속8사건](https://github.com/tlsee0813-cmd/agentflow-studio/tree/1b83599f873888d8131e93c877b8c7d59b97acaf/docs/transfer/session-input-14/first-source)을 억지로 기능 지도에 넣지 않았다.

두 번째는 실제 제품13 배정·외부 작성자 반환·고정 코드·독립 보고를 대응했다. [입력과 재현](https://github.com/tlsee0813-cmd/agentflow-studio/tree/e8b28f5e85ae8319f4a4689678110c28e224bcfd/docs/transfer/session-input-14/product-v0)에5노드·1관계·7근거를 공유했다. 총괄/보조 AI가 해석한 보기 묶음이며 사람 원발화나 전체 도구 전사를 확보한 것은 아니다. 파일/검사/세션을 프로그램 기능 노드로 바꾸지 않았다.

기존 C11의 index/style와 fix1 engine을 고정하고 JSON만 교체했다. 기존 validate는 errors=[]·종료0. 총괄 브라우저에서 부분 선택→근거 열기/닫기→묶음 접기→관계 참고→명시적으로 다른 부분 선택을 확인했다. 접힌 묶음은 내부 네 변경 부분을 표시했고 묶음 전체 변경으로 바꾸지 않았다. 자동 추출·자동 갱신의 성공은 아직 아니다. Cloud가 같은 고정 입력으로 연 [1440×900 대표 화면](https://github.com/tlsee0813-cmd/agentflow-studio/blob/c0c81c0f1790bb319b4b4621734d11c2f145f478/docs/transfer/session-input-14/product-v0/screen/selected-area-add-1440.png)도 공유했다. 대표 화면 확보이며 전체 독립 기능검사가 아니다.

## 조사에서 채택한 최소 원리
Pro 조사 후 Astra가 공식 원문과 고정 코드를 대조했다. 두 환경을 하나의 전사 형식으로 취급하지 않는다.

1. **원문 위치와 사건 종류를 보존한다.** Claude의 MessageDisplay 식별자는 transcript 메시지 ID와 연결할 수 없다고 명시돼 있다. CLI의 replay-user-messages는 수신 확인용 재출력이다. 따라서 부분 출력/재출력을 새 요구로 세면 안 된다. [Hooks](https://code.claude.com/docs/en/hooks#messagedisplay-input), [CLI](https://code.claude.com/docs/en/cli-reference).
2. **작성자 주장과 관측 범위를 분리한다.** Codex 고정 타입은 발화·명령·파일 변경·MCP 호출을 구분하며 완료 이벤트가 성공만을 뜻하지 않는다. 파일 변경 결과·종료 상태·작성자의 ‘완료’ 문장을 서로 대체하지 않는다. [고정 ThreadItem](https://github.com/openai/codex/blob/a45b8ccb016fb74f63a6bc29e701568e387cbe38/codex-rs/app-server-protocol/schema/typescript/v2/ThreadItem.ts), [App Server](https://developers.openai.com/codex/app-server/).

공식 app-server thread/read의 기본 요약 응답과 이번에 쓴 read_thread 도구는 다른 표면이다. 공식 문서 설명으로 실제 빈 turns의 원인을 확정하지 않는다. 실제 표본의 버전·옵션·누락·재수신을 확인하지 않았으므로 이 조사로 수집 연결기 구현이나 무손실 보장을 선언하지 않는다. 나머지 세부 필드 대응은 후속 실제 입력이 필요할 때만 다룬다.

## 총괄 판단과 다음 작은 시험
구조와 근거 연결은 재사용됐지만 연구 설명과 배지가 길다. 이번 결과는 입력 대응의 가능성을 보여 주며 이 읽기량을 제품 기본 화면에 채택하는 근거는 아니다. Dify 실제 조작 비교는 제품 경험 평가축이고 여기의 원본 정보 범위 시험과 구분한다. 사람 사용 기록 제출을 추가 관문으로 두지 않는다.

다음은 제품13 fix1의 고정 결과를 같은 부분 이름·ID를 유지한 별도 입력 판본에 대응한다. 기존 v0를 덮지 않고 바뀐 코드·작성자 주장·독립 관측만 추가한다. 이름이 같다는 이유로 동일성을 강제하지 않으며 변경 없는 부분과 관계에 변화가 번지면 실패다. 수동 대응이 필요했던 판단을 남긴다. 범용 엔진·수집기·새 schema·제품 Area.parent 변경은 이 시험에 필요하지 않다.


## 같은 부분에 후속 기록을 적용한 결과 — 15:16 KST
[fix1 입력과 대응 기록](https://github.com/tlsee0813-cmd/agentflow-studio/tree/c562d86769fcf4ac3652e8a6b876c07a554a96be/docs/transfer/session-input-14/product-fix1)을 기존 엔진에 다시 열었다. 5노드의 이름·ID·역할·보기 묶음과 관계1개는 유지됐고, 이번 비교 구간의 변경 표시는 MAP 한 곳에만 남았다. 원본 v0는 보존했다. 근거 상세에서 v0 과거 독립 관측과 fix1 작성자 주장을 분리했고, 접힌 묶음에서도 변경 한 곳만 표시했다. 같은 기존 validate errors=[]·종료0이며 총괄 브라우저 확인이다.

입력 URL을 다시 열자 이전 ADD 선택은 초기화됐다. 따라서 자료의 동일성 대응과 표시 범위는 확인했으나 **기존 화면 상태를 유지한 실제 갱신은 아직 없다.** 같은caseId 자체가 사용자 선택·시야·초안을 보존하지 않는다. 다음 제품 연결 전에는 기존 보기/사용자 수정과 새 입력을 어떤 기준으로 함께 유지할지 좁게 시험해야 한다. 새 연구 화면을 만드는 대신 기존 렌더러를 사용한다는 원칙은 유지한다.

### 실제 제품에 연결하는 다음 시험
Astra의 고정 코드 대조 결과 C11의 `index+caseId`는 메모리 내 보기·초안 구분이며 URL 재열기는 실시간 갱신 경로가 아니다. 따라서 이 관측을 이미 구현된 갱신 기능의 회귀 결함으로 일반화하지 않는다. 실제 제품606의 기존 경로를 재사용한다: 기존 영역·요청 A의 수동 next 한 문장을 저장하고 지도 선택·좌표·배율을 정한 뒤, fix1 실제 보고 발췌를 A에 명시 연결해 입력만 저장한다. 영역 정체성·관계와 A 문장은 유지되고 보고는 별도 반환 Task로 남아야 한다. 출발 보기 복귀가 새 보고·업무 상태를 취소하면 실패다. 새 보고의 수동 필드에 A 문장이 자동 복사되는 것은 기대하지 않는다. 이는 기록 추가와 편집·보기 보존 시험이며 자동 동일성 판별·영역 설명 갱신·충돌 병합 완료가 아니다. [기존 보고 경로](https://github.com/tlsee0813-cmd/agentflow-studio/blob/606120500eeea50a20f00fb4678bced7a7d93d98/app/continuity/src/shared/domain.ts#L86).

## 실제 제품 후속 보고 연결 — 완료
[고정 독립 결과](https://github.com/tlsee0813-cmd/agentflow-studio/blob/7ae327651c0acc7f60b83c49cd513f3f78485949/docs/transfer/session-input-14/product-followup/REPORT.md). 제품606,1440×900의 새 격리 프로젝트에서 실제 작성자 보고 한 단락만 발췌했고 나머지 영역·요청·수동 문장은 검사용이다. A의 manual.next와 원문·출처 보존, 반환Task.parent=A 및 Source.taskId=반환, 새 반환manual.next=null을 확인했다. 복귀 뒤 새 반환/currentTaskId를 유지하면서 선택·matrix(1.25,0,0,1.25,-108.25,-21.5)·영역좌표·호출초점이 같았다. 지도배율1.25는 브라우저125%확대가 아니다. 관계는 빈0→0, 비어있지 않은 관계 보존은 미시험이다. 실제 child/collector0, AI POST0. 총괄은 원시checks/source binding/process를 대조해 이 좁은 결론을 수용했다.

## 갱신 메커니즘 조사 수용과 교정
Pro→Astra 공식 대조 결과 필요한 data 갱신과 선택/viewport·fit은 분리한다. [React Flow 고정 updateNodeData](https://github.com/xyflow/xyflow/blob/3d35b573/packages/react/src/hooks/useReactFlow.ts#L255)의 얕은 병합은 같은 키의 사용자 문장 보호 규칙이 아니다. [Cytoscape cy.json](https://js.cytoscape.org/#cy.json)은 동일ID 요소를 갱신하지만 입력에서 빠진 요소를 삭제하므로 부분 후속 기록을 전체 elements로 전달하는 근거로 쓰지 않는다. 이 중요 경계를 Pro 원답에 보완했다. 새 객체 생성 자체와 인스턴스 재초기화도 구분한다. 라이브러리 교체는 하지 않는다.

실제품 GUIDE는 현재구상·요청에서 다음 요청 초안을 돕지만 반환 보고를 읽는 구상갱신 경로는 아니다. 보고 해석을 사용자 요청으로 몰래 넣거나 기존 GUIDE107 HOLD를 통과로 바꾸지 않는다. 같은 영역의 현재구상/보고주장을 어떻게 짧게 보일지는 별도 조사 주제로 유지한다. 사용자 최신 지시에 따라 우선 실제 제품 홈15의 프로젝트 선택·진입을 구현하며 이 결과를 폐기하지 않는다.
