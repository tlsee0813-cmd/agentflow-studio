# PR13 정확 후보 CI 결과

Head `689c47888fb7ab5040d184c2d36f2adff8f2a575`, run `39824210631`. Ubuntu job119983063953 및 Windows job119983064365 모두 최종 completed/success. Code Review pull_requests_checks만 사용했고 원격 변경·수동 재실행은 하지 않았다.

Continuity unit은 양 OS 모두267/267 pass, fail0. 정확 후보에 추가한 description23 여섯 검사는 기존 wildcard unit 실행 대상이지만 반환 로그가 각120000자 tail로 잘려 개별 DESC23 줄은 직접 회수하지 못했다. 여섯 검사의 포함은 정확 파일과 기존 실행 명령 및 전체 성공에 근거하며 개별 원로그를 읽은 것으로 보고하지 않는다. 초기 check/build/approot unit 세부 줄과 실제 Node 버전 역시 잘림 범위 밖이다.

| 실제 회수한 suite | Ubuntu | Windows |
| --- | --- | --- |
| tests/browser.py | 18 pass | 18 pass |
| continuity/tests/browser.py | 13 pass | 13 pass |
| continuity/tests/ui001_browser.py | 11 pass | 11 pass |
| continuity/tests/fresh033_browser.py | 3 pass | 3 pass |
| continuity/tests/select035_browser.py | 3 pass | 3 pass |
| continuity/tests/connect039_browser.py | 5 pass | 5 pass |
| continuity/tests/flow049_browser.py | 6 pass | 6 pass |
| continuity/tests/ai055_browser.py | 4 pass | 4 pass |
| continuity/tests/flow083_browser.py | 12 pass | 12 pass |
| continuity/tests/flow090_browser.py | 18 pass | 18 pass |
| continuity/tests/guide097_browser.py | 8 pass | 8 pass |
| continuity/tests/spatial102_browser.py | 11 pass | 11 pass |
| continuity/tests/use106_browser.py | 11 pass | 11 pass |
| continuity/tests/pc12_browser.py | 15 pass | 15 pass |
| continuity/tests/pc13_browser.py | 14 pass | 14 pass |
| continuity/tests/home15_browser.py | 21 pass | 21 pass |
| continuity/tests/report16_browser.py | 13 pass | 13 pass |
| continuity/tests/understanding17_browser.py | 12 pass | 12 pass |
| continuity/tests/hierarchy18_browser.py | 12 pass | 12 pass |
| continuity/tests/workspace19_browser.py | 6 pass | 6 pass |
| continuity/tests/received20_browser.py | 11 pass | 11 pass |
| continuity/tests/blank21_browser.py | 2 pass | 2 pass |
| continuity/tests/static_browser.py | 1 pass | 1 pass |

BLANK21 이후 static까지 양 OS 원로그의 Ran/OK를 대조했다. 설치 로그에서는 Playwright1.57.0, Chromium143.0.7499.4(build1200) 다운로드를 확인했다. Browser.version()은 읽지 않았다. Windows 첫 로그 조회의 HTTP502는 도구 응답으로 보존했으며 이후 정상 회수됐다. 제품/검사 실패로 세지 않는다.

001~010 원응답 JSON, OS별 returned.log, FINAL.json을 함께 보존한다. 실제 로그가 보인 최종 성공과 누락된 세부 증거를 구분하며, 이 CI가 실제 AI 의미 품질을 검증했다는 주장은 하지 않는다.
