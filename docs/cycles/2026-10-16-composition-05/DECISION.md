# cycle05 구성·탐색 선택 기록
2026-10-16 · 시안 배정 전 판단. 실행 상태는 [ACTIVE](../ACTIVE.md), 입력은 [INPUT](INPUT.md). 아래는 사람 사용성 결과가 아니다.

## 두 Pro 결과와 총괄의 선택
[구성 Pro](https://chatgpt.com/c/6ad11f6e-f728-83e8-9d0a-55ba32028487)는 사용자 기능별 A(구상 다듬기/요청 준비/작업문/결과 연결/저장 복구)와 보존 책임별 B(현재 구상/요청 사본/전달 사본/반환 대응/범위 우선권)를 비교했다. A는 하고 싶은 기능을 찾기 쉽다는 가설이고 B는 사본의 시점·출처를 명료하게 하지만 한 사용자 행동이 분산된다. 공식 자료 조사이며 직접 서비스 조작은 하지 않았다.

**기본은 A의 기능 구성으로 진행한다. B의 보존 조건은 선택적 기술 부록이 아니라 해당 기능을 잘못 이해하지 않게 하는 설명으로 붙인다.** 문서에 AI 입력과 작업문이 모두 있으므로 ‘작업문’ 묶음은 ‘전달할 내용’으로 보완하고 두 형태를 구별한다. 현재 구상/요청/사본 데이터를 기능과 동일한 노드 종류로 합치지 않는다. 과거 계약이 다루는 기능 일부의 구성안이며 전체 프로그램의 완성 구조로 부르지 않는다.

Astra 반례는 두 가지다. 요청 준비→작업문 만들기를 필수 단계나 매번 최신화로 읽으면 F2/F3/F8을 위반한다. 결과 연결/저장 복구를 현재 구상으로 정리하는 기능으로 읽으면 늦은 이전 반환과 null 보존을 위반한다. 따라서 기본 지도에 무조건적인 기능 순서 화살표를 두지 않고 상세·준비에 요청 시점의 보존을 붙인다. 제안이라는 배지 수를 늘려 해결하지 않는다.

[탐색 Pro](https://chatgpt.com/c/6ad11f92-7fd0-83ec-b658-da441d3df6b5)는 Dify의 제자리 선택/상세와 yFiles의 master/view 분리·folding·localRoot를 비교했다. **기본은 지도 배치를 유지한 짧은 선택 설명, 필요할 때 이 부분의 집중 읽기로 들어가는 조합**을 택한다. 집중에서는 상위 맥락과 실제 외부 연결을 보존하고, 전체로 나오면 이전 지도 상태를 복원한다. SDK나 가변 시트/제스처 엔진을 도입하지 않는다.

## 원문이 보장하는 것과 우리가 만들어야 하는 것
- Structurizr filtered view는 같은 모델의 요소/관계를 태그로 선별한다. 포함 관계나 정확 화면 복원을 보장하지 않으며 base view가 목록에서 숨겨지는 조건도 있다. [공식 예제](https://docs.structurizr.com/dsl/cookbook/filtered-view/)
- IcePanel 그룹 소속은 모델에 기록되고 복수 그룹 소속이 가능하다. 미할당 상자, 모델 그룹, C4 부모를 구별한다. lower connection은 기존 자식 관계의 재사용이며 데이터 동기화가 화면 복귀는 아니다. [Groups](https://docs.icepanel.io/core-features/modelling/groups) · [Connections](https://docs.icepanel.io/core-features/diagramming#connections)
- Dify Iteration은 배열을 처리하는 하위 **실행** 공간이므로 프로그램 기능의 포함 구조로 복제하지 않는다. 고정 코드의 부모/크기·선택 처리는 참고하되 ‘선택 취소가 모든 강조와 viewport를 복구한다’고 주장하지 않는다. 일반 선택 경로와 data.selected만 해제하는 handleNodesCancelSelected를 구별한다. [Iteration 문서](https://docs.dify.ai/en/cloud/use-dify/nodes/iteration) · [고정 코드](https://github.com/langgenius/dify/blob/8387590ace4a094de812b7847fc6a4c3a27cd52b/web/app/components/workflow/hooks/use-nodes-interactions.ts)
- yFiles localRoot=null은 표시 루트 복귀다. 부분 그래프는 외부 노드 연결을 포함하지 않을 수 있으므로 외부 맥락은 우리 표현에서 따로 보존해야 한다. 펼침 상태와 folder 모양/위치의 공유 범위도 다르다. getMasterEdges의 실제 관계 조회 원리를 참고하되 새 관계를 만들지 않는다. [Folding](https://docs.yworks.com/yfiles-html/dguide/folding/) · [IFoldingView](https://docs.yworks.com/yfiles-html/api/IFoldingView/)

위 공식 문서의 게시/갱신일·제품 버전이 모두 고정된 것은 아니다. 코드가 고정된 Dify와 라이브 문서를 구별한다. 이번에 외부 코드를 복사하거나 라이브러리 라이선스 도입을 결정하지 않았다. 세부 대조는 원문 감사에 보존한다.

## 원래 범위와 다음 반증
같은 기록에서 기능 구성을 다르게 읽는 비교는 위 두 후보로 충분하다. 두 완성 화면과 큰 새 엔진을 동시에 만드는 대신 선택한 한 흐름에서 제안/명시 관계·현재 구상/과거 사본·관련/변경·준비/송신의 구별이 유지되는지 확인한다.

구성 제안이 인계문에서 확정 소유·승인된 실행범위로 바뀌거나, 최신 구상이 기존 사본에 소급되거나, 집중 진입으로 외부 관계가 사라지면 수정한다. 사람 사용성은 아직 가설이다. 입력이 개발 계약/MOCK에 치우친 한계도 유지하며 이 결과를 보편적인 최종 구조로 확정하지 않는다.
