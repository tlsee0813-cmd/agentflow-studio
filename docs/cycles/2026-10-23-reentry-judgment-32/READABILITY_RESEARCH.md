# 후속 가독성 메커니즘 조사 · 아직 구현 선택 아님
2026-10-23 KST.32 전체 흐름 관측을 대체하지 않는다. [별도 Web Pro 세션](https://chatgpt.com/c/6ada853c-ff1c-83ee-8258-965005014026)은 4분51초 조사 후 응답했고, 총괄이 아래 공식 문서·고정 소스 및 기존 제품을 직접 대조했다. Pro는 이번 조사에서 실제 서비스/데모 조작이나 사람 연구를 수행하지 않았다. Dify의 앞선 실제 조작은 [32 연구](RESEARCH.md)에 별도로 있다.

## 근거와 한계
- [React Flow Contextual Zoom](https://reactflow.dev/examples/interaction/contextual-zoom)은 배율에 따라 내용을 바꾸는 기법이다. 표시 생략은 글자의 화면 크기 보장을 뜻하지 않는다. 제목 확대가 신호 정보를 가렸던28 반례를 우회하는 근거로 쓰지 않는다.
- [NodeToolbar](https://reactflow.dev/api-reference/components/node-toolbar)는 노드 옆 읽기층이 viewport와 함께 축소되지 않는다고 명시한다. [xyflow 고정 계산 코드](https://github.com/xyflow/xyflow/blob/8523d8dd9f1551954bc221dccabd6a3119ef9e22/packages/system/src/utils/node-toolbar.ts)는 노드 위치에 zoom/pan을 적용하되 내용에는 translate만 반환한다. 이 함수 자체에는 가장자리 clamp/flip이 없으므로 배율 독립과 가림 방지는 다르다. 저장소 스냅샷은2026-10-22 08:38:50 UTC이며 기능 도입일이 아니다.
- [React Flow 접근성](https://reactflow.dev/learn/advanced-use/accessibility)의 기본 노드 초점은 자동 pan을 동반할 수 있다. 읽기층과 카메라 보존은 따로 검증해야 한다. 호버만 가능한 입구를 유일한 읽기 경로로 만들지 않는다.
- [tldraw 성능 문서](https://tldraw.dev/sdk-features/performance)의50px 아래 단순 사각형 예시는 렌더 비용을 줄이는 개발자 예제다. 질문·현재/보류 의미를 숨겨도 된다는 제품 근거가 아니다.
- [Dify 고정 패널 코드](https://github.com/langgenius/dify/blob/9f75925578ecd093ce3d1e30cb4c68f6efb8398c/web/app/components/workflow/nodes/_base/components/workflow-panel/index.tsx)는 Escape를 처리해 같은 node ID로 preventScroll 초점을 돌린다. 스냅샷 시각2026-10-22 15:19:17 UTC를 확인했다. 이는 선택 소유자 연결의 코드 근거이며 모든 카메라/바깥페이지 보존을 실제 실행했다는 뜻이 아니다. 자체31의 pageY 반례도 preventScroll만으로 전체 화면 불변을 보장하지 못함을 보여준다.

## 총괄 판단
Pro의 두 제안은 카드 옆의 배율 독립 읽기층과 기존 패널의 짧은 선택 설명이다. 동일한 정보·글자 크기로 위치만 비교하자는 원칙은 타당하다. 그러나 현재 제품7c7bdfa8의 area panel은 이미 소유 이름/경로, areaIdea100자, 현재 설명, 하위 기록을 순서대로 갖고 있다. 따라서 **별도 요약을 추가하는 두 번째 제안은 당장 채택하지 않는다.** 현행 패널이 충분한 기준인지, 기존 내용의 노출 순서가 문제인지는32에서 확인한다.

카드 곁 읽기층도 선택한 한 부분을 읽기 위한 후보일 뿐 선택 전 여러 영역의 변화를 동시에 파악하는 해결책은 아니다. 서로 다른 소유자의 호버/선택이 섞이거나 관계선·포함 경계·정확 호출행을 덮으면 보류한다. 자동fit·카메라 이동이나 설명 생략으로 통과시키지 않는다.

32의 실제 장애가 '선택한 부분이 작아서 못 읽음'일 때만 현행 패널 대비 단일 읽기층을 좁게 비교할 가치가 있다. 장애가 변화의 근거 부재, 현재/보류 혼동, 선택 전 비교 실패라면 그 메커니즘부터 다뤄야 한다. 새 unread·우선순위·의미요약을 조사 답변만으로 만들지 않는다.
