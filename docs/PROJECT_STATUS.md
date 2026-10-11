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

기존 persistent-profile 재방문 후 새 Blob 다운로드는 일반 Blob에서도 재현된 Chromium SIGSEGV 제한이 남아 있다. 위13개 검사는 그 제한의 해결을 주장하지 않는다. 새 프로필의 다운로드·복구 결과와 구분한다. 검증은 mock/paid=false였으며 새 실제 AI 품질, 실제 고객 효용, 운영 준비는 확인하지 않았다. 새 커밋의 GitHub Actions 결과는 이 Cloud 기록과 별도로 확인한다.

## 다음 품질 초점

IDEA016 baseline 시험을 준비 중이다. 실제 continuity의 buildRequest/prompt/provider/state/handoff 경로에 6개 고객 흐름(각2~3단계)을 적용하고, 요청·답변·수동 기준·돌아온 결과가 다음 작업문에 어떻게 이어지는지 본다. 오래된 미수정 요청을 200자로 발췌할 때 뒤쪽 제약이 누락될 가능성도 입력 조립과 모델 실패로 나누어 확인한다. 제품 prompt의 선제 변경이나 기능 확대 없이 작은 사례·도구를 준비한 뒤 Cloud 실호출 결과로 개선을 판단한다. 아직 이 단계의 실행 결과나 품질 수용은 없다.

과거 IDEA013·014 합성 비교는 [IDEA013 결과](research/idea013-results.md), [IDEA014 결과](research/idea014-results.md)에 보존한다. 그 계약 통과 수를 현재 앱의 품질이나 사용자 효용으로 옮겨 해석하지 않는다. 구현 과정의 검토는 [IDEA015 제품 검토](research/idea015-product-review.md)에 남아 있으며 원본·R2·R3의 과거 결과는 Git 이력과 구분한다.

