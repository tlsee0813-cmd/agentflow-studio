# 33 최종 후보 CI: 양 OS 성공

PR18의 고정 head `bfa6591fab4b04727f25de721a41f755a88b3205`, run `39871706618`을 Code Review 진단 도구로만 확인했습니다. 계정은 요청하지 않았고 모든 후속 읽기에 같은 head를 유지했습니다. [Ubuntu 120147433890](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/39871706618/job/120147433890)와 [Windows 120147433546](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/39871706618/job/120147433546)는 최종 `completed / success`이며, 두 실제 job 로그도 성공으로 끝납니다. 원후보673의 실패 및 독립 Cloud 화면 관측과 구분한 최종 CI 근거입니다.

두 OS 모두 반환 로그에서 브라우저 26묶음·256개가 모두 OK입니다. PC12는 19개이며 test02(이어갈 보고/요청 대상), test11(대상 이동·선택한 파일 검토), test12(지연 파일 선택 중 화면 이탈 보호)의 Pc12/Pc12Wide 개별 OK를 확인했습니다. test12는 다음 줄 설명 뒤의 `... ok`까지 읽었습니다. REPORT16은 원래 검사 13개 전체 OK이나 성공 로그는 점 출력 방식이므로 F10 개별명·실제 좌표는 이 CI 로그에서 회수하지 않았습니다.

| 검사 | Ubuntu | Windows |
|---|---:|---:|
| PC12 19개 | OK · 39.935초 | OK · 45.965초 |
| REPORT16 13개 | OK · 38.891초 | OK · 44.923초 |
| branch31 10개 | OK · 20.896초 | OK · 25.710초 |
| viewport30 4개 | OK · 4.286초 | OK · 5.734초 |

AREA17·설명29·AREA18·기록19·수신20·BLANK21 및 마지막 static_browser도 각각 OK여서 원후보에서 REPORT16 뒤에 실행되지 못했던 검사가 이번에는 실행됐습니다. 보이는 단위 TAP 요약은 양쪽 모두 tests275/pass275/fail0입니다. static MOCK 빌드 완료 메시지도 보입니다.

두 로그는 각각 120,000자의 뒤쪽 발췌이며 `logTruncated=true`입니다. 앞선 부모 단위 총수, 타입/일반 빌드 명령별 출력·exit와 실제 Node 버전 출력은 잘린 범위라 직접 회수하지 못했습니다. 이 항목들을 미실행으로 단정하거나 최종 job 성공만으로 개별 원시 출력까지 확인했다고 쓰지 않습니다. Python3.13.5 경로와 Playwright1.57.0 설치, Chromium/Headless Shell143.0.7499.4(build1200) 다운로드는 보입니다. 실제 browser.version() JSON은 미회수이므로 설치 버전과 실행 버전 직접 증명은 구분합니다. 전체 artifact는 회수하지 않았습니다.

각 check의 annotation1개는 upload-artifact 액션의 Node20 폐기·Node24 강제 전환 안내입니다. 제품 Node 런타임 실패나 제품이 Node24에서 검증됐다는 뜻이 아닙니다. 중간 job-log 조회의 provider HTTP502 원문도 보존했으며 CI 실패로 분류하지 않았습니다. 최종 provider 상태와 실제 로그 결론 사이의 불일치는 없습니다.

`RAW_TOOL_RESPONSES.json`은 원시 도구 응답을 로컬에서 직렬화한 파일 각각의 원본 SHA와 gzip+base64를 담습니다. 압축은 공개 사본을 만든 뒤 수행하고 무손실 해제를 검사했습니다. 개인 로컬 사용자명·경로는 원응답에 없었으며, 공개 원문에는 CI 서비스 계정의 표준 runner 경로가 남아 있습니다. 네트워크 전송 원본 바이트나 전체 artifact라는 주장은 하지 않습니다. Actions API/CLI/다운로드 대체·취소·재실행·제품 변경·원격 쓰기는 하지 않았습니다.
