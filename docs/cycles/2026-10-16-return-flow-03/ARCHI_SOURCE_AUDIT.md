# cycle03 — Archi 고정 소스 독립 대조

2026-10-16. 검토자: Sol. 지정된 공식 저장소의 도움말 2개와 정책 코드 1개만 읽었다. 모든 근거는 `archimatetool/archi`의 커밋 `9477a9716010156313db39bbfc68c23138d3762a`에 고정했다. 실제 Archi UI 실행·우리 앱 구현 검증은 하지 않았다.

판정: Pro의 핵심 구분은 지지된다. 다만 **시각 Group에 의미가 없다는 설명을 연결 자체가 불가능하다는 뜻으로 넓히면 틀린다.** 이 사례는 우리 앱의 복귀 보존이나 자동 관련성 판단이 이미 검증됐다는 근거가 아니다.

| 대조 항목 | 고정 근거와 좁은 판정 |
| --- | --- |
| 시각 Group과 의미 있는 Grouping element 구분 | [view_group.html 14행](https://github.com/archimatetool/archi/blob/9477a9716010156313db39bbfc68c23138d3762a/com.archimatetool.help/help/Text/view_group.html#L14)은 두 종류를 구분하고 시각적 묶음 외 의미가 없다고 명시한다. 그러나 [정책 323–343행](https://github.com/archimatetool/archi/blob/9477a9716010156313db39bbfc68c23138d3762a/com.archimatetool.editor/src/com/archimatetool/editor/diagram/policies/ArchimateDiagramConnectionPolicy.java#L323-L343)은 일반 diagram connection의 한쪽 끝이 Group이면 허용한다. 따라서 ‘묶었다고 모델 의미 관계가 생기지 않는다’는 지지되지만 ‘Group에는 어떤 선도 연결할 수 없다’는 반박된다. |
| 동일 모델 요소 재사용과 개별 표현 | [view_addexisting.html 25–29행](https://github.com/archimatetool/archi/blob/9477a9716010156313db39bbfc68c23138d3762a/com.archimatetool.help/help/Text/view_addexisting.html#L25-L29)은 같은 모델의 어느 View에도 기존 요소·관계를 추가할 수 있고, 같은/다른 View에 여러 번 나타나며 각 표현의 외관을 개별 설정할 수 있다고 명시한다. 새 모델 요소를 매번 복제한다는 설명은 아니다. 단, 이 도움말만으로 모든 변경 전파·상태 격리 규칙까지 확인한 것은 아니다. |
| Group 더블클릭 | [view_group.html 27–29행](https://github.com/archimatetool/archi/blob/9477a9716010156313db39bbfc68c23138d3762a/com.archimatetool.help/help/Text/view_group.html#L27-L29)은 속성창을 연다고 설명한다. 이 동작을 ‘하위 공간 집중 진입’의 선례로 제시할 수 없다. 도움말에 적힌 동작을 확인했으며 실행 관측은 아니다. |
| 일반 연결과 ArchiMate 모델 관계 분기 | [getConnectionCreateCommand 51–68행](https://github.com/archimatetool/archi/blob/9477a9716010156313db39bbfc68c23138d3762a/com.archimatetool.editor/src/com/archimatetool/editor/diagram/policies/ArchimateDiagramConnectionPolicy.java#L51-L68)은 일반 연결과 ArchiMate 컴포넌트 출발 명령을 구분한다. [isValidConnectionSource 298–314행](https://github.com/archimatetool/archi/blob/9477a9716010156313db39bbfc68c23138d3762a/com.archimatetool.editor/src/com/archimatetool/editor/diagram/policies/ArchimateDiagramConnectionPolicy.java#L298-L314), [isValidConnection 323–366행](https://github.com/archimatetool/archi/blob/9477a9716010156313db39bbfc68c23138d3762a/com.archimatetool.editor/src/com/archimatetool/editor/diagram/policies/ArchimateDiagramConnectionPolicy.java#L323-L366)은 연결 유형·끝점에 따라 일반 연결 허용 또는 모델 관계 유효성 검사로 분기한다. 이는 주어진 모델 관계의 허용 여부 검사이며 문서 내용에서 관련성을 추론하는 코드라는 근거가 아니다. `relationshipType == null`인 Magic connector 특례도 있어 모든 경로가 즉시 같은 유효성 함수를 호출한다고 요약하면 과장이다. |

## cycle03에 적용할 때 남는 경계

- **자동 관련성:** [view_addexisting.html 17–21행](https://github.com/archimatetool/archi/blob/9477a9716010156313db39bbfc68c23138d3762a/com.archimatetool.help/help/Text/view_addexisting.html#L17-L21)의 자동 연결 추가는 모델에 이미 존재하는 관계를 View에 표시하는 동작이다. 문서의 공간적 근접성이나 요약에서 새 의미 관계·작업 소유를 자동 판정해도 된다는 근거가 아니다.
- **동일성과 변경 전파:** 여러 표현의 독립 외관은 모델 관계 변경까지 독립이라는 뜻이 아니다. 같은 정책의 [178–218행](https://github.com/archimatetool/archi/blob/9477a9716010156313db39bbfc68c23138d3762a/com.archimatetool.editor/src/com/archimatetool/editor/diagram/policies/ArchimateDiagramConnectionPolicy.java#L178-L218)은 관계를 참조하는 여러 연결을 순회하며 조건에 따라 같은/다른 View의 연결을 다시 연결하거나 삭제하는 명령을 구성한다. 우리 앱에서 같은 기록을 여러 위치에 보여 줄 때 동일 객체 식별과 관계 소유, 표시별 상태 보존은 별도로 설계·검증해야 한다.
- **복귀:** 읽은 세 파일은 우리 흐름의 선택·읽기 위치·펼침 깊이·지도 위치 복원을 보장하지 않는다. Group 속성창 동작이나 View 재사용을 실제 복귀 성공으로 보고하지 않는다. cycle03의 두 화면 크기에서 닫힘·반복·전체 복귀 관측이 여전히 필요하다.

코드 수정, 테스트 실행, 환경 변경, 원격 쓰기 없음. Pro의 다른 사례나 저장소 전체의 동작·라이선스는 이번 대조 범위에 포함하지 않았다.
