# 21 키보드 스크롤 직렬화 후보 — 검증 전
원본 f7b25a586dca42466f07c7db2bedb9c59703deda / 검사212163B1F4B7B6E328BC194676656EAED570A65179C6670DC6274E74D10A3117.
후보 blank21_browser.py SHA256 3A3C61B22EDB3F337457ADE10E1DBB13522B85BCD5B40B2E38C6038225F44303 (18600 bytes).
원 Control+End, Shift+Tab 두 키 입력에만 실제 trusted 키 입력 및 관측 scroll/scrollend 완료 대기를 추가한다. End가 실제 textarea 이동을 필요로 하면 textarea scrollend도 필수다. 좌표 정지는 두 연속 렌더 관측이며 별도 기록한다. 원 IO/clip/hit/초기화면/전체 의미 단언, 제품, 기존 helper는 유지한다. 스크롤·초점·DOM·CSS·storage 수리나 고정 sleep은 없다.
가설: 원검사는 키 입력 후 늦게 진행되는 문서 이동과 다음 조작이 경합할 수 있다. 후행 관측21a621b7은 summary 위치가4.125에서−2250.875로 실제 이동했음을 보였지만 원인을 확정하지 않았다. 이 후보의 통과도 정확 브라우저 버그 원인이나 전체 UX 품질을 증명하지 않는다.
작성자 AST/embedded JS 구문 확인만 실행. 로컬 브라우저·서버 미실행. 원 실패와 이전 계측 통과는 별도 보존한다. Cloud154 원검사 실패 대비 후보와, 최종 실제 CI143은 아직 미실행이다.
