# PR15 정확 후보 CI 확인

Head `709e402b2e44a4864139eda03201e186f5761c6f`, run39843851282. Code Review의 지정 도구로 읽은 원문과 시간·인수를 보존했다.

- verify (ubuntu-24.04): completed/failure. 반환 120000자, 잘림 True. 브라우저 Ran 구간 18개·198개 검사.
- verify (windows-2022): completed/failure. 반환 120000자, 잘림 True. 브라우저 Ran 구간 18개·198개 검사.

양 OS 모두 기존 AREA17의 test_06_locate_new_request_copy_and_return가 두 PC 클래스에서 실패했다. understanding17_browser.py:362의 #work-locate-return 첫 글줄이 viewport 안에서 가리지 않고 읽히는지 확인하는 단언이 false였다. AREA17은 12개 중 2실패·exit1이며, 신규29 8개는 양 OS에서 NOT_RUN이다. AREA18·WORKSPACE19·RECEIVED20·BLANK21·static도 이후 명령이 실행되지 않았다. 별도 Cloud에서 실행한 신규29 결과와 혼합하지 않는다.

반환 tail에서 continuity 단위275/pass275/fail0을 직접 확인했다. AREA17 앞의 브라우저17묶음186개는 Ran/OK이며, AREA17을 포함한 실행 합계는18묶음198개·2실패다. 실패 traceback에는 rect/scroll/hit 측정값이 없어 route 소실, 가림 또는 준비 전제를 여기서 단정하지 않는다. 원 장면의 실제 기하를 별도 관측하는 것이 최소 다음 단계다. 기존 단언을 완화하거나 소스를 수정하지 않았다.

각 로그는120000자 tail로 잘렸다. 초기 실제 Node 실행 버전 줄은 보이지 않는다. Playwright1.57.0 설치와 Chromium143.0.7499.4 build1200 다운로드는 보이지만 browser.version() 환경 artifact는 회수하지 않았다. 양 OS annotation은 exit1 한 건과 upload-artifact의 Node20 폐기·Node24 강제 실행 warning 한 건씩이다. action 경고를 제품의 Node 버전 증거로 쓰지 않는다.

실제 줄·첫 실패 traceback·종료 코드는 CI_FINAL.json에 기록했다. 원문 응답은 RAW_TOOL_RESPONSES.json에서 무손실 gzip+base64로 복원할 수 있다. source-raw 내부 스크롤 소실과 신규29 prep 실패에 관한 Cloud 관측은 별개이며, 이 CI는 신규29 단계까지 도달하지 않았다.

로컬 서버·브라우저·제품 수정·원격 쓰기·수동 재실행은 하지 않았다.
