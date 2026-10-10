# INIT-003 — 결함 수정 / 독립 재검토 대기

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
