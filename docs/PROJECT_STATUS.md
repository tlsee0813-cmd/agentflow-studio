# INIT-004 — 기존 구현 인계 및 R5 수정 / 독립 재검토 대기

인계 기준: init-003/fix-review-regressions의 9dbc01e2ad7b9a49703e45fd1b5bafeff23278b0.
원격 브랜치와 PR #1 head가 같은 커밋임을 확인했다. 시작 체크아웃의 미커밋 변경은 없었다.
첨부 재현 스크립트로 본문과 완료 조건의 불일치, 충돌·출처 누락을 실제 재현한 뒤 수정했다.
새 앱/PR를 생성하지 않고 기존 브랜치와 PR #1을 이어 사용한다.

## INIT-004 클라우드에서 직접 실행한 검사

Linux x86_64 / Node22.16.0 / npm10.9.2 / Python3.13.5 / TypeScript5.8.3.
브라우저 의존성은 저장소의 Python Playwright1.57.0/pyee13.0.1/greenlet3.5.1이다.
환경의 독립 도구 Playwright1.64.0을 이 검증에 사용하지 않았다.
- npm ci --ignore-scripts --no-audit --no-fund, npm run check, npm test: 성공.
- 기존 Node83 + R5 신규9 = 92통과, 실패/건너뜀0.
- 기존 브라우저15 + R5 신규3 = 18통과, 실패/건너뜀0.
  시스템 Chromium154.0.8037.57, direct-http로 실제 브라우저→로컬 서버를 검증했다.
  B15도 실행했고 브라우저 fetch를 교체하지 않았다. 모든 AI 응답은 mock/주입 대역이다.
- Playwright1.57.0 번들 Chromium143.0.7499.4(build1200) 다운로드는 미완료:
  cdn.playwright.dev에서 HTTP403 Domain forbidden,
  playwright.download.prss.microsoft.com에서 최초403, 재시도400 GatewayExceptionResponse.
  TLS·체크섬 검증을 끄지 않았다. 시스템 Chromium 검증을 번들 브라우저 검증이라고 부르지 않는다.

R5 검사는 새 답변 반영/기존 유지, 취소, 미정 조건 확정 차단, 안정 ID·과거/새 출처·수동값 보존,
다른 요구/충돌 보존, 오래된 변경안 거부, 재요약 이후 결정 유지까지 확인한다.
충돌 자체의 해결과 TBD 완료 조건에 필요한 추가 확인은 별개다.

새 커밋의 GitHub Actions 결과는 최종 보고의 해당 SHA 실행 링크에서 별도로 확인한다.
이 문서의 클라우드 결과를 Windows 또는 CI 번들 Chromium 통과로 취급하지 않는다.
실제 DeepSeek 인증·모델·비용·응답 품질은 미검증이다. AI_MODE=mock/ALLOW_PAID_AI=false 유지,
실제 키 요청·유료 호출·main 병합·운영 배포 없음.

## 과거 INIT-003 기록 (아래 결과는 INIT-004 새 실행 결과가 아님)

2026-10-10 · 코드0.0.3 · 계약0.1.1. 통합·운영·실제 AI 검증 완료가 아니다.
원본 INIT-002 SHA256: 5307d15e96d2f5dfcc1f1039f254f7968fffc03b6d168b28b57cc292a8452857.
원본 ZIP와 내부 manifest62항목을 재확인하고 격리된 작업 디렉터리에서 수정했다.
기준 main: 896dcf3848fec70357d0f9bd4fd6c09cab70db37. 기존 README 외 앱 코드가 없었다.

R1~R4 원인·수용 기준은 외부 검토를 따르며 구현/검사 추적은 BASELINE/CONTRACTS에 기록했다.
원본 검토 파일은 공개하지 않았다. 기존 Node50개와 브라우저9개 검사를 삭제하지 않았다.

## 로컬 검증 (원격 게시 전)

Linux / Node22.16.0 / npm10.9.2 / TypeScript5.8.3 / Python3.13.5.
- npm run check, npm run build: 통과. 기존 설치 컴파일러 사용, 클린 설치와 별개다.
- npm test: 83통과/0실패/0건너뜀. 기존50개+새 회귀33개.
- Playwright1.57.0 + 시스템 Chromium, dom-bridge: 14통과/1건너뜀(B15 직접 네트워크).
  실제 UI 실행이지만 브라우저 fetch 대역이다. 브라우저 종단 검증으로 보고하지 않는다.
- 클린 npm ci: offline ENOTCACHED, online EAI_AGAIN 실패.
- 직접 브라우저: 번들 실행 파일 부재, 시스템 Chromium 재시도에서 ERR_BLOCKED_BY_ADMINISTRATOR.
  정책을 변경하거나 우회하지 않았다. 로컬 직접 브라우저 검증은 미완료다.

원격 Actions는 이 사전 기록으로 완료를 주장하지 않는다. 실제 실행의 checkout SHA·OS·설치·테스트·
브라우저 단계 결과를 PR Checks/Actions에서 확인한다. 새 CI 로그/이미지는 실행 artifact에만 남긴다.
브랜치/커밋/PR/Actions의 재조회 결과와 링크는 최종 작업 보고로 반환한다.

## 미완료와 승인 경계

실제 키 수령·유료 호출0회. DeepSeek 인증/모델 권한/실제 질문 품질/지연/비용은 미검증이다.
서버는 loopback 개발 전용이며 공개 인증·영속 비용 제한이 없다.
한 차례 질문은 작은 검증 범위다. 다중 대화·그래프·내보내기 확장을 하지 않았다.
장기 이력/전체 요청 상한 초과 복구와 전면적인 의미 충돌 해결은 후속 범위다.
다음 작업: 수정 커밋과 CI 결과를 외부 총괄이 독립 재검토한다. 승인 전 병합·배포 없음.
