# 36 Ubuntu CI 재현 환경 확인 — 차단, 제품 판정 아님

현재 접근 가능한 Cloud 캐시에 공식 Playwright1.57 Chromium143/build1200 실행파일이 없다. 기본 기대 경로 `/home/agent/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome` 없음, 별도 기존 bundled-cache에는 .links만 있다. /ms-playwright·/opt/ms-playwright도 없다. root 전용 cache는 권한 거절로 미확인이고 확대 접근하지 않았다.

기존 같은 Cloud의 공식 `python -m playwright install --only-shell chromium` 1회 원시 실행(2026-10-23 02:11:35~36 KST)은 actual child1이었다. 공식 cdn.playwright.dev 및 playwright.download.prss.microsoft.com의 build1200 다운로드가 모두 HTTP403 `Domain forbidden`이었다. 원CLI 내부 fallback 로그를 그대로 동봉했다. 같은 차단을 재시도하거나 다른경로·allowlist·보안설정 변경으로 우회하지 않았다. 이는 새 다운로드 시도나 최신 네트워크 성공/실패 측정이 아니다.

현 system은 Debian13 Chromium154.0.8037.57이고 fc-match sans-serif는 OpenAI Sans다. 143 실행버전은 확보하지 못했으며, 제공된 CI의 143.0.7499.4/build1200·Ubuntu 실제 사용 font와 동등하다고 주장하지 않는다. 폰트 설치/시스템 전역 변경 없음. 154 browser test 재실행도 없다.

따라서 exact test01 양PC·실패 P rect/clip/font·PNG는 NOT_RUN/미수집이다. 기존154 통과로 Ubuntu 실패를 무효화하지 않는다. Linux CI6실패/Windows성공 정보는 총괄이 전달한 내용만 사용했고 Actions/CI API를 조회하지 않았다. 36 수용은 보류 상태다.

기존65cd build를 읽기만 해 hash를 확인했고, a17 app동등성의 이전 binding에 연결했다. 새 제품 빌드·서버·UI·검사 프로세스는 시작하지 않았다. 마지막 read-only 가용성 probe exit0은 환경 목록 수집 완료이며 UI 성공이 아니다. 처음 root cache PermissionError는 별도 보존했다. 사용자 설정/다운로드 요청은 하지 않는다.

정확143과 CI 동등 font를 현재 범위에서 확보할 수 없어 여기서 마친다. 원인/font가설이나 제품 귀책은 이 관측으로 확정할 수 없다. MANIFEST는 자신을 제외한 정확 payload 집합이다.
