# VIEWPORT30 준비 전이 testfix1

정적 검토에서 신규 빈 Browser context는 프로젝트 목록이 아니라 빈 작업 화면으로 시작한다는 준비 누락을 확인했습니다. v0 원문673142...는 frozen-test-sources와 기존 payload/patch에 보존했습니다. 로컬 실행 실패를 회수한 것은 아닙니다.

파일 선택 전 정상 nav-projects 클릭과 projects-view 가시성 확인 한 줄만 추가합니다. 그 뒤 기존 chooser/확인/rename/save/fold/휠은 같습니다. 최초 클릭의 같은 task 측정, 가용높이/bottom/camera/접힘/전체project 불변, 별도2frame, 실패exit와 CI step은 변경하지 않았습니다.

Python AST/최종 diff0. 기존 JS10개 표현과 fixture·workflow·제품 source는 byte동일이며 이전 정적/pure/type/build 결과와 구분합니다. 브라우저/서버/원기준 실패 대조는 여전히 NOT_RUN입니다. Cloud30 제품 독립 결과는 총괄의 별도 증거이며 이 검사 실행 성공으로 합산하지 않습니다.
