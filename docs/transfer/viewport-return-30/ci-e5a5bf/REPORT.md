# PR17 · 30 CI 독립 확인

정확 head `e5a5bf40d544cad62b4644ab13cc2958671b0869`, run `39856945223`이다. Ubuntu job `120097476484`, Windows job `120097476852` 모두 completed/success를 Code Review로 확인했다. 모든 요청은 account 미지정과 정확한 head를 유지했다.

양 OS 각각 continuity 275/pass275/fail0, browser 25묶음 합계 242개 Ran/OK가 반환 로그에 직접 보인다. 신규 Viewport30의 0 스크롤·깊은 작업 스크롤 복귀는 1280×720과 1440×900의 개별 4개 모두 ok다. AREA17 양 PC 12개도 개별 ok이며 BLANK21 → VIEWPORT30 → static 순서의 최종 결과까지 확인했다. 첫 assertion 실패나 오류 traceback은 관측되지 않았다. 이번 head의 workflow에는 BRANCH31 suite가 없으므로 이 결과를 PR16 Ubuntu에서 실행되지 않은 신규31의 성공으로 합산하지 않는다.

신규 검사는 정상 UI로 만든 합성 여섯 부분 백업의 파일 해시를 고정하고 정상 가져오기로 준비한다. 기존 카메라·접힘을 만든 뒤 작업 화면의 실제 native wheel로 0/깊은 스크롤을 구별한다. 정상 지도 버튼의 같은 trusted click task에서 최초 geometry를 읽고 뒤의 두 프레임을 따로 비교하므로 후속 안정화로 최초 실패를 덮는 방식이 아니다. 지도 컨테이너의 실제 높이·하단, 기존 카메라·접힘·선택, 화면 밖 카드 표시, 저장 프로젝트 전체 보존을 검사한다. 모든 카드가 보인다는 주장, 모든 비영점 지도 기억 위치·모든 긴 문서의 성공, 사람 사용성·AI 의미 품질을 검증하지 않는다.

각 최종 로그는 120,000자 tail이며 `logTruncated=true`다. 실제 Node 버전 출력과 앞쪽 app 단위 총계는 잘려 직접 확인하지 못했다. workflow 설정으로 실제 버전 출력을 대신하지 않는다. 양 OS Playwright 1.57.0 설치와 Chromium 143.0.7499.4 build1200 다운로드는 직접 보인다. 실행 환경 artifact나 browser.version()을 회수한 것은 아니다. 각 check의 annotation 1건은 upload-artifact의 Node20 폐기/Node24 강제 실행 경고이며 제품 runtime 버전과 다르다.

원응답에는 요청·반환 시각과 정확한 인수·JSON을 보존했다. `RAW_TOOL_RESPONSES.json`의 gzip+base64는 원 JSON 바이트로 왕복 검증했고 각 원본의 SHA256/Git blob을 남겼다. 두 run의 상태·원응답은 분리했다. PR16 Ubuntu의 25분 취소와 미실행 결과를 이 성공으로 덮지 않는다.

도구는 `mcp__code_review__pull_requests_checks`만 사용했다. CI API·CLI 우회, artifact 다운로드, 수동 재실행, 원격 쓰기, 제품·검사 수정, 로컬 서버·브라우저 실행은 하지 않았다. 정리 스크립트 준비 중 로컬 명령 인용 구문 오류 한 번이 있었으며 CI나 제품 실패가 아니다. 인수 인용을 없앤 정리 준비로 수정했고 원격 실행에는 영향이 없다.
