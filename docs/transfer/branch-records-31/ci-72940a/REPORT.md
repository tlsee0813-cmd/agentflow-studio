# PR16 · 최종31 fix2와30 통합 CI 독립 확인

정확 head `72940a043d7a7fdc225a9582ce48831fa0418cc0`, run `39862478703`의 결과다. Ubuntu job `120116366062`, Windows job `120116366336` 모두 completed/success를 Code Review로 확인했다. 이전 실행 결과를 합산하지 않았다.

양 OS 각각 실제 반환 로그에서 continuity 275/pass275/fail0과 browser 26묶음 합계 252개 Ran/OK를 확인했다. BranchRecords31의 양 PC 10개, Viewport30의 양 PC 4개, AREA17 양 PC 12개(각 test06 포함)는 개별 메서드 ok까지 확인했다. BLANK21 → VIEWPORT30 → static까지 완료됐다. 첫 assertion 실패나 traceback은 관측되지 않았다.

31의 신규 `test_05_nonzero_page_signal_entry`는 두 OS의 두 PC 클래스에서 모두 개별 ok다. 읽기 전용으로 대조한 동결 검사 SHA256은 `17fc22a31aaef376d18622934c7893f701a215e678203572014fc9c645ae9fcd`다. 이 검사는 정상 wheel로 만든 비영점 페이지에서 신호를 클릭하고, 제품 처리 전 capture·같은 click task 직후·후속 두 frame을 구분한다. pageX/Y·기존 지도 행렬·접힘, 최종 지도 높이·하단, 정확한 패널 소유자와 첫 소유자 글줄의 실제 clip/hit, 저장 프로젝트 전체 불변을 함께 검사한다. CI 로그의 개별 ok를 확인한 것이며 artifact의 각 계측 숫자나 화면을 새로 회수한 것은 아니다.

기존31의 정확한 하위 소유 기록·보고 왕복·입력 Escape·기존 work/records 출발점 종료·프로젝트 및 호출자 수명·화면 밖 대체 초점 경계도 그대로 실행됐다. 30은 0/깊은 작업 스크롤에서의 지도 복귀와 기존 카메라·접힘·선택·화면 밖 표시·저장 자료 보존을 검사한다. 31은 공개 domain API로 만든 합성 입력의 정상 복구이며, 30은 정상 UI로 만든 합성 여섯 부분 백업의 바이트를 고정해 정상 복구한다. 독립 Cloud 정상 UI 관측과 이 자동 회귀를 구분한다.

최종 로그는 양쪽 각각 120,000자 tail이며 `logTruncated=true`다. 실제 Node 버전 출력과 앞쪽 app 단위 총계는 잘려 직접 확인하지 못했다. workflow의 설정값으로 실제 버전 출력을 대신하지 않는다. Playwright 1.57.0 설치 및 Chromium 143.0.7499.4 build1200 다운로드는 직접 보이는 설치 로그다. 실제 browser.version() 환경 artifact는 다운로드하지 않았다. 각 check의 annotation 1건은 upload-artifact action의 Node20 폐기/Node24 강제 실행 warning으로, 제품 런타임 버전과 다르다.

앞선 `0d9831` Ubuntu의 설치 지연·25분 취소와 BRANCH31 미실행, `7c7bdf` 중간 후보의 CI 성공 및 별도 Cloud pageY 반례는 기존 기록으로 보존한다. 그 실패나 미실행을 이번 결과로 덮지 않는다. 이번 문서는 정확한 최종729 실행의 자동 회귀 결과이며 제품 병합·수용 여부는 총괄의 독립 관측·검토와 함께 판단한다.

고정된 두 PC와 표본의 성공을 임의 배치·모든 비영점 기억 위치·모든 긴 자료에 확대하지 않는다. Tab 접근 자체와 같은 호출 세션의 신호 소멸은 이 자동 검사로 모두 입증하지 않는다. 첫 소유자 글줄은 신규 비영점 진입 표본에서 명시적으로 확인하는 범위다. 사람 사용성이나 실제 AI 의미 품질을 판정하지 않는다.

모든 조회는 `mcp__code_review__pull_requests_checks`만 사용했고 account 미지정과 정확한 반환 head를 유지했다. 요청·반환 시각과 원 JSON은 `RAW_TOOL_RESPONSES.json`에 gzip+base64로 무손실 보존했다. 각 원본 바이트·SHA256·Git blob과 최종 payload의 실제 파일 바이트를 검증한다. 제품·검사 수정, 예산 변경, 수동 재실행, 원격 쓰기, 로컬 서버·브라우저, 다른 CI API·CLI 우회 및 artifact 다운로드는 하지 않았다.
