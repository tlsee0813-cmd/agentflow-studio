# AgentFlow Studio 현재 상태 — IDEA015 R3 수용

2026-10-11 21:31 KST 통합 Cloud 검증 기준. 최신 참조는 `init-003/fix-review-regressions` / [Draft PR #1](https://github.com/tlsee0813-cmd/agentflow-studio/pull/1)이며 main 병합·운영 배포는 없다. 실행 명령과 자료 위치는 [START_HERE](START_HERE.md)에 있다.

## 현재 실행 가능한 범위

[app/continuity](../app/continuity/README.md)에 ‘이어서 만들기’를 추가했다. 자유 요청과 답변, 보존 기준의 직접 편집, 작업문 복사·저장, 돌아온 결과 붙여넣기와 다음 변경, localStorage 저장·JSON 복구를 연결한다. 기준 수정 뒤 낡은 AI 문구를 현재 작업문에서 제외하고 수동값과 원문 이력을 유지한다. v1 원본을 보존하면서 저장 형식을 변환하며, AI 문맥128KiB 한도와 로컬 작업문·복구8MB 한도를 분리한다. 1,001건을 저장한 뒤 load/import가 거절되던 복구 경계를 R3에서 수정했다.

검증 대상 통합 소스는169파일, `SOURCE_FINAL.sha256`의 지문은 `c7e69b31934c65a4ff99852f75f3d3b4b92c83ddbcea83b33b01c519d011816e`다. 이는 공유 문서와 CI를 갱신하기 전 검증 묶음의 정체성이다. 이번 반영은 continuity23파일과 I9 검사2파일의 원문을 사용한다. 기존 기준145파일 중 의도한 소스 예외는 `app/tests/eval-init009.test.mjs` 하나이고 나머지144파일은 검증 묶음에서 불변이었다. 추가 helper는 임시 합성 자료로 I9.02를 격리한다. 제품의 실제 호출 runner·승인 gate·fixture·과거 원장은 변경하지 않았다.

## 완료한 통합 검증

| Cloud 실행 | 결과 |
|---|---|
| 클린 npm ci, 기존/continuity check·build | 모두 종료0 |
| 기존 전체 Node | 279/279 통과 |
| continuity Node | 45/45 통과 |
| 직접 HTTP 브라우저 | 13/13 통과 |
| I9.01 지문, Linux I9.02 원장 부재·완료 분기 | PLAN_REQUIRED 거절과 생성0 no-op 구분 통과 |

실패·skip은 모두0이다. Node22.16.0 / npm10.9.2 / TypeScript5.8.3 / Python3.13.5 / Playwright1.57.0 / 시스템 Chromium154.0.8037.57을 사용했다. 브라우저는 native HTTP와 실제 localStorage 경로이며 지정된 응답 fixture·오류 주입은 구분했다. 30→14 기준 수정 뒤 낡은 AI 제외·수동값 보존, 장기 기록·v1 이력, 재시도 답변 중복 방지, 1,001개 저장→새로고침→백업→가져오기를 확인했다. 8MB/100,000개 경계는 Node 검사다. 검사 후169파일의 해시는 불변이었다.

기존 persistent-profile 재방문 후 새 Blob 다운로드는 일반 Blob에서도 재현된 Chromium SIGSEGV 제한이 남아 있다. 위13개 검사는 그 제한의 해결을 주장하지 않는다. 새 프로필의 다운로드·복구 결과와 구분한다. 이 통합 검증은 mock/paid=false였으며 당시 새 실제 AI 품질, 실제 고객 효용, 운영 준비는 확인하지 않았다. 별도로, 앱 통합 커밋 `608d4753ebf4efc96c2df5bd518e5437e0ee99b4`의 [GitHub CI 38140619804](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/38140619804)는 completed/success다. 기존 앱과 continuity check·build·Node·브라우저 검사를 실행한 결과이며 IDEA016 실제 AI 품질 결과가 아니다. 이번 실험 도구 추가에서는 CI 검사 범위를 늘리지 않는다.

## 현재 품질 확인 — IDEA016 rev1 baseline 완료

[IDEA016 결과](research/idea016-results.md)는 2026-10-11 23:17 KST Cloud 완료 보고를 요약한다. 고객6흐름에서 실제14회 호출했고 모두 HTTP200이었으나 앱 수용은13회, INVALID_RESPONSE는1회였다. C01~04는 도구상 complete, C05는 계약 실패로 후속 변경 미실행, C06은 질문이 남아3회 상한에서 incomplete다. complete나 HTTP 성공을 고객 효용 합격으로 해석하지 않는다.

실험 rev1의 키 반향 보호는 작성자 focused1개·독립 좁은 메모리 회귀5개로 수용했다. 이 보호는 실험의 기록·receive 이전 경계이며 제품 provider 수정이나 전수 보안 감사가 아니다. 실제 baseline은 기존2048토큰·15초 설정과 기존 curl proxy 전송을 사용했고 자동 재시도·키 반향은 없었다. 검증 ZIP의 기준169+실험9파일은 불변이며 종료 시 paid=false였다. 실제 제공업체 응답 관찰과 이전 mock 앱/CI 검증을 구분한다.

실제4사례 원문 발췌를 회수·대조했다. C03은 명시적 이어받기 요청과 전체 수동값이 전송됐으나, 현재 checks의 입력 원본 불변 생략과 ‘현재 지시 아님’ 이력 표제로 적용 우선순위가 불명확했다. 완전 유실은 아니다. C06의 ‘별명만’은 전송 전200자 발췌에서 빠졌고 연락처 제외는 이전 AI 재진술로 전송·반영됐다. C02의 첫 선택지는 모순됐으나 후속 확정 시점은 올바르며, C05는 checks 계약 실패로30→60 단계가 미실행이었다.

IDEA017 후보1개가 독립 scratch 좁은 검사13/13을 통과해 Cloud 실제 평가 대상으로 수용됐다. production의 context·type·validation·prompt4파일을 보완한 별도179파일 묶음이며,172개 동일·6개 변경·1개 신규다. 이전 수동값 참조는 항상 제공하되 명시적 재사용 요청 때만 적용하도록 지시하고, 의미 탐지나 모든 과거 기준의 강제 carry를 보장하지 않는다. 원문 전체의 예산 내 우선 전송·엄격한 문자열 계약·선택지 명확화도 후보 범위다.

Cloud에 같은6사례 실평가를 전달했으나 새 실제 호출 수·결과는 미확인이다. 좁은 검사는 품질 수용이 아니며 후보 소스는 실제 결과 수용 전까지 게시하지 않는다. 현재 수용 앱은 IDEA015 R3이고 위IDEA016 baseline14회 결과는 그대로다. 이번 반영은 문서2개뿐이며 소스·CI·main을 변경하지 않는다. 실행 도구와 ZIP 전용 자료 위치는 [IDEA016 README](../experiments/idea016/README.md), [REPOSITORY_SCOPE](../experiments/idea016/REPOSITORY_SCOPE.md)에 있다.

과거 IDEA013·014 합성 비교는 [IDEA013 결과](research/idea013-results.md), [IDEA014 결과](research/idea014-results.md)에 보존한다. 그 계약 통과 수를 현재 앱의 품질이나 사용자 효용으로 옮겨 해석하지 않는다. 구현 과정의 검토는 [IDEA015 제품 검토](research/idea015-product-review.md)에 남아 있으며 원본·R2·R3의 과거 결과는 Git 이력과 구분한다.

