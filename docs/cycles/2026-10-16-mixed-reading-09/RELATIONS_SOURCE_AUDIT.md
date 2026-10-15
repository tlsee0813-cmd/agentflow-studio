# cycle09 관계 참고 방식 — ProB 원문 감사

공식 설명과 고정 소스를 직접 읽었다. 실제 VS Code/확장 실행, 데모 재현, 사람 평가, 이미지 회수는 하지 않았다. 총괄의 공식 VS Code 이미지 열람은 별도 관측이며 이 감사의 직접 이미지 관측으로 합치지 않는다.

## VS Code Peek: 참고와 이동의 구분은 확인, 우리 선택 보존은 추론

[공식 Peek 설명](https://code.visualstudio.com/docs/editing/editingevolved#_peek)은 결과를 편집기 안에 표시하고 그 안에서 다른 참조를 살피거나 편집할 수 있다고 설명한다. 파일명 또는 결과 목록의 더블클릭은 바깥 편집기로 여는 행동이다. 닫기 동작에는 설정 조건도 있다. 따라서 참고와 본격 이동을 구별하는 사례로는 적합하지만, Peek 자체가 읽기 전용이거나 모든 선택을 고정하는 장치라는 해석은 틀리다.

고정 `4849ca9bdf9666755eb463db297b69e5385090e3`의 [package.json L3](https://github.com/microsoft/vscode/blob/4849ca9bdf9666755eb463db297b69e5385090e3/package.json#L3)은 **1.93.0**이다. 현행 공식 페이지와 이 과거 고정본을 같은 버전의 실행 증거로 취급하지 않는다.

[referencesWidget.ts L384–401](https://github.com/microsoft/vscode/blob/4849ca9bdf9666755eb463db297b69e5385090e3/src/vs/editor/contrib/gotoSymbol/browser/peek/referencesWidget.ts#L384-L401)은 `sideBySide`이면 side, pinned이면 goto, 나머지는 show로 구분하며, show에서 `_revealReference`를 호출하고 각 종류의 이벤트를 보낸다. 이 파일 구간만으로 이벤트 소비자의 전체 이동/복귀 결과까지 입증하지 않는다. 같은 파일 [L508–553](https://github.com/microsoft/vscode/blob/4849ca9bdf9666755eb463db297b69e5385090e3/src/vs/editor/contrib/gotoSymbol/browser/peek/referencesWidget.ts#L508-L553)에서는 참고 대상·제목·트리 노출·미리보기 모델/선택이 실제로 갱신된다.

**적용 판단:** ‘C32를 작업 대상으로 유지하면서 C21은 관계 참고창에서 확인’은 이 분리 원리를 빌린 우리 설계다. 참고창 안의 대상 변경과 바깥 지도 선택·준비 대상 변경을 따로 취급한다는 계약이 필요하다. VS Code 소스가 C32 선택, 준비 편집, 지도 좌표·초점의 정확 복귀를 보장한다는 주장은 하지 않는다.

## Cytoscape: 접힌 끝점과 복수 관계 묶기는 다른 자료

고정 `e01588bec1f31c76046faa6fb681eee37b78334e`의 [README Elements Style](https://github.com/iVis-at-Bilkent/cytoscape.js-expand-collapse/blob/e01588bec1f31c76046faa6fb681eee37b78334e/README.md#elements-style)은 접힌 노드와 연결되는 meta edge, 복수 선을 접은 collapsed edge를 별도 클래스로 구분한다. 설명만으로 두 종류를 한 ‘집계 관계’로 뭉개면 안 된다.

- [소스 L581–648](https://github.com/iVis-at-Bilkent/cytoscape.js-expand-collapse/blob/e01588bec1f31c76046faa6fb681eee37b78334e/src/expandCollapseUtilities.js#L581-L648): 노드의 자손과 외부 사이 원래 선의 양끝을 `originalEnds`에 저장한 뒤, 화면상 끝점을 접힌 노드로 옮긴다. 복구에서는 원래 끝점 또는 아직 보이는 조상을 찾고, 양끝이 원래 대상으로 돌아오면 meta 표시와 보관값을 제거한다. 이는 원래 선 하나의 **실제 끝점과 현재 표시 끝점**을 구별하는 방식이다.
- [소스 L683–758](https://github.com/iVis-at-Bilkent/cytoscape.js-expand-collapse/blob/e01588bec1f31c76046faa6fb681eee37b78334e/src/expandCollapseUtilities.js#L683-L758): 별도의 선 접기 경로는 두 개 이상인 선 그룹에서 새 선을 만들고, 원래 선들을 `collapsedEdges`에 담는다. 방향·유형도 처리한다. **`collapsedEdges`는 원래 양끝 한 쌍이 아니라 원래 선들의 모음**이다. 또한 시작 부분이 `edges.unselect()`이므로 선택 보존을 이 구현의 보장으로 인용할 수 없다.

**적용 판단:** cycle05의 단건 관계/복수 관계 확인 분기를 재사용하는 추천은 타당하다. 단건은 원래 관계와 끝점을 바로 확인하고, 복수는 각 원래 관계의 조건·양끝을 잃지 않아야 한다. C21을 참고했다고 C32의 변경 소유·준비 범위를 바꾸지 않는 것은 우리 계약이다. 새 SDK나 엔진을 도입해야 한다는 결론도 아니다. 위 코드만으로 복잡한 모든 접힘 순서의 무결성이나 정확한 화면 복귀 성공을 입증하지 않는다.

## 이슈 자료의 한계와 결론

[이슈 #128](https://github.com/iVis-at-Bilkent/cytoscape.js-expand-collapse/issues/128) 본문은 2021년 제보자가 선/노드 접기를 조합한 뒤 예외·선 소실·잘못된 끝점을 보고한 자료다. 전후 그림 링크와 재현 단계가 존재함을 본문에서 확인했지만 그림 자체는 이번에 열람하지 않았고 재현도 하지 않았다. 현재 고정본에서 결함이 재현된다는 증거, 또는 선택·준비·복귀가 보존된다는 증거로 쓰지 않는다.

ProB를 **관계 참고 대상과 작업 대상을 분리하는 후보**로 수용할 근거는 있다. 수용 범위는 참고/이동 구분과 실제 끝점/복수 선의 자료 구분까지다. 현재 시안의 성공, 원래 선택의 불변, 사람의 혼합 깊이 이해를 외부 제품에서 빌려 확정하지 않는다.

