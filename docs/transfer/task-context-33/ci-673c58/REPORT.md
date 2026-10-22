# PR18 · 673c58 CI 원후보 결과

정확 head `673c580d69ab5f9cffcb7f0003bcf331c57e3c93`, run `39868697925`는 Ubuntu `120137358082`·Windows `120137357878` 모두 **completed/failure**다. account를 지정하지 않은 상태와 같은 head를 유지하고 Code Review `pull_requests_checks`만 사용했다. 제품·검사·원격 변경, 재실행/취소, 다른 CI API/CLI, artifact 다운로드는 하지 않았다.

양 OS 모두 PC12 전체17개가 통과했다. 기존 test02와 새 test11은 Pc12/Pc12Wide 각각 개별 `ok`가 보인다. Ubuntu PC12는32.829초, Windows는44.198초다. 이어서 REPORT16의 `Report16.test_01_f10_current_idea_beside_the_picked_report_and_back`가 218행 **‘F10: action fully inside the first screen’** 단언에 실패했다. REPORT16은13개 중1실패, 실제 step exit1이다. 실패 대상은 기존 주행동의 첫 화면 노출이며, actual action rect는 반환 traceback에 없다. 이 CI만으로 좌표나 정확한 레이아웃 원인을 확정하지 않는다.

각 OS의 반환 로그에는 continuity 단위275/pass275/fail0과 브라우저17묶음188개 실행이 보인다. 앞선16묶음175개는OK, REPORT16의 나머지12개도 통과하여 브라우저 집계는187통과/1실패다. 이후 AREA17·WORK29·BRANCH31·H18·W19·RECEIVED20·BLANK21·VIEWPORT30·static은 이 실패 뒤 실행되지 않았다. 신규33 성공으로 이 기존 첫 화면 반례를 덮지 않는다.

최종 로그는 양쪽 각각120,000자 tail이며 `logTruncated=true`다. 앞쪽 root app 단위 집계·직접 build/타입 종료·실제 Node 버전 출력은 잘려 회수하지 못했다. 브라우저 단계에 도달한 것으로 앞 단계의 명령별 실제 exit를 새로 만들지 않는다. Playwright1.57.0 설치와 Chromium143.0.7499.4 build1200 다운로드는 로그에서 직접 확인되지만 실제 `browser.version()` JSON을 회수한 것은 아니다. 두 check의 annotation은 각각 step exit1 failure와 upload-artifact action의 Node20 폐기/Node24 강제 실행 warning이며, 이 action warning을 제품 Node 버전으로 해석하지 않는다.

초기 진행 중 job 로그 조회 두 건의 HTTP502도 원응답으로 보존했다. 도구 조회 실패와 실제 REPORT16 실패는 다르다. provider의 최종 job/check 상태와 실제 exit1은 일치한다. 공개 근거의 RAW_TOOL_RESPONSES는 반환 객체를 UTF-8 JSON으로 보존한 파일의 gzip+base64 무손실 묶음과 원 bytes/SHA/Git blob을 담는다. 이는 네트워크 wire transcript나 full artifact가 아니다. 실제 공개 runner 경로는 남겼고 로컬 개인 사용자 경로를 추가하지 않았다.

673c58은 별도 비동기 history→work 왕복 후 late focus 경계로 총괄 HOLD 상태다. 이 기록은 원후보 CI 실패 근거이며 최종 수용 CI가 아니다. Cloud 화면 우선 관측·notice00 독립 대조·후속 수정 후보와 합산하지 않는다. REPORT16 원단언/스크롤을 완화하거나 실패 후 UI를 수리하지 않았다.
