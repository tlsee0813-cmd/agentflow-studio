# cycle09 개요·상세 분리 원문 감사

2026-10-16 공식 문서 2개와 지정 고정 코드만 읽었다. 서비스/데모 조작·GIF 열람·구현·동작 성공 검증은 하지 않았다. 버전 문서 및 현행 Perfetto 문서가 각 고정 커밋의 실제 배포와 동일한지는 확인하지 않았다.

**JupyterLab:** [4.2.x ToC 문서](https://jupyterlab.readthedocs.io/en/4.2.x/user/toc.html)(현재 제목 4.2.7)는 항목 클릭 시 문서의 해당 제목으로 스크롤한다고 설명한다. 목차 접기와 notebook 셀 접기 동기화는 `syncCollapseState=true`일 때의 별도 설정이며 문서 종류에 따라 설정 효과도 다르다. 따라서 “목차를 접으면 항상 본문도 접힘”은 과장이다. [고정 tocitem.tsx 43–83행](https://github.com/jupyterlab/jupyterlab/blob/96b01c8237e74977203a7c3cea17ee0b5fe733ce/packages/toc/src/tocitem.tsx#L43-L83)은 제목의 prefix/text를 항상 렌더하고, 자식 `<ol>`만 `children && !heading.collapsed`로 조건부 렌더한다. 접혀도 해당 제목이 남고 하위 항목이 숨는다는 주장은 정확하다. 제목 영역의 `onMouseDown(heading)`과 접기 버튼의 `onCollapse(heading)` 콜백은 분리돼 있지만 이 파일 자체가 스크롤·동기화·진입 전 위치 복원을 구현하지는 않는다. 실제 이벤트 간 동작까지 실행 확인한 것은 아니다.

**Perfetto:** [공식 UI 문서의 Track Event Selections/Pinning Tracks](https://perfetto.dev/docs/visualization/perfetto-ui#track-event-selections)는 이벤트 선택으로 Current Selection 상세를 열고, 트랙 고정으로 타임라인 상단에 두어 다른 부분을 스크롤할 때 유지하는 방식을 설명한다. 선택 상세와 고정 트랙은 다른 조작이다. [고정 workspace.ts 632–645행](https://github.com/google/perfetto/blob/6c2950fee6d95466d66c8ccfcef2c308497c3d99/ui/src/public/workspace.ts#L632-L645)은 `pinTrack`이 같은 URI·이름·subtitle·removable·chips를 가진 **새 TrackNode**를 pinned 영역에 추가한다. 원본 노드를 제거/이동하거나 children을 복제하는 코드는 없다. 해당 클래스의 ID는 새 생성자가 부여하므로 같은 콘텐츠 참조 URI와 같은 객체 ID를 혼동하면 안 된다. 문서의 “moves”는 사용자 관점 설명이고, 이 고정 구현을 원본 이동이라고 옮기면 부정확하다. 자식 트리·펼침/선택 상태·이름의 이후 동기화·전체 시야 복귀가 보장된다는 근거도 아니다.

**우리 적용:** 두 자료는 전체 윤곽을 남기고 선택한 대상의 상세를 별도 읽는 원칙을 참고할 근거다. cycle05의 공간 배치·혼합 깊이·R1–R6 실제 전달/집계 끝점은 목차 제목이나 pinned URI만으로 대체할 수 없다. 따라서 Pro A의 목차형 전체 UI 추천을 그대로 채택하거나 공간·관계 손실 없이 동등하다고 판단할 수 없다. 이번에는 개요/명시 상세 분리만 참고하며, 동일 대상 식별·다른 깊이·실제 지도 위치·초점·편집 보존은 우리 원본의 별도 계약이다. 위 문서가 사람의 찾기 부담 감소나 우리 지도에서의 성공을 입증한 것으로 쓰지 않는다.

