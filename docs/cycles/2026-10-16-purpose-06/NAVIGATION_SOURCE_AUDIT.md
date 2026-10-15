# cycle06 좁은 폭 탐색 소스 감사

관측일: 2026-10-16(KST). 지정된 고정 소스 **3파일**과 공식 문서의 관련 항목만 읽었다. 실제 UI 조작·브라우저 실행·코드 재사용 검증은 하지 않았다. GitHub 코드는 아래 SHA에 고정되지만 공식 문서는 해당 SHA에 묶인 버전이 아닌 현재 문서 관측이다.

## React Flow MiniMap

근거: xyflow `3d35b57317576b0916c0bfeaaedd573aaacc2839`의 [MiniMap.tsx](https://github.com/xyflow/xyflow/blob/3d35b57317576b0916c0bfeaaedd573aaacc2839/packages/react/src/additional-components/MiniMap/MiniMap.tsx), [MiniMapNodes.tsx](https://github.com/xyflow/xyflow/blob/3d35b57317576b0916c0bfeaaedd573aaacc2839/packages/react/src/additional-components/MiniMap/MiniMapNodes.tsx), [공식 MiniMap 문서](https://reactflow.dev/api-reference/components/minimap). 공식 문서 표시 갱신일은 2026-10-11이다.

| 주장 | 원문 대조와 경계 |
|---|---|
| 시야 마스크와 선택은 별개다 | **지지.** MiniMap.tsx 20–25행의 `viewBB`는 지도 transform·크기로 계산되고, 210–215행의 SVG mask 경로에 쓰인다. MiniMapNodes.tsx 117행은 개별 노드의 `selected`를 별도 NodeComponent prop으로 전달한다. 선택과 현재 보이는 범위는 같은 상태가 아니다. 다만 기본 노드 렌더러·CSS는 추가로 읽지 않았으므로 실제 선택 강조의 모양·가독성까지 확인한 것은 아니다. |
| hidden 노드는 제외한다 | **지지, 의미 한정.** MiniMap.tsx 17·43–45행은 `!node.hidden`으로 노드 경계 계산을 제한한다. MiniMapNodes.tsx 106행은 없는 노드·`hidden` 노드·크기 없는 노드를 그리지 않는다. 여기서 hidden은 명시적 노드 속성이며, 단지 화면 밖이라는 뜻이 아니다. 부모 접힘에 따른 자손 상태와 부모 안내는 이 두 파일만으로 보장되지 않는다. |
| 기본 관계선은 없다 | **지지.** 확인한 기본 렌더 경로는 MiniMapNodes와 시야 mask이며 edge 목록·관계선 렌더가 없다. 따라서 기본 MiniMap으로 관계 보존이나 연결 의미를 읽을 수 있다는 주장은 과장이다. 사용자 정의 노드 컴포넌트·별도 확장은 이번 확인 범위 밖이다. |

공식 문서도 SVG 노드 개요와 현재 viewport 표시를 설명한다. `maskColor`는 viewport 바깥을 가리며, 기본 `pannable`·`zoomable`은 false다. 그러므로 작은 개요가 존재한다는 사실만으로 클릭·드래그 탐색이 기본 제공된다고 해석하면 안 된다. 고정 소스와 현재 문서의 모든 기본값이 동일하다는 주장도 하지 않는다.

## tldraw 폭 기준과 카메라

근거: tldraw `9bbecbe7973d0b6103adc441410662f04d2658e9`의 [breakpoints.tsx](https://github.com/tldraw/tldraw/blob/9bbecbe7973d0b6103adc441410662f04d2658e9/packages/tldraw/src/lib/ui/context/breakpoints.tsx), [공식 camera methods](https://tldraw.dev/sdk-features/camera#camera-methods). 문서 표시 최종 편집일은 2025-12-20이다.

- **폭에 따른 UI 기준값은 확인된다.** 21행은 editor viewport 폭(없으면 window 폭)을 읽고, 23–33행은 폭 구간과 `forceMobile`에 따라 context 값을 정한다. 실제 픽셀 상수와 소비 컴포넌트는 추가로 읽지 않았다. 이 파일은 구체적인 모바일 도구 배치, 맥락띠, 지도↔본문 전환을 입증하지 않는다.
- **전체·선택·위치 이동은 서로 다른 작업이다.** 공식 API명은 `fitAll`이 아니라 `zoomToFit()`이며 현재 페이지의 모든 도형을 맞춘다. `zoomToSelection()`은 선택 영역에 맞춘다. `centerOnPoint()`는 특정 위치를 중심에 놓고, `setCamera({x,y,z})`는 위치·배율을 지정하며, `zoomToBounds()`는 주어진 경계에 맞춘다. 전체를 맞추는 작업을 현재 배율 보존이나 이전 시야 복귀와 동일시하면 안 된다.
- 카메라의 x/y/z와 DOM의 native scroll은 별개다. 이 카메라 항목은 본문 읽기 위치·기존 선택·진입 전 전체 상태의 자동 보존 계약이 아니다. 문서에 있는 특정 quick-zoom의 Escape 취소 동작을 일반적인 모든 왕복의 복원 보장으로 확장하지 않는다.

## 우리 제안에 적용할 한계

Pro B의 **좁은 폭 맥락띠, 같은 지도와 본문에 대한 순차 접근, 현재 배율/native scroll 유지, 기존 선택 보존, hidden 상대는 부모까지만 안내하고 펼침은 별도 행동으로 제공**하는 규칙은 우리 시안에서 정하고 검증할 정책이다. 위 소스는 시야·선택·폭 기준·카메라 목적을 분리할 근거를 제공하지만 이 구체 동작의 성공 사례나 보존 보장은 아니다. 부모 표시를 상대 노드 자체의 위치·포함 관계 확인으로 표현해서도 안 된다.

총괄 선택은 **B 순차 접근**이며 MiniMap/A의 읽기 전용 위치 윤곽은 보류한다. 새 자료 구조는 기능 후보 1개·업무 자료 1개·옮길 대상 1개로 정하며 혼합 깊이를 억지로 만들지 않는다. 이는 프로젝트 선택으로 기록한 것이지 위 소스가 입증한 구조가 아니다. 이번 정적 대조를 구현 재사용 선언으로 바꾸지 않는다. 이전 `6rect`/`oldC32` 수치도 새 표본이나 동작 계약으로 승계하지 않는다.
