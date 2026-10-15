# 계층 탐색 근거 독립 확인

2026-10-15 yEd 공식 「Grouping Support」 본문을 직접 확인했다. 아래는 문서 확인이며 실제 앱 실행 검증은 아니다.

- **확인됨:** 그룹을 열면 자식 노드·간선이 그룹 경계 안에 나타나고, 서로 다른 계층에 걸친 간선도 전체 연결로 표현된다. 닫을 때 기존 연결은 그룹을 끝점으로 하는 간선으로 대표되며, 다시 열거나 그룹을 풀면 원래 간선이 복원된다고 명시한다.
- **확인됨:** 그룹 더블클릭은 `View Group Content`를 실행한다. `Previous View`는 그 진입 명령을 실행했던 계층의 보기로 돌아간다. `Structure View`는 전체 노드 계층, `Overview`는 현재 주 화면에 표시되는 그래프 전체를 보여준다. 따라서 전체 구조와 현재 화면의 축소판은 서로 다른 역할이다.
- **근거의 한계:** 이전 선택·스크롤·확대율까지 복원한다는 보장은 이 문서에 없다. 대표 간선에 실제 끝점 수·목록을 표시하거나 내부 진입 중 외부 연결 참조를 남긴다는 설명도 없다. AgentFlow의 ‘A2/A4/A6 정확히 3개’ 및 ‘직전 전체 보기 상태 복원’은 별도 설계·검증이 필요하다. 기존 간선 보존을 부모 관계에서 자식 관계를 자동 추론하는 기능으로 해석하면 안 된다.

Blender 자료는 Pro가 사용한 **2.90 Outliner / 4.1 Local View 문서 기반 보조 참고**로만 분류한다. 최신 버전 직접 검증이나 이번 독립 확인의 결과로 표시하지 않는다. yFiles Folding 데모 기능 또한 yEd에서 확인한 기능과 합치지 않는다.

출처: [yEd 공식 Grouping Support](https://yed.yworks.com/support/manual/hierarchy.html) — Concepts, Node Hierarchy Features, The Menu Bar, Using the Node Hierarchy Features.
