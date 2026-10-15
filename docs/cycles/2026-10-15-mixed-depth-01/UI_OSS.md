# Q03·Q04: React Flow와 AntV X6의 직접 재사용 범위

확인일: 2026-10-15, Asia/Seoul. 기준 방향: AgentFlow Studio `73fc284026f2f5140e9c972a496c77ca0931eabf`와 최신 사용자 지시. 대상은 React Flow·AntV X6 두 개뿐이다. 공식 문서의 본문, 공개 예제 소스, 고정 버전의 API·라이선스를 읽었다. 설치·라이브러리 채택·브라우저 시연·성능 측정·원격 쓰기는 하지 않았다.

## 먼저 내리는 판단

두 라이브러리는 **계층과 관계를 표현할 기반**을 제공한다. 그러나 AgentFlow의 핵심인 “A를 접어도 A2·A4·A6만 B와 관련됨을 보존하고, 다시 펼쳐 원래 대상을 찾는다”는 의미 계약은 어느 쪽에서도 기본 그룹 기능만으로 완료되지 않는다. 원래 관계와 표시용 집계를 분리하는 자체 구현이 필요하다.

React Flow는 React로 구성하는 선택 패널·카드와 연결하기 쉬운 API가 있고, X6는 중첩 그룹의 접힘 상태를 고려한 공개 예제까지 확인된다. 이는 재사용 후보의 차이이며 채택 결정이 아니다. Dify 이상의 완성도라는 목표는 배치·정보 위계·상태·키보드·공간 기억·전환 동작을 실제 화면에서 다듬고 확인해야 한다. 라이브러리의 존재나 예제 작동 설명이 그 완성도를 입증하지 않는다.

## 확인 버전과 라이선스

| 대상 | 이번 조사 고정 버전·코드 | 라이선스와 한계 |
|---|---|---|
| React Flow | `@xyflow/react 12.12.0`, SHA `3d35b57317576b0916c0bfeaaedd573aaacc2839`. [고정 package.json](https://github.com/xyflow/xyflow/blob/3d35b57317576b0916c0bfeaaedd573aaacc2839/packages/react/package.json), [공식 릴리스](https://github.com/xyflow/xyflow/releases/tag/%40xyflow%2Freact%4012.12.0) | 본체와 해당 저장소는 [MIT](https://github.com/xyflow/xyflow/blob/3d35b57317576b0916c0bfeaaedd573aaacc2839/LICENSE). 사용·수정·배포 시 저작권·허가 문구 보존 조건을 확인했다. `Expand and Collapse` 고급 예제는 별도 Pro 콘텐츠이므로 MIT 코드로 간주하지 않는다. |
| AntV X6 | `@antv/x6 3.1.7`, 태그 `v3.1.7`을 API로 해석한 SHA `172e9df9c42591c685434b5fa78dbfb37db901ac`. [고정 package.json](https://github.com/antvis/X6/blob/172e9df9c42591c685434b5fa78dbfb37db901ac/package.json), [공식 릴리스](https://github.com/antvis/X6/releases/tag/v3.1.7) | 본체·이번에 읽은 공식 저장소 예제에 대한 [MIT](https://github.com/antvis/X6/blob/172e9df9c42591c685434b5fa78dbfb37db901ac/LICENSE) 확인. 저작권·허가 문구 보존 조건. 별도 외부 템플릿이나 제3자 의존성까지 같은 허가라고 확대하지 않는다. |

React Flow 문서에는 2026-10-11 갱신 표시가 있다. X6 사이트는 3.x로 표시된다. 문서 사이트는 계속 바뀔 수 있으므로 재사용 구현 시에는 위 고정 소스와 API를 다시 맞춘다. X6의 검색·웹 릴리스 표시와 API의 태그 SHA가 달라 보인 부분은 API의 실제 `refs/tags/v3.1.7` 해석 및 해당 SHA의 `version: 3.1.7` 확인을 고정 기준으로 삼았다. 단순 검색 결과의 축약 SHA를 사용하지 않았다.

## React Flow: 확인된 동작과 자체 구현

### 그룹·중첩

**공식 지원:** `Node.parentId`는 부모 기준 상대 위치를 만든다. 부모를 이동하면 자식도 이동한다. 부모는 노드 배열에서 자식보다 먼저 있어야 하며 `extent: 'parent'`로 자식 이동 범위를 제한할 수 있다. 기본 `type: 'group'`은 연결 핸들이 없는 편의 노드다. 일반·사용자 정의 노드를 부모로 쓰는 것도 가능하다. 부모 DOM 안에 자식 DOM을 넣는 구조라는 뜻은 아니다. [Sub Flows 본문](https://reactflow.dev/learn/layouting/sub-flows), [Node API](https://reactflow.dev/api-reference/types/node)

**실제 공개 코드:** `4 → 4b → 4b1/4b2`의 중첩, 외부 `3 → 4b` 연결, 다른 깊이의 `4a → 4b1/4b2`를 함께 선언한다. 따라서 중첩과 경계 밖 연결을 동시에 표현하는 기반이 실제 예제에 있다. [고정 Subflow 예제](https://github.com/xyflow/xyflow/blob/3d35b57317576b0916c0bfeaaedd573aaacc2839/examples/react/src/examples/Subflow/index.tsx)

**자체 구현:** 포함 관계와 의미 관계의 데이터 분리, 부분별 펼침 상태, 상위 관계 미확인/구체화 상태, 접힌 부모의 표시 핸들·레이블은 AgentFlow가 정해야 한다. 부모가 있다고 자식 모두에 관계를 복제하지 않는다.

### 부분 접기

**공식 지원:** `Node.hidden`, `Edge.hidden`은 렌더링 여부를 제어한다. MIT Subflow 예제의 `toggleChildNodes`는 `parentId`가 있는 노드들을 숨김/표시한다. 이것은 전체 자식 표시 토글이며 선택한 한 부분의 독립 접기와 동일하지 않다. [Node API](https://reactflow.dev/api-reference/types/node), [고정 Subflow 예제](https://github.com/xyflow/xyflow/blob/3d35b57317576b0916c0bfeaaedd573aaacc2839/examples/react/src/examples/Subflow/index.tsx)

**별도 예제와 권한:** 공식 [Expand and Collapse](https://reactflow.dev/examples/layout/expand-collapse)는 전체 그래프를 유지하면서 표시할 부분을 정하는 사용자 정의 `useExpandCollapse` 훅과 dagre를 설명한다. 페이지에 `xyflow Pro License`가 명시되어 있다. 공개 설명은 읽었지만 구독 소스는 받지 않았고 복제하지 않았다. [Pro License](https://xyflow.com/pro-license)는 유효 구독을 통해 얻은 콘텐츠의 앱 통합 권리와 독립 예제·템플릿 재배포 제한 등을 구분한다. 본체의 MIT 허가를 Pro 예제에 확장할 수 없다.

**자체 구현:** MIT API만 사용한다면 `collapsedNodeIds`와 조상 상태를 기준으로 가시성을 계산하고, 하위의 독립 접힘 상태를 보존해야 한다. 단순 hidden 토글로 의미 관계 집계까지 해결됐다고 보고할 수 없다.

### 외부 경계 연결과 접기 시 끝점 보존

**공식 지원:** Edge에 `id`, `source`, `target`, `sourceHandle`, `targetHandle`, `data`, `hidden`, `zIndex`가 있다. 자식과 외부 노드 사이의 연결을 표현할 수 있고, 자식을 가진 노드의 간선 표시 순서를 조절할 수 있다. [Edge API](https://reactflow.dev/api-reference/types/edge), [Sub Flows](https://reactflow.dev/learn/layouting/sub-flows)

**확인한 소스의 한계:** 고정 `EdgeWrapper`는 `edge.source/target`으로 원래 노드를 조회하고 해당 위치를 계산한다. 노드가 없거나 위치를 구할 수 없으면 렌더링하지 않는 경로가 있다. 이 부분에는 숨겨진 자식의 간선을 부모의 집계 간선으로 바꾸는 규칙이 없다. 이는 소스의 좁은 정적 확인이며 실제 시안에서 숨김 조합을 실행 검증한 결과는 아니다. [EdgeWrapper 소스](https://github.com/xyflow/xyflow/blob/3d35b57317576b0916c0bfeaaedd573aaacc2839/packages/react/src/components/EdgeWrapper/index.tsx)

**자체 구현:** 표시용 A–B 집계에 원래 relation ID·끝점 목록을 연결한다. 원본 A2–B 등의 source/target을 부모로 덮어쓰지 않는다. 접힌 노드의 기본 group에는 핸들이 없으므로 표시용 연결점·사용자 정의 간선 방식도 설계해야 한다.

**배치 제약:** 공식 배치 문서는 dagre가 그룹 안팎을 연결한 sub-flow 배치에 알려진 문제가 있다고 명시한다. Q03의 A2–B가 바로 그런 종류이므로 Pro 트리 예제나 dagre 적용만으로 해결됐다고 전제하면 안 된다. 이 조사에서 별도 배치 엔진을 추가 채택하지 않았다. [공식 Layouting 안내](https://reactflow.dev/learn/layouting/layouting)

### 선택 상세와 부분 집중

**공식 지원:** `useOnSelectionChange`는 선택 노드·간선 변경을 전달한다. handler를 memoize해야 하며 provider 하위에서 사용한다. `Panel`은 viewport 위에 UI를 위치시키는 도구다. [선택 hook](https://reactflow.dev/api-reference/hooks/use-on-selection-change), [Panel](https://reactflow.dev/api-reference/components/panel)

**자체 구현:** Panel은 AgentFlow용 설명·결정·근거·미결·인계 패널이 아니다. 그 내용, 다중 선택 정책, 접힌 부분의 선택 유지, 현재 경로, 부분 진입/복귀 시 viewport·선택 복원은 제품 구현이 필요하다. NodeToolbar와 같은 보조 UI도 이를 자동 제공하지 않는다.

## AntV X6: 확인된 동작과 자체 구현

### 그룹·중첩

**공식 지원:** `addChild`, `getChildren`, `getDescendants`, 조상 조회 등으로 포함 관계를 구성한다. `embedding` 및 `findParent`로 드래그 중 부모를 찾을 수 있다. `translating.restrict`는 자식 이동 제한에 쓰인다. 간선의 부모는 기본적으로 양 끝점의 공통 부모이며, 부모 이동 때 해당 간선의 vertices를 함께 이동하는 의미다. 이것은 source/target의 의미 변경과 다르다. [Group 설명](https://x6.antv.antgroup.com/en/tutorial/intermediate/group), [공식 embedding-edges 예제](https://github.com/antvis/X6/blob/172e9df9c42591c685434b5fa78dbfb37db901ac/site/examples/node/group/demo/embedding-edges.ts)

**자체 구현:** 드래그로 들어갔다고 사용자 목적의 포함 관계가 확정되었다고 간주할지, 단순 화면 배치인지 구분해야 한다. 그룹 라이브러리의 부모 관계는 AgentFlow의 관계 추론·검증을 수행하지 않는다.

### 부분 접기와 중첩 접힘 상태

**공식 공개 예제:** 사용자 정의 `Group extends Node`가 `collapsed`와 `expandSize`를 보유한다. `node:collapse` 이벤트에서 부모 크기를 줄이거나 복원하고 자식 `hide/show`를 호출한다. 원래 그룹 크기를 기억하므로 펼칠 때 원래 크기로 돌아갈 수 있다. [고정 collapsable.ts](https://github.com/antvis/X6/blob/172e9df9c42591c685434b5fa78dbfb37db901ac/site/examples/node/group/demo/collapsable.ts)

**문서 요약과 실제 코드의 차이:** 설명문의 짧은 코드는 모든 descendants에 hide/show를 적용한다. 그러나 위 고정 전체 예제는 `getChildren()`으로 재귀하며 자식 Group의 `isCollapsed()`를 확인하고, 이미 접힌 하위 그룹 안으로 다시 내려가지 않는다. 따라서 **중첩 접힘 상태를 고려한 재사용 후보가 이미 있다**. 단순 설명문만 보고 그 처리가 없다고 결론 내리면 잘못이다. 같은 처리는 [튜토리얼의 실제 index.tsx](https://github.com/antvis/X6/blob/172e9df9c42591c685434b5fa78dbfb37db901ac/site/src/tutorial/intermediate/group/collapsable/index.tsx)에서도 확인했다.

**자체 구현:** 예제의 private 접힘 상태를 프로젝트 저장·복원과 어떻게 연결할지, 사용자 위치·선택·상위 배치 변화 정책, 접힘 상태를 적용한 연결 집계를 추가해야 한다. 예제를 가져온다고 이런 제품 상태까지 영속 보존된다는 보장은 없다.

### 외부 경계 연결과 끝점 보존

**실제 예제:** collapsable.ts는 `a > aa > aaa`와 `a > c`를 만들고 외부 `d`를 둔 뒤 `c → d`를 선언한다. 즉 중첩·내부 연결·외부 연결을 함께 다룬다. 하지만 접기 handler에는 source/target 재작성, 집계 간선 생성, 실제 끝점 목록 표시가 없다. [고정 예제](https://github.com/antvis/X6/blob/172e9df9c42591c685434b5fa78dbfb37db901ac/site/examples/node/group/demo/collapsable.ts)

**공식 API:** `getSource/Target`, `getSource/TargetCellId`, `getSource/TargetPortId`, `setSource/Target`로 끝점 정보를 다룬다. 표시용 endpoint를 변경할 능력은 있지만 원본 의미를 보존하는 정책은 별도다. `updateTerminalProperties`의 확인한 경로도 원래 terminal의 cell ID로 view를 찾는다. 그 경로에는 자동 집계가 없다. [Edge API](https://x6.antv.antgroup.com/en/api/model/edge), [고정 Edge 모델](https://github.com/antvis/X6/blob/172e9df9c42591c685434b5fa78dbfb37db901ac/src/model/edge.ts), [고정 Edge view](https://github.com/antvis/X6/blob/172e9df9c42591c685434b5fa78dbfb37db901ac/src/view/edge/index.ts)

**자체 구현:** A2·A4·A6 각각의 관계는 원본으로 유지하고 화면용 집계에 매핑해야 한다. 단순 hide/show 뒤 외부 간선이 어떤 모양으로 남는지는 실행 시나리오로 검사해야 하며, 이번 정적 읽기로 해당 렌더링을 통과 처리하지 않는다.

### 선택 상세와 부분 집중

**공식 지원:** 3.1.7의 문서는 `import { Graph, Selection } from '@antv/x6'`와 `graph.use(new Selection(...))`를 제시한다. `selection:changed`, `node:selected`, `edge:selected` 등의 이벤트와 선택된 Cell 목록을 사용할 수 있다. 선택 박스에 부가 내용을 표시하는 API도 있다. [고정 Selection 원문](https://github.com/antvis/X6/blob/172e9df9c42591c685434b5fa78dbfb37db901ac/site/docs/tutorial/plugins/selection.en.md)

**자체 구현:** 선택 박스의 content는 설명·결정·근거를 읽는 상세 공간과 동일하지 않다. 외부 HTML/React UI에 선택 상태를 연결하고, 경로·상위 복귀·관계 목록·집계에서 원래 부분으로 이동하는 동작을 작성해야 한다. 2.x 자료의 별도 플러그인 import를 3.x 코드에 그대로 복사하지 않는다.

## 공통 판단: 줌과 상세 깊이를 분리한다

React Flow의 pan/zoom은 viewport 조작이다. X6의 `zoom`, `zoomTo`, `zoomToFit`도 캔버스 비율·영역을 바꾼다. 이것이 포함 관계의 추가·삭제나 접힘 상태를 의미하지 않는다. [React Flow viewport](https://reactflow.dev/learn/concepts/the-viewport), [X6 고정 Viewport Transformation 문서](https://github.com/antvis/X6/blob/172e9df9c42591c685434b5fa78dbfb37db901ac/site/docs/api/graph/transform.en.md)

**AgentFlow 적용 제안:** `viewport`, `collapsedParts`, `focusedPartId`, `selectedEntityId`를 서로 다른 상태로 둔다. 줌에 따라 글자 밀도·레이블 가독성을 조절할 수는 있지만, 그것으로 A2의 존재나 A2–B 관계를 삭제하지 않는다. 부분 진입은 경로와 외부 관련 B를 유지하는 명시적 행동이어야 한다. 이는 API로부터의 설계 판단이며 두 라이브러리가 그대로 제공하는 완제품 기능이 아니다.

## 접힌 관계의 원래 끝점을 보존하는 최소 계약

아래는 라이브러리 공통 **자체 구현 제안**이다. DB·정식 패치 엔진 설계로 확장하지 않고 다음 작은 시안에 필요한 의미만 정한다.

1. 원본 관계마다 안정된 `relationId`, 원래 `sourceId`, `targetId`, 관계 의미, 근거를 보존한다. 화면을 접을 때 이를 부모 ID로 덮어쓰지 않는다.
2. 표시 단계에서만 숨긴 끝점을 가장 가까운 보이는 조상으로 투영한다. 원본 `A2–B`, `A4–B`, `A6–B`를 표시용 `A–B`에 매핑한다.
3. 집계에는 `memberRelationIds`와 실제 끝점 목록을 둔다. 이번 ‘3곳’은 서로 다른 A 하위 끝점 3개이지 항상 간선 개수와 같은 값이 아니다. 같은 A2–B에 의미가 다른 관계 두 개가 생겨도 ‘4곳’으로 부풀리지 않는다.
4. 서로 다른 관계 의미·방향·미확인 상태를 하나의 선으로 무조건 합치지 않는다. E01의 ‘하위 대상 미확인’ 상위 관계는 E03의 구체화 이력으로 보존하되 네 번째 현재 관계로 세지 않는다.
5. 다시 펼치면 저장된 원본 관계에서 실제 끝점을 복원한다. ‘A와 B 관련’만으로 A1·A3·A5에 새 간선을 만들지 않는다. 관계 목록의 항목을 선택하면 해당 부분을 열고, 같은 원본 B를 참조한다.

## 다음 반복에서 확인할 좁은 장면

이 목록은 아직 수행하지 않은 비교·검증이다. 설치나 라이브러리 채택을 선행 조건으로 삼지 않는다.

| 장면 | 반드시 남아야 하는 정보·동작 | 확인하려는 실패 |
|---|---|---|
| A만 펼치고 B는 큰 구상으로 유지 | A2·A4·A6–B만 연결, 외부 B의 동일 식별자 | 깊이를 맞추려고 B에 가짜 자식 생성, 모든 형제로 과잉 연결 |
| A2의 하위 그룹을 접은 채 A를 접고 다시 펼침 | A2 하위 접힘 상태와 이전 선택을 정책대로 유지 | 부모 펼침이 모든 하위 접힘을 해제 |
| 접힌 A–B 집계 선택 | 실제 세 끝점 이름·관계 의미·근거, 해당 부분으로 이동 | 숫자만 있고 원래 출발점을 찾을 수 없음 |
| 확대 비율만 반복 변경 | 같은 포함·관계·접힘 상태 | 줌을 내리자 관계나 미결 정보가 의미상 삭제됨 |
| A2 집중 뒤 전체 복귀 | 경로, B의 관련 맥락, 직전 viewport·선택 | 다시 전체를 훑어야 하거나 B가 복제됨 |

UI 완성도는 이 장면에서 글자가 읽히는지, 클릭 대상이 겹치지 않는지, 선택과 경로가 일관적인지, 움직임 뒤 같은 부분을 찾는지를 화면으로 확인해야 한다. 관계 보존 계약을 통과하더라도 사람 사용성이나 시각적 완성도가 검증됐다고 보고하지 않는다.

## 회수 결과와 한계

- 재사용 후보: React Flow의 중첩·경계 연결·선택 hook·Panel, X6의 포함 관계·선택 이벤트·중첩 접힘을 고려한 공개 예제.
- 반드시 별도 구현: 표시용 집계와 원래 끝점 대응, 미확인/구체화 이력, 부분 진입의 문맥·복귀, AgentFlow 상세 패널과 제품의 시각적 규칙.
- 읽기 범위: 공식 문서 본문·공식 저장소의 관련 파일만. 검색 snippet은 탐색에만 사용했다. X6 선택/viewport 웹 페이지의 재조회가 timeout인 경우 해당 고정 저장소 Markdown 원문으로 확인했다.
- 미실행: 라이브러리 설치, 예제 재현, 접기 왕복 자동 검사, 렌더링·접근성·성능·사람 사용성 검증. 이번 결과를 채택 완료나 구현 성공으로 표현하지 않는다.
