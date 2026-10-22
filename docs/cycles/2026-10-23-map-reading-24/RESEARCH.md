# 지도 읽기24 — 관측 전 판단 기록
2026-10-23 KST 사전 판단. 이후 현재 상태는 [ACTIVE](../ACTIVE.md), 관측 계약은 [INPUT](INPUT.md).

## 문제를 먼저 좁힘
22 actionError136은 선택한 알림이 아니라 다음 예약 정보 버튼이 map clip 밖에 있는 상태였다. 실제 맞춤 뒤의 실패가 아니며 자동화가 보이지 않는 목표를 직접 누른 사례일 수 있다. 현 PC 패널은 overlay가 아닌 flex 형제300px+gap14다. fitView는 이미 줄어든 map.clientWidth와 **상단** 도구 띠를 계산한다. 패널 폭을 또 빼는 수정은 잘못이다. info 선택은 카메라를 보존하므로 패널 생성으로 줄어든 clip 밖에 카드가 남을 수 있다. 기존 화면 밖N/모두 보기와 locateArea/revealCard 및 명시 이전 보기를 먼저 시험한다.

23의1280 정정 PNG에서도 선택 카드 일부가 오른쪽 clip 밖이다. 상세 패널에서는 정정문을 읽을 수 있다. 이 관측 하나만으로 전체 흐름 차단이라고 판단하지 않는다.

## 외부 조사와 직접 비교
[공간 탐색 전용 Web Pro](https://chatgpt.com/c/6ad9e588-d3e0-83e8-bdd6-660ab76650a7)는 현재 코드와22 기록을 읽고 조건부 선택 위치 단서, 전체맞춤 최소 가독성 줌을 제안했다. 이는 실제 서비스 조작/PNG 검증을 대신하지 않는다. 총괄은 기존 위치 찾기 중복 가능성과 all-fit 의미 변경 위험 때문에 바로 구현하지 않았다. Pro의 하단 도구 언급은 코드의 상단 띠와 달라 정정한다.

Dify 고정소스9f75925578ecd093ce3d1e30cb4c68f6efb8398c의 [workflow panel](https://github.com/langgenius/dify/blob/9f75925578ecd093ce3d1e30cb4c68f6efb8398c/web/app/components/workflow/nodes/_base/components/workflow-panel/index.tsx) reservedCanvasWidth400/폭 clamp와 [workflow](https://github.com/langgenius/dify/blob/9f75925578ecd093ce3d1e30cb4c68f6efb8398c/web/app/components/workflow/index.tsx)의 저장 viewport·조건부 초기 fit·resize observer를 직접 대조했다. [React Flow viewport 계산](https://reactflow.dev/api-reference/utils/get-viewport-for-bounds)과 [instance API](https://reactflow.dev/api-reference/types/react-flow-instance)의 계산/적용·전체/대상별 fit 구분은 참고하되 라이브러리 도입을 결정한 것은 아니다.

총괄은 사용자가 열어 둔 Dify workflow를1280×720에서 실제 조작했다.64%에서 UserInput 선택→400px 패널을 열어도 줌이 유지됐고 Output 일부는 가려졌다. 명시 화면맞춤은29%로 전체 개요를 줄여 보여주고 본문은 작아졌다. 선택한 노드로 스크롤은 애니메이션 후100%가 되어 해당 노드 읽기에 집중했다. 전체 개요와 한 부분 읽기가 다른 행동이라는 점을 채택한다.400px·항상100%·overlay를 그대로 가져올 이유는 없다.

종료는 패널 닫기와 명시 전체맞춤29%였다. 원64% 카메라의 정확 복원은 하지 않았다. 자동저장 시각이 바뀌었으므로 원격 바이트 불변을 주장하지 않는다. 노드 편집·실행·게시를 하지 않았다. 화면은 대화의 도구 이미지로 관측했으며 별도 GitHub PNG로 게시한 증거는 아니다. 이 기제 비교는 사람 대상 사용성 연구가 아니다.

## 총괄의 선택
문장/버튼을 추가하기 전에 기존 전체맞춤·위치 찾기·이전 보기의 실제 반복 비용과 카메라/선택 맥락을 관찰한다. 개선이 필요하다면 사용자에게 보이는 다음 행동 하나에 집중한다. 큰 지도 엔진이나 무제한 줌 정책까지 이번에 확정하지 않는다. 출처와 제안은 판단 자료이며 사용자 승인이나 구현 지시 자체가 아니다.
