# INIT-008 검증 기록 / 재현 명령

## 실행 환경과 설치 한계

Linux / Node v22.16.0 / npm10.9.2 / PATH TypeScript5.8.3.
package.json, package-lock.json, .nvmrc의 선언은 원본 바이트 그대로다. 새 의존성 없음.
`npm ci --ignore-scripts --no-audit --no-fund --offline`는 ENOTCACHED로 실패했다.
이어서 온라인1회(`--fetch-retries=0 --fetch-timeout=8000`)는 registry DNS EAI_AGAIN으로 실패했다.
이후 재설치/Git 복원은 하지 않았다. **클린 설치를 성공한 적이 없다.**
기존 설치된 정확한 버전의 compiler로 `npm run check`와 `npm run build`를 실제 통과했다.
이는 pinned compiler 사용/빌드 증거이며 npm ci 성공이나 공급망 검증의 증거는 아니다.

## 실행 결과

| 검사 | 실제 결과 | 증거/구분 |
|---|---|---|
| 입력 ZIP/manifest | SHA 일치,89항목 모두 일치,source77 | 원본을 복원하거나 overlay를 재적용하지 않음 |
| 신규 Node `quality-init008.test.mjs` | 19통과/0실패/0skip | 도메인/adapter 주입 대역 + 그 중 native localhost HTTP2경로 |
| 관련 Node4파일 | 73통과/0실패/0skip | provider/regressions/conflict-resolution/http |
| check/build | 각각 exit0 | 기존 PATH TS5.8.3 사용; 최종 신규 harness 포함 syntax 확인 |
| 직접 브라우저 B15 | 1실패, 환경 차단 | localhost Page.goto에서 ERR_BLOCKED_BY_ADMINISTRATOR. 정책 변경 안 함 |
| 신규 compiled UI | DOM bridge3통과 | Playwright1.57.0 + Chromium144.0.7559.96. 브라우저 fetch 대역 |
| 관련 compiled UI | DOM bridge7통과 | B03/B04/B06/B09/B12/B13/B16. 입력·미저장 수정·늦은 응답·원문·TBD 보호 |
| 새 prompt 본문 크기 | 기존 자료 snapshot8개 7553–10625bytes | 생성0, 실제 토큰 수/품질/가격 검증 아님;32KiB 이내 |

신규 테스트 첫 실행은18통과/1실패였다. I8.2의 테스트 선택기가 `projectId`로 시작하는 JSON
중 출력 예제가 아닌 새 guide JSON을 읽은 오류다. `proposals` 포함 출력 예제로 선택 범위를
수정하고19개 모두 다시 통과했다. 제품 동작/검증기를 고치거나 검사를 삭제하지 않았다.
첫 실패 로그도 반환한다. 이후 최종 소스에서 필요한 syntax/build와 신규 검사를 마무리했다.

새19개는 unknown ID 외에 answerId/questionId/requirementId/가짜 예제 ID/다른 프로젝트 출처/
미래 버전 출처를 모두 기존 known_source 규칙으로 거절한다. 이것은 실제 p01이 어느 종류의
ID를 냈다는 재현이 아니라 **알려진 거절 유형의 고정 회귀**다. healthy provider200/model/stop/usage
메타데이터와 app502, 호출1회·fallback없음·출처/답변 불변도 검사했다.

p03 회귀는 **새 합성 독서 기록 사례**다. unknown→deferred의 같은 Answer ID와두출처,
deferred/TBD를 보존하면서 고의로 모순되는 AI 문장도 자유 원문으로만 보관함을 검사한다.
실제 첨부 평가자료를 수정하거나 거절 원문을 복원한 자료가 아니다. 확정/보류/제외/수동잠금/
needsReview와 오래된 응답까지 현재 결정 뷰와 항목이 같은 데이터로 움직이는지 확인했다.

## 무상 재현 명령 (source/에서)

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm run build
node --test --test-concurrency=1 tests/quality-init008.test.mjs
node --test --test-concurrency=1 tests/provider.test.mjs tests/regressions.test.mjs tests/conflict-resolution.test.mjs tests/http.test.mjs
# 이미 설치된 검토 가능한 Chromium 경로를 지정. 별도 브라우저 다운로드를 실행하는 명령은 아님.
BROWSER_EXECUTABLE=/usr/bin/chromium BROWSER_TRANSPORT=direct-http python tests/browser-init008.py
BROWSER_EXECUTABLE=/usr/bin/chromium BROWSER_TRANSPORT=direct-http python tests/browser.py BrowserTests.test_B03_unknown_is_deferred_not_confirmed BrowserTests.test_B04_server_invalid_response_keeps_customer_answer_and_input BrowserTests.test_B06_edit_during_pending_response_rejects_old_data BrowserTests.test_B09_manual_edit_buffer_survives_late_response BrowserTests.test_B12_long_answer_failure_then_edit_and_retry_keeps_original BrowserTests.test_B13_invalid_custom_answer_is_editable_without_loss BrowserTests.test_B16_R5_apply_cancel_and_uncertain_paired_resolution
```

이 환경에서는 마지막 두 명령의 transport를 `dom-bridge`로 명시하여 분리 검증했다.
그 모드는 JS/DOM을 실행하지만 브라우저 fetch/네비게이션/CSP 네트워크 경로를 검증하지 않는다.
신규 브라우저 파일은 기본3개만 실행하고 상속된 전체18개를 자동 실행하지 않는다.
원본 browser.py·기존 회귀검사 바이트는 보존했다. browser-server.mjs에 신규 scenario를
명시 선택했을 때만 작동하는 synthetic fixture 분기9행을 추가했다. 제품에서는 import하지 않는다.

## 미실행과 결과의 범위

이 세션에서 실AI/유료 호출, 키 접근, legacy live ledger 생성·재개·삭제·변조, INIT005/006 CLI,
INIT007 두번 CLI, 전체178/parity, 원격조회/쓰기/PR/main/배포/새 host 공개는 하지 않았다.
독립 리뷰·Windows/Cloud 클린 설치·직접 브라우저·새 prompt의 실제 품질 개선은 미검증이다.
이 검토는 작성자 문맥의 자기 검토다. 과거 수용된 테스트 결과를 이번 재실행으로 세지 않았다.
검사 로그와 screenshot은 ZIP의 verification/에 있으며 모두 무상 합성 검사 산출물이다.
