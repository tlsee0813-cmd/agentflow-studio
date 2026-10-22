# PR16 · 31 CI 독립 확인

정확 head `0d9831b1141fe14ba0ce91dfc762ce9119041348`, run `39855249526`이다. 모든 조회는 `mcp__code_review__pull_requests_checks`만 사용했고 account 미지정과 같은 head를 유지했다. 제품·검사 수정, 수동 재실행, 원격 쓰기, 로컬 서버·브라우저 실행, 다른 CI API·CLI 우회와 artifact 다운로드는 하지 않았다.

| OS / job | 최종 메타데이터 | 실제 반환 로그에서 확인한 결과 |
| --- | --- | --- |
| Windows 2022 / 120091671488 | completed / success | continuity 275/pass275/fail0. browser 25묶음 246개 모두 Ran/OK. 신규 BranchRecords31 양 PC 8개와 AREA17 양 PC 12개는 개별 ok도 확인했다. BLANK21 뒤 static까지 완료했다. |
| Ubuntu 24.04 / 120091671432 | completed / cancelled | check annotation은 25분 최대 실행 시간 초과와 operation cancelled다. continuity 275/pass275/fail0, browser 19묶음 206개 Ran/OK와 AREA17 양 PC 12개·WORK29 8개까지 확인했다. 신규 BRANCH31·H18·W19·RECEIVED20·BLANK21·static은 이 run에서 미실행이다. |

Ubuntu를 제품 또는 하네스 assertion 실패로 분류할 근거는 없다. 마지막 WORK29는 `21:36:56.889Z`에 Ran 8/OK이며 바로 뒤 `21:36:56.924Z`에 취소 오류가 기록됐다. BRANCH31 명령이나 개별 결과는 없다. annotation의 시간 초과, job의 cancelled, 실제 로그의 취소 오류를 각각 구분하며 임의의 프로세스 exit code를 만들지 않았다.

느린 설치에 대한 직접 근거도 보인다. apt는 `21:24:15.631Z`에 `Fetched 23.8 MB in 9min 32s (41.7 kB/s)`를 기록했고, Chromium 다운로드 시작 `21:24:19.889Z`부터 완료 `21:31:16.588Z`까지 약 6분 57초가 걸렸다. 첫 브라우저 실행은 `21:31:19` 무렵 시작한다. 따라서 설치·다운로드 지연이 검사 실행 예산을 크게 소모한 것은 관측 사실이다. 네트워크의 근본 원인, 재실행 성공, 예산 변경의 적정성까지 이 자료로 확정하지 않는다. 검사 수나 timeout은 변경하지 않았다.

두 OS 최종 로그는 각각 120,000자 tail이며 `logTruncated=true`다. 실제 Node 버전 출력과 앞쪽 app 단위 집계는 잘려 직접 확인하지 못했다. workflow의 Node22 설정으로 실제 출력 확인을 대신하지 않는다. Playwright 1.57.0 설치와 Chromium 143.0.7499.4 build1200 다운로드는 양쪽 로그에서 직접 확인된다. 이는 `browser.version()` artifact를 회수했다는 뜻이 아니다. Windows annotation 1건은 upload-artifact action의 Node20 폐기/Node24 강제 실행 경고이며 제품 런타임과 다르다. Ubuntu annotation은 해당 경고와 시간 초과·취소 총 3건이다.

진행 중 로그 요청의 HTTP502 네 건도 원응답으로 보존했다. 이 도구 읽기 오류와 실제 CI 시간 초과를 섞지 않는다. 원응답의 요청·반환 시각, 정확 인수와 반환 JSON은 `RAW_TOOL_RESPONSES.json`에 gzip+base64로 무손실 보존했다. 해제 후 원 바이트·SHA256·Git blob을 확인할 수 있다.

Windows의 신규 8개는 합성 domain 입력을 정상 복구 UI로 열어 소유별 신호·정확한 보고 왕복·오래된 출발점 종료·입력 Escape·호출자 수명과 화면 밖 대체 초점을 검사한다. 독립 Cloud 정상 UI 관측, Tab 접근 자체·첫 소유자 글줄·같은 세션 신호 소멸의 판정, 임의 배치의 가독성·사람 사용성·실제 AI 의미 품질로 확대하지 않는다. 양 OS 신규31 수용 완료라고 주장할 수 없으며 Ubuntu의 누락 실행은 별도 판단이 필요하다.
