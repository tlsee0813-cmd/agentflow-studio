# PR15 fix4 CI 독립 확인

Head `aa0938ecbe96ec5fdb15eb4783e865bf7ab70c7b`, run39849822053. 원709e와 별개 run만 추적했으며 계정 선택과 반환 head를 유지했다.

- verify (windows-2022): completed/success. 로그 120000자, 잘림 True. 반환 구간의 브라우저 24묶음·238개 중 Ran/OK 238개.
- verify (ubuntu-24.04): completed/success. 로그 120000자, 잘림 True. 반환 구간의 브라우저 24묶음·238개 중 Ran/OK 238개.

신규971의 개별 메서드와 AREA17 양 PC 줄·suite Ran/종료 결과는 CI_FINAL.json에 실제 보이는 원문으로 기록했다. 나머지 browser군과 단위 집계도 같은 방식으로 구분했다. 실패가 있으면 첫 traceback과 실제 종료 코드를 보존하며, 보이지 않는 뒤 단계는 실행 통과로 세지 않는다.

이 결과는 같은 번들의 자동 회귀 범위다. 정상 UI를 별도로 준비한 Cloud 관측, 사용성·공간 가독성 또는 AI 의미 품질 판정을 대신하지 않는다. 잘린 실제 Node 실행 버전이나 미회수 환경 artifact를 workflow 설정값으로 대신하지 않았다. upload-artifact의 Node 경고도 제품 실행 버전과 구별한다.

raw 도구응답은 RAW_TOOL_RESPONSES.json의 gzip+base64를 해제해 원문과 해시를 확인할 수 있다. 제품·검사 파일은 변경하지 않았다.

양 OS 모두 continuity275/pass275/fail0과 브라우저24묶음238개 Ran/OK를 직접 확인했다. 신규971은 각8개의 개별 ok이며, AREA17도 양PC 개별12개와 suite OK다. BLANK21 뒤 static까지 이어졌고 이번 run에서 첫 실패는 관측되지 않았다.

검증 범위는 실제 편집 대상 귀속, 첫 U 입력의 DOM·초점·선택·읽기 보존, stale 안내와 인계 제외, 같은 pin의 늦은 보고 수신 후 위치·동일 Range 보존, 명시 재열기 초기화와 새 판본 선택이다. held-only와 작업·프로젝트 전환 경계도 포함한다. source-raw 텍스트의 단일 body 읽기를 다루며 JSON 원문 textarea의 모든 내부 위치까지 보장하지 않는다. 임의의 모든 긴 자료·배치·창 크기나 실제 AI 의미 품질의 수용으로 확대하지 않는다.

두 원로그는 각120000자 tail이다. 초기 실제 Node 실행 버전 줄은 잘렸고, Playwright1.57.0 설치와 Chromium143.0.7499.4 build1200 다운로드만 직접 보인다. 각 check의 annotation은 upload-artifact의 Node20 폐기/Node24 강제 실행 warning 한 건이다. Ubuntu 진행 중 로그 요청 한 번은 HTTP502였고, 간격을 둔 최종 요청은 성공했다. 읽기 오류는 원응답으로 남기며 CI 실패나 수동 재실행으로 세지 않는다.
