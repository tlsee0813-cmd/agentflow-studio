# PR14 정확 후보 CI 독립 확인

Head `6b96543fdf980ff45f0e1b67f83e8a0a561a1542`, run39835847977. Ubuntu job120023840316·Windows job120023840962 모두 최종 completed/success다. Code Review pull_requests_checks만 사용했고 계정 선택·반환 head를 유지했다.

양 OS 원 로그 tail에서 continuity275/275·fail0, 브라우저23묶음 각230개, BLANK21 뒤 static까지 Ran/OK를 확인했다. 수정한 understanding17_browser.py의 test_03_counterexamples_and_correction_draft는 두 PC 클래스에서 모두 ok이며, 해당 suite 전체12개도 통과했다.

| 회수된 브라우저 묶음 | Ubuntu | Windows |
| --- | --- | --- |
| tests/browser.py | 18 통과 | 18 통과 |
| continuity/tests/browser.py | 13 통과 | 13 통과 |
| continuity/tests/ui001_browser.py | 11 통과 | 11 통과 |
| continuity/tests/fresh033_browser.py | 3 통과 | 3 통과 |
| continuity/tests/select035_browser.py | 3 통과 | 3 통과 |
| continuity/tests/connect039_browser.py | 5 통과 | 5 통과 |
| continuity/tests/flow049_browser.py | 6 통과 | 6 통과 |
| continuity/tests/ai055_browser.py | 4 통과 | 4 통과 |
| continuity/tests/flow083_browser.py | 12 통과 | 12 통과 |
| continuity/tests/flow090_browser.py | 18 통과 | 18 통과 |
| continuity/tests/guide097_browser.py | 8 통과 | 8 통과 |
| continuity/tests/spatial102_browser.py | 11 통과 | 11 통과 |
| continuity/tests/use106_browser.py | 11 통과 | 11 통과 |
| continuity/tests/pc12_browser.py | 15 통과 | 15 통과 |
| continuity/tests/pc13_browser.py | 14 통과 | 14 통과 |
| continuity/tests/home15_browser.py | 21 통과 | 21 통과 |
| continuity/tests/report16_browser.py | 13 통과 | 13 통과 |
| continuity/tests/understanding17_browser.py | 12 통과 | 12 통과 |
| continuity/tests/hierarchy18_browser.py | 12 통과 | 12 통과 |
| continuity/tests/workspace19_browser.py | 6 통과 | 6 통과 |
| continuity/tests/received20_browser.py | 11 통과 | 11 통과 |
| continuity/tests/blank21_browser.py | 2 통과 | 2 통과 |
| continuity/tests/static_browser.py | 1 통과 | 1 통과 |

## 직접 확인한 범위와 한계

로그는 각120000자 tail로 잘렸다. REFRESH27 신규8개의 개별 이름·초기 check/build/approot unit 세부·실제 Node 실행 버전은 직접 보이지 않는다. 신규8개 포함은 정확 후보의 검사 파일·기존 wildcard 명령·275개 전체 성공에 따른 판단이며 개별8개 raw를 회수했다고 하지 않는다. 로컬 새8+기존91=99/99의 Node24 보조 검사와 이번 CI는 구분한다.

설치 로그의 Playwright1.57.0/Chromium143.0.7499.4 build1200은 보인다. 실제 browser.version JSON이나 설치 앞부분의 Node 실행 버전은 회수하지 않았다. upload-artifact의 Node20/24 경고로 제품 Node 버전을 추론하지 않는다.

Windows 첫 조회는 HTTP502로 끝났고 003 원응답에 시각과 함께 보존했다. 3분 이상 간격 뒤 최종 양OS 성공과 Windows 로그가 회수됐다. 앞서 root가 받은 두502는 이 묶음의 원응답과 구분한다. 우회 API·artifact 다운로드·수동 rerun은 없었다.

002/005 원응답에 정확 job/head·조회 전후 UTC 시각·반환 로그가 들어 있다. 로컬 returned.log는 같은 문자열을 추출한 사본이고 최소 업로드에서는 중복을 제외한다. 새27 정상 UI는 별도 Cloud 범위이며 실제 AI 의미 품질을 주장하지 않는다.

## Annotation 원문 확인

007/008 checkRunId 응답에서 양 OS 각각 warning 1개를 직접 확인했다. 모두 actions/upload-artifact@ea165…의 Node20 폐기·Node24 강제 실행 안내다. 다른 제품 오류 annotation은 이 응답에 없고 hasMore=false다. 이 warning은 제품의 Node 실행 버전 확인이나 검사 실패가 아니다.
