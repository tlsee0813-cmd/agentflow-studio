# 구조를 단정하지 않는 공간 읽기 — 좁은 메커니즘 판단

2026-10-16 · cycle03 작성 중 받은 연구 입력. 현재 배정·진행은 [ACTIVE](../ACTIVE.md). [Pro 반환](https://chatgpt.com/c/6ad0ec53-18e8-83ee-80c6-7b95b2dc8239)을 총괄이 요약하고 내부 Astra/Sol의 원문 대조로 범위를 좁혔다. 실제 Bloom·Archi 조작, 사람 관찰, 이 연구만으로 시안 합격 판정은 하지 않았다.

## 이번 선택에 주는 판단

FIX058은 변경의 영향 영역을 보고하지만 프로그램의 모듈 포함 구조를 입증하지 않는다. 따라서 이번 좁은 시안의 공간은 **문서가 보고한 변경과 관련 부분을 읽는 보기**로 취급한다. 이는 최종 AgentFlow를 영향 지도만으로 확정하거나 실제 구조 연구를 포기하는 결정이 아니다.

이름 네 개를 카드로 배치하는 것만으로 공간의 효용이 생기지 않는다. 반대로 큰 상자 안에 넣거나 방향선을 잇는 것만으로 존재하지 않는 부모·자식·실행 순서를 만들어서도 안 된다. 선택했을 때 그 부분에서 유지/변경된 내용과 관련 영역을 짧게 읽고, 상세를 닫으면 원래 맥락이 이어지는지를 이번 시안에서 본다.

## 가져올 원리와 가져오지 않을 주장

| 비교 대상 | 직접 근거가 지원하는 좁은 메커니즘 | 총괄의 적용 판단과 경계 |
|---|---|---|
| Neo4j Bloom | 선택 노드와 이웃을 남겨 범위를 줄임. Expand는 직접 이웃을 더하고 Reveal은 선택 노드 사이의 숨은 기존 직접 관계를 보임. Scene 복제·전환·자동 저장을 문서가 설명 | 집중은 관련 범위를 살펴보는 보기로 참고. 자동 저장을 집중 전 상태의 자동 복원으로 해석하지 않음. 원래 보기 보존을 위해 사용자에게 Scene 복제/저장을 숙제로 요구하지 않음 |
| Archi | 시각 Group과 의미 있는 Grouping, 도식 연결과 모델 관계의 구분. 같은 모델 요소를 View에서 재사용 | 보기용 배치와 대상 정체성·관계 의미를 구분하는 원리를 참고. 상자에 ‘보기용’이라고 써 두기만 하면 오독이 해결됐다고 보지 않음. Group 동작을 하위 집중/복귀의 완성 사례로 확대하지 않음 |

Bloom의 다중 Scene은 문서상 plugin 배포 조건이 있으며, Scene은 노드·관계 ID에 의존한다. ID 재사용으로 저장 Scene의 표시가 어긋날 수 있다는 경고를 모든 DB 변경의 오류로 확대하지 않았다. 선택·키보드 초점·확대율의 정확한 복원은 해당 공식 두 문서에서 확인하지 못했다. 원본 Scene을 복제한 뒤 좁히고 원본으로 전환하는 조합도 문서 기반 재구성이며 실제 조작 결과가 아니다.

같은 Scene에서 숨긴 상태도 자동 저장될 수 있으므로 ‘자동 저장이 있다 → 닫으면 원래 보기가 복원된다’는 추론은 채택하지 않는다. 이 차이는 기존 VS Code 조사에서 초점 복귀와 전체 지도 복원을 구별한 원칙과도 이어진다.

Archi의 Group에 모델 의미가 없다는 것과 아무 연결선도 허용하지 않는다는 것은 다르다. 고정 코드의 일반 도식 연결은 Group을 끝점으로 허용한다. 가져올 원리는 선을 없애는 규칙이 아니라 어떤 선이 보기 설명이고 어떤 선이 모델 관계인지 구별하는 것이다. 같은 모델의 여러 표현 지원 역시 우리 시안의 대상 동일성·복귀 보존을 보증하지 않는다.

## 시안에서 볼 것

1. 홈·작업문·다음 요청·복구가 왜 함께 있는지, 그 부분에서 무엇이 유지되고 달라졌는지 상세 원문 없이 읽을 수 있는가. 미확인 관계를 실제 모듈 구조로 채우거나 선이 없는 것을 무관함으로 처리하지 않는가.
2. 한 부분 선택이 단지 긴 카드 확대가 되는가, 아니면 관련 부분과 변경 의미를 남기는가. 의미 과장을 피하려고 모든 연결 단서까지 없애지 않았는가.
3. 근거 닫기와 전체 복귀가 구별되며, 원래 선택·다른 펼침·위치·초점이 이어지는가. 상태값 보존과 사람의 재탐색 감소는 별도 관측이다.

이는 새 엔진·여러 Scene 관리·추가 시안의 개발 목록이 아니다. Opus 첫 화면을 받은 뒤 문제가 실제로 보이는 부분만 수정한다. 이번 입력만으로 실제 갱신·이름 조정·인계 수신을 입증할 수 없다는 [제품 관점 사전 점검](PRODUCT_PRECHECK.md)의 한계도 유지한다.

## 근거와 독립 대조

- Bloom: [Scene interactions](https://neo4j.com/docs/bloom-user-guide/current/bloom-visual-tour/bloom-scene-interactions/), [Scenes and sharing data](https://neo4j.com/docs/bloom-user-guide/current/bloom-tutorial/export-data/), [Astra 원문 대조](BLOOM_SOURCE_AUDIT.md). current 문서라 고정 제품 버전의 관측이 아니다.
- Archi 고정 커밋 `9477a9716010156313db39bbfc68c23138d3762a`: [Adding a Group](https://github.com/archimatetool/archi/blob/9477a9716010156313db39bbfc68c23138d3762a/com.archimatetool.help/help/Text/view_group.html), [Adding existing elements](https://github.com/archimatetool/archi/blob/9477a9716010156313db39bbfc68c23138d3762a/com.archimatetool.help/help/Text/view_addexisting.html), [연결 정책](https://github.com/archimatetool/archi/blob/9477a9716010156313db39bbfc68c23138d3762a/com.archimatetool.editor/src/com/archimatetool/editor/diagram/policies/ArchimateDiagramConnectionPolicy.java), [Sol 원문 대조](ARCHI_SOURCE_AUDIT.md).
