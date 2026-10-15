# 공간·탐색 메커니즘 원문 대조

판정: 세 사례의 핵심 구현은 대체로 맞지만, ‘상태를 보존하며 제자리에서 읽는다’ 또는 ‘이미 있으므로 바로 도입한다’는 결론은 과장이다. 지정한 SHA의 여섯 코드·README 파일을 GitHub connector로 직접 읽었다. 이 문서는 선택·연결·접기·복귀 조건의 정적 대조이며, 프로젝트 전체 감사나 실행 검증은 아니다. 라이선스 적합성, 현재 제품의 성능, 사람의 탐색 효율도 판정하지 않았다. 아래의 ‘맞음’은 해당 버전의 명시된 분기에 한정한다.

## 1. Dify — 선택 강조와 옆 패널은 확인되지만, Escape는 선택 보존이 아니다

**맞음.** `handleNodeSelect`는 모든 노드를 돌며 대상 하나만 선택하고, 노드 본체와 데이터의 선택 필드를 함께 바꾼다. 지정 노드와 연결된 간선에는 선택 연관 플래그를 켜고 나머지 간선에서는 끈다. 다만 이 파일이 직접 간선을 그리는 것은 아니다. 그러므로 정확한 표현은 ‘선택과 간선 강조용 상태를 동기화한다’이며, 실제 색상·가독성이나 강조 범위가 사용자에게 적절하다는 평가는 별도다. 클릭 진입부도 댓글 모드, 노트 링크 클릭, 반복·루프 시작 노드, 빈 데이터소스에는 같은 선택 처리를 적용하지 않는다. [선택 처리 449–495행](https://github.com/langgenius/dify/blob/f7840ab2134bbc0b34ca4a58a47381fbbf2d1e35/web/app/components/workflow/hooks/use-nodes-interactions.ts#L449-L495)

**맞음, 조건 있음.** `handleNodeConnect`는 source와 target의 `parentId`가 다르면 간선을 추가하기 전에 반환한다. 연결 종료 경로에도 같은 수준 검사가 있다. 양쪽 parentId가 없는 최상위 노드는 이 비교만으로 금지되지 않는다. 자기 연결, 읽기 전용, 노트 노드, 동일 핸들의 중복 연결도 별도 차단된다. 따라서 이 사례는 계층 경계를 넘는 연결을 자유롭게 유지하는 근거가 아니라, 워크플로의 같은 부모 범위 안에서 편집을 제한하는 사례다. 데이터상 관계가 존재한다는 것과 편집기가 생성하도록 허용한다는 것도 구분해야 한다. [연결 생성 499–571행](https://github.com/langgenius/dify/blob/f7840ab2134bbc0b34ca4a58a47381fbbf2d1e35/web/app/components/workflow/hooks/use-nodes-interactions.ts#L499-L571), [연결 종료 621–632행](https://github.com/langgenius/dify/blob/f7840ab2134bbc0b34ca4a58a47381fbbf2d1e35/web/app/components/workflow/hooks/use-nodes-interactions.ts#L621-L632)

**Escape 주장은 맞지만 보존 해석은 수정 필요.** 패널 내부의 일반 Escape가 도달하면 해당 DOM 노드를 찾아 `focus({preventScroll:true})`한 다음 `handleNodeSelect(id,true)`를 호출한다. 이미 처리된 이벤트, IME 조합, Alt/Ctrl/Meta 조합, 패널 외부 대상은 제외한다. 두 번째 인자는 선택 취소이므로 모든 노드 선택과 관련 간선 강조가 해제된다. 노드를 찾지 못해도 선택 취소는 실행된다. preventScroll은 이 focus 요청의 자동 스크롤을 억제하는 옵션이지, 이전 선택·pan·zoom·패널 스크롤을 저장했다 복구하는 장치가 아니다. 자식 컨트롤이 Escape를 소비할 여지도 명시돼 있어 언제나 즉시 닫힌다고도 단정할 수 없다. [패널 키 처리 209–232행](https://github.com/langgenius/dify/blob/f7840ab2134bbc0b34ca4a58a47381fbbf2d1e35/web/app/components/workflow/nodes/_base/components/workflow-panel/index.tsx#L209-L232)

**패널 폭 보존은 부분적으로 맞음.** 사용자 resize는 저장 훅을 호출하고 store 폭을 갱신한다. 반면 화면 및 다른 패널의 폭에 따라 시스템이 압축한 값은 저장 훅을 호출하지 않는다. 최소 폭과 캔버스 예약 폭도 각각400으로 설정한다. 이는 사용자 선호 폭과 현재 가능한 폭을 구별하는 참고점이다. 그러나 저장 훅 내부나 재실행 복원은 이번 대조에서 추적하지 않았으므로, 모든 화면에서 같은 폭이 유지된다거나 390 화면에도 그대로 적합하다고 주장하지 않는다. [폭 관리 150–207행](https://github.com/langgenius/dify/blob/f7840ab2134bbc0b34ca4a58a47381fbbf2d1e35/web/app/components/workflow/nodes/_base/components/workflow-panel/index.tsx#L150-L207)

## 2. Cytoscape expand-collapse — 원래 끝점 보관과 화면 상태 보존을 분리해야 한다

**맞음.** 지정 README는 새 통합 프레임워크 개발을 이유로 해당 저장소를 더 이상 유지보수하지 않는다고 고지한다. 이는 그 SHA에서 확인한 문서 사실이며, 다른 프레임워크의 준비 상태나 대체품 적합성까지 확인한 것은 아니다. ‘검증된 현행 선택지이므로 바로 사용’이라는 추천에는 이 제한을 반드시 붙여야 한다. [README 고지](https://github.com/iVis-at-Bilkent/cytoscape.js-expand-collapse/blob/e01588bec1f31c76046faa6fb681eee37b78334e/README.md#L1-L8)

**원래 끝점 보존 주장은 맞음.** `barrowEdgesOfcollapsedChildren`은 접힐 자손과 외부 노드 사이 간선을 찾고, 원래 간선이면 source/target 노드 객체를 `originalEnds`에 보관한다. 이어 자손 쪽 실제 간선 끝을 접힌 부모로 이동시킨다. 따라서 원래 관계의 추적 정보와 현재 화면에서 사용하는 끝점은 서로 다르다. 데이터 객체가 같은 자리에서 전혀 변하지 않는다는 설명은 틀리다. 이미 meta edge인 경우 원래 끝점을 다시 덮어쓰지 않는 조건도 있다. 이 메타데이터만으로 부모가 원래 관계의 의미적 소유자가 되지는 않는다. [끝점 보관·이동 581–613행](https://github.com/iVis-at-Bilkent/cytoscape.js-expand-collapse/blob/e01588bec1f31c76046faa6fb681eee37b78334e/src/expandCollapseUtilities.js#L581-L613)

**복구는 가시 구조에 따라 조건적이다.** `repairEdges`는 원래 노드가 아직 그래프 안에 없으면 `findNewEnd`로 현재 보이는 조상을 찾는다. 양쪽 끝이 원래 노드까지 돌아왔을 때에만 meta 표시와 `originalEnds`를 제거한다. 중첩 접힘에서 한 번 펼쳤다는 이유만으로 모든 실제 자식 끝점이 바로 나타난다고 읽으면 안 된다. 이 기법은 ‘표시상 대리 끝점과 실제 끝점을 구별한다’는 설계 근거가 될 수 있지만, AgentFlow의 실제 끝점 목록·미결 소유 표시가 자동으로 해결된다는 증거는 아니다. [복구 615–649행](https://github.com/iVis-at-Bilkent/cytoscape.js-expand-collapse/blob/e01588bec1f31c76046faa6fb681eee37b78334e/src/expandCollapseUtilities.js#L615-L649)

**선택·배치·시점 보존 주장은 과장.** `collapseNode`는 자식과 연결 간선을 선택 해제한다. 펼침에서는 접힌 노드의 이동 차이만큼 자식을 옮기며, 종료 단계에 재배치 함수를 호출한다. 단일 노드를 fisheye로 펼치고 필요한 공간이 부족하면 fit viewport를 계산해 pan/zoom도 바꾼다. README 역시 layout·fisheye·animation 옵션을 제시한다. 그러므로 원래 끝점 추적을 전체 mental map 보존과 같은 것으로 취급하면 안 된다. 여기서는 옵션별 실제 움직임, 대규모 그래프 성능, 선택 복원 경험을 실행해 확인하지 않았다. [선택 해제 309–334행](https://github.com/iVis-at-Bilkent/cytoscape.js-expand-collapse/blob/e01588bec1f31c76046faa6fb681eee37b78334e/src/expandCollapseUtilities.js#L309-L334), [조건부 시점 변경 249–301행](https://github.com/iVis-at-Bilkent/cytoscape.js-expand-collapse/blob/e01588bec1f31c76046faa6fb681eee37b78334e/src/expandCollapseUtilities.js#L249-L301)

## 3. VS Code Peek — 미리보기, 실제 이동, 초점 복귀는 별개다

**URI 기반 원본 참조 주장은 맞음.** `_revealReference`는 참조의 URI로 모델을 구하고 range를 미리보기 선택과 중앙 표시의 기준으로 사용한다. 트리도 해당 파일 부모를 펼치거나 참조를 드러낸다. 이는 원본 문서 위치와 연결된 내장 편집기 미리보기다. 임의 복제 텍스트를 별도 메모로 보여주는 방식과는 구분된다. 다만 동일 참조 객체를 이미 드러낸 경우에는 다시 처리하지 않으며, 모델이 없으면 대체 메시지를 보여준다. URI·range라는 주소 체계가 AgentFlow 사건의 동일성·버전·미결 소유를 대신 정의하지는 않는다. [미리보기 558–606행](https://github.com/microsoft/vscode/blob/f20a64b96be4f2b10d7cd2703efb2fc85afaac18/src/vs/editor/contrib/gotoSymbol/browser/peek/referencesWidget.ts#L558-L606)

**제자리 Peek와 실제 이동 구별도 맞음.** 트리의 show는 내부 미리보기를 갱신하지만, pinned 선택이나 side 동작은 다른 경로로 전달된다. `openReference`는 URI/range를 실제 편집기 열기에 넘기며, sideBySide가 아니면 먼저 Peek를 닫는다. 또한 stablePeek 설정은 편집기 쪽 open 이벤트의 닫힘에 영향을 주고, peekMode의 goto는 실제 편집기를 연 뒤 같은 편집기에 위젯을 다시 보이거나 다른 controller로 넘길 수 있다. 따라서 모든 클릭을 ‘제자리 읽기’라고 묶거나, goto를 언제나 단순 패널 닫기로 설명하면 조건을 잃는다. [이벤트 분기 119–141행](https://github.com/microsoft/vscode/blob/f20a64b96be4f2b10d7cd2703efb2fc85afaac18/src/vs/editor/contrib/gotoSymbol/browser/peek/referencesController.ts#L119-L141), [실제 열기 248–303행](https://github.com/microsoft/vscode/blob/f20a64b96be4f2b10d7cd2703efb2fc85afaac18/src/vs/editor/contrib/gotoSymbol/browser/peek/referencesController.ts#L248-L303)

**초점 복귀를 전체 상태 복구로 해석하면 과장.** `closeWidget`은 위젯과 참조 모델을 dispose하고 요청을 취소하며, 기본 인자가 참이면 편집기에 초점을 준다. 확인한 저장 항목은 Peek의 분할 비율·높이 같은 layout data다. 전체 탐색 경로, 이전 선택, 문서 스크롤, 접힌 계층, 지도 pan/zoom을 하나의 스냅샷으로 되돌리는 코드는 이 경로에 없다. VS Code 전체에 탐색 이력이 없다는 뜻도 아니다. 이 두 파일만으로 AgentFlow에 필요한 복귀 계약까지 검증했다고 볼 수 없다는 뜻이다. [닫기 235–245행](https://github.com/microsoft/vscode/blob/f20a64b96be4f2b10d7cd2703efb2fc85afaac18/src/vs/editor/contrib/gotoSymbol/browser/peek/referencesController.ts#L235-L245), [레이아웃 저장 99–108행](https://github.com/microsoft/vscode/blob/f20a64b96be4f2b10d7cd2703efb2fc85afaac18/src/vs/editor/contrib/gotoSymbol/browser/peek/referencesController.ts#L99-L108)

## 선택에 주는 결론

‘전체 지도+옆 읽기 우선’은 검증할 설계 가설로 유지할 수 있다. 세 사례는 선택과 관련선의 연계, 원래 끝점과 표시 끝점의 분리, 미리보기와 실제 이동의 명시적 구별에 각각 근거를 준다. 그러나 선택을 유지할지 해제할지, 접힌 대상을 읽을 때 무엇을 펼칠지, 닫기와 보기 복귀가 같은지부터 AgentFlow가 직접 정해야 한다. 좁은 화면에서는 옆 패널보다 분리 집중 화면이 나을 가능성도 이번 원문 대조로 배제되지 않는다.

따라서 두 안을 비교할 때는 관계 소유자를 잘못 읽는지, 원래 끝점에 도달하는지, 이전 선택·접힘·목록 위치가 돌아오는지를 같은 과제로 확인해야 한다. 복귀 버튼은 저장할 상태 항목과 실패 시 동작을 명시해야 하며, 단순 focus 호출을 그 대체물로 쓰지 않는다. 코드 메커니즘을 참고할 수 있다는 결론과 해당 라이브러리·제품 구현을 즉시 도입할 수 있다는 결론은 분리한다. 이번 대조에서는 도입, 구현, 라이선스 법적 판단 또는 원격 변경을 하지 않았다.
