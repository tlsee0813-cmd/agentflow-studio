# 다음 흐름 조사 · 2026-10-23 KST 판단 시점
이 파일은 구현 배정이나 현재 상태표가 아니다. 현재 상태는 [ACTIVE](../ACTIVE.md), 먼저 확인할 지도 복귀 범위는 [30 INPUT](INPUT.md)을 따른다.

## 조사와 총괄 판단
공간 탐색 Web Pro에 Dify·React Flow·tldraw 공식 자료와 AgentFlow 실제 코드를 대조하게 했다. Pro는 집계에서 정확 기록으로 들어가기, 실제 공간 이웃의 일시 강조 두 후보와 방문 이후 새로움 표시 보류를 제안했다. 총괄은 공식 원문과 제품 코드를 다시 읽어 **기존 집계에서 기존 기록으로 가는 경로 단축만 우선 후보**로 남긴다. 아직 구현·실제 조작 비교를 완료한 것이 아니다.

- [Dify 선택 노드 이동 코드](https://github.com/langgenius/dify/blob/9f75925578ecd093ce3d1e30cb4c68f6efb8398c/web/app/components/workflow/header/scroll-to-selected-node-button.tsx): 선택과 명시적 이동 버튼이 분리돼 있다. 선택을 즉시 화면 이동으로 해석하지 않는 기제를 참고한다.
- [Dify 단축키 코드](https://github.com/langgenius/dify/blob/9f75925578ecd093ce3d1e30cb4c68f6efb8398c/web/app/components/workflow/shortcuts/use-workflow-hotkeys.ts): canvas focus와 Shift 유지 동안 dim, 해제·unmount 때 복구한다. 이 기제를 확인했지만 AgentFlow의 다른 가지 보류·질문 신호를 흐리게 만들 위험 때문에 지금 채택하지 않는다.
- [React Flow getOutgoers](https://reactflow.dev/api-reference/utils/get-outgoers): 명시 edge의 도착 이웃을 계산한다. 의미상 영향이나 우선순위를 추론하지 않는다. 공식 문서 갱신 표시는2026-10-11.
- [tldraw 그룹](https://tldraw.dev/sdk-features/groups): 단계적 그룹 초점은 실제 편집 범위를 바꾸며 Escape로 한 단계 돌아간다. 선택 해제만으로 초점 범위가 초기화되지는 않는다. AgentFlow에는 명시 진입·복귀만 참고하며, 그 편집·재부모화 동작은 복제하지 않는다.

위 Pro 조사는2026-10-23 KST의 공식 코드·문서 대조다. Dify가 잘하는 공간에서의 명시 행동·회복을 평가 기준으로 삼되 실행 워크플로우와 AI 작업 이해·조정이라는 목적 차이를 유지한다.

## 먼저 검토할 작은 흐름
사용자 질문은 “접힌 예약 부분의 질문·보류 표시는 어디서 온 것인가?”다. 현재 branch-signals는 텍스트이고 subtreePanel에는 정확 소유 부분과 기록/설명 진입이 이미 있다. 새 대시보드·분류 엔진·AI 우선순위 없이 기존 집계 문구를 눌러 **그 부분의 기존 하위 기록 목록**에 바로 도달하게 하는 안이다.

총괄이 Pro 표현을 정정한 부분: subtreeSignals의 질문에는 답변 기록이 있는 질문도 포함된다. 집계를 ‘미답 수’나 ‘새 문제 수’로 바꾸면 안 된다. 현재/이전 기준/보류도 합산해 하나의 완료 상태로 해석하지 않는다. 행에서 원래의 답변 기록·소유자를 유지한다.

개발 보조의 읽기 전용 검토에서는 기존 정보 버튼의 소유자 선택 정책을 재사용하고, 렌더 뒤 정확 subtree disclosure를 열고 패널 본문 안에서만 초점을 이동하는 안을 제시했다. 렌더 전 open memo만 바꾸면 이전 DOM capture가 덮을 수 있다. 카메라 이동 함수는 호출하지 않는다. 기록에서 돌아올 때 기존 Origin을 재사용하며, 패널 닫기는 진입한 신호 버튼으로 돌아가고 사라졌으면 정보 버튼으로 돌아간다.

기존 span과 같은 문구·존재 조건·공간을 유지해야 한다. 버튼 기본 padding/최소 높이가 카드 크기를 키우지 않는지, 모든 신호가 함께 있을 때 가림, 저배율 실제 클릭, Tab/Enter/Space와 초점 표시, 다른 부분·프로젝트로 caller가 새지 않는지를 작은 반례로 본다. 접근성 이름에도 보이는 집계 문구를 남긴다. 아직 성공으로 판정한 항목은 없다.

## 남겨 둔 두 가지
공간 이웃 일시 강조는 개입 신호의 대비를 약화할 위험 때문에 보류한다. 질문·보류 기록에 도달하는 기본 경로와 지도 복귀를 먼저 안정시킨다.

‘지난 방문 이후 달라진 것’은 실제 공백이지만 receivedAreas는 이 탭에서 받은 설명일 뿐 방문 기준점이 아니다. 새 배지를 붙여 빈 기준을 숨기지 않는다. 명확한 비교 기준점과 고정 사례로 분류가 가능한지 별도로 확인하기 전에는 unread·알림함을 만들지 않는다.

## 총괄의 제한된 Dify 조작 대조
같은 날 열려 있던 Market Research 예제에서29% 전체 보기→Agent 선택→400px 설정 패널과 ‘선택한 노드로 스크롤’ 버튼 노출→명시 이동→패널 닫기→전체 맞춤29% 복귀를 확인했다. 설정·실행·게시를 바꾸는 동작은 하지 않았다. 이 짧은 조작을 전체 서비스 사용성 비교나 사람 연구로 부르지 않는다.

중요한 차이는 명시 이동이 배율을 유지하지 않았다는 점이다. 이동 도중32%가 보였고 이후100%가 됐다. [공식 이동 구현](https://github.com/langgenius/dify/blob/9f75925578ecd093ce3d1e30cb4c68f6efb8398c/web/app/components/workflow/utils/node-navigation.ts)의 setCenter는 zoom1/duration800을 지정한다. 따라서 Dify의 선택/명시 이동 분리는 참고하지만 그 이동을 AgentFlow의 최소 pan·기존 카메라 보존과 같다고 설명하면 안 된다. 이번 기록 입구 후보는 카메라를 바꾸지 않는 별도 행동으로 설계한다.
