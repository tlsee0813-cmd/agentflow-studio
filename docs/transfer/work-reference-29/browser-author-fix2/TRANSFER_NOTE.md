# fix2 검사 전달 안내

새 소스 묶음은 `app/continuity/tests/work-description29_browser.py` 한 파일이다. workflow와 제품 파일은 포함하지 않는다. 총괄이 CSS 후보와 통합하고 원격으로 게시한다. 작성자는 원격 쓰기를 하지 않았다.

작성자 증거는 `docs/transfer/work-reference-29/browser-author-fix2/`에 별도 보존한다. 원 56CB 검사와 CI 원문, 제품 fix1의 실제 중첩 스크롤 소실 증거를 덮지 않는다. 4485 검토 전 소스와 summary 내부 스크롤을 요구하던 미실행 초안은 로컬에만 별도로 남긴다. 원문 전체를 반복 업로드하는 대신 최종 diff·각 정적 검사 원문·수정 경계 및 검토 메모만 공유한다.

기존 fixture는 공개 domain API로 작성한 합성 회귀 자료이며 정상 복구 입력으로 읽는다. 실제 빈 프로젝트부터 작성하는 Cloud 정상 UI 관측과 다르다. fixture 문자열이 원 56CB와 같다는 AST 대조만 추가로 했고 Node 생성은 반복하지 않았다. 이전 Node24 순수 fixture 확인은 기존 browser-author 증거에 있다.

로컬 서버·브라우저·지원 Node22 실행은 하지 않았다. CSS 수정 후의 실제 읽기 위치·원문 가시성은 Cloud/CI에서 별도로 확인해야 한다. 이번 보완은 같은 설명 판본의 텍스트 읽기 보존을 검사하며, JSON 원문 textarea의 모든 내부 스크롤을 보존한다는 뜻이 아니다.
